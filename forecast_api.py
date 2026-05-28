from fastapi import FastAPI
from pydantic import BaseModel
import numpy as np
import boto3
from tensorflow.keras.models import load_model
from sklearn.preprocessing import MinMaxScaler
import pandas as pd
import os
from prometheus_fastapi_instrumentator import Instrumentator
from prometheus_client import Gauge

app = FastAPI()

Instrumentator().instrument(app).expose(app)

# Custom metrics
forecasted_consumption_gauge = Gauge(
    "forecasted_total_next_day", 
    "Predicted total CPU consumption for the next day"
)

BUCKET_NAME = "power-forecast-dinesh"

s3 = boto3.client("s3")

MODEL_FILE = "model.keras"
BEST_FILE = "best_model.txt"
DATA_FILE = "power_hourly.csv"

model = None
scaler = None

# =========================
# Load best model from S3
# =========================
def load_best_model():
    global model, scaler

    # Download best_model.txt
    s3.download_file(BUCKET_NAME, "results/best_model.txt", BEST_FILE)
    with open(BEST_FILE) as f:
        best_model_name = f.read().strip()

    # Download model
    s3.download_file(BUCKET_NAME, f"models/{best_model_name}_model.keras", MODEL_FILE)
    model = load_model(MODEL_FILE)

    # Download dataset to rebuild scaler
    s3.download_file(BUCKET_NAME, "data/power_hourly.csv", DATA_FILE)
    df = pd.read_csv(DATA_FILE)
    df["consumption"] = pd.to_numeric(df["consumption"], errors="coerce")
    df = df.dropna()

    values = df["consumption"].values.reshape(-1, 1)
    scaler = MinMaxScaler()
    scaler.fit(values)

    print("Best model loaded:", best_model_name)


@app.on_event("startup")
def startup_event():
    load_best_model()


# =========================
# Input schema
# =========================
class ForecastInput(BaseModel):
    last_24_hours: list[float]


# =========================
# Forecast endpoint
# =========================
@app.post("/forecast")
def forecast(data: ForecastInput):
    global model, scaler

    if len(data.last_24_hours) != 24:
        return {"error": "You must provide exactly 24 hourly values"}

    # Scale input
    input_array = np.array(data.last_24_hours).reshape(-1, 1)
    scaled_input = scaler.transform(input_array)

    seq = scaled_input.reshape(1, 24, 1)

    predictions = []

    for _ in range(24):
        next_val = model.predict(seq, verbose=0)[0][0]
        predictions.append(next_val)

        seq = np.append(seq[:, 1:, :], [[[next_val]]], axis=1)

    predictions = np.array(predictions).reshape(-1, 1)
    predictions_inv = scaler.inverse_transform(predictions)

    total_next_day = float(predictions_inv.sum())
    
    # Expose to Prometheus
    forecasted_consumption_gauge.set(total_next_day)

    return {
        "predicted_next_24_hours": predictions_inv.flatten().tolist(),
        "total_next_day_consumption": total_next_day
    }
