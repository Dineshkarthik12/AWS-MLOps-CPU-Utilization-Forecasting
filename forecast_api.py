from fastapi import FastAPI
from pydantic import BaseModel
import numpy as np
import boto3
from tensorflow.keras.models import load_model
from sklearn.preprocessing import MinMaxScaler
import pandas as pd
import os
from prometheus_fastapi_instrumentator import Instrumentator

app = FastAPI()

Instrumentator().instrument(app).expose(app)

BUCKET_NAME = "power-forecast-dinesh"

s3 = boto3.client("s3")

# cache for loaded models
model_cache = {}
scaler_cache = {}


class ForecastInput(BaseModel):
    job_id: str
    last_24_hours: list[float]


def load_model_from_s3(job_id):

    # check cache first
    if job_id in model_cache:
        return model_cache[job_id], scaler_cache[job_id]

    best_file = f"best_{job_id}.txt"
    model_file = f"model_{job_id}.keras"
    dataset_file = f"dataset_{job_id}.csv"

    # download best model name
    s3.download_file(
        BUCKET_NAME,
        f"results/{job_id}/best_model.txt",
        best_file
    )

    with open(best_file) as f:
        best_model_name = f.read().strip()

    # download actual model
    s3.download_file(
        BUCKET_NAME,
        f"models/{job_id}/{best_model_name}_model.keras",
        model_file
    )

    model = load_model(model_file)

    # download dataset to rebuild scaler
    s3.download_file(
        BUCKET_NAME,
        f"datasets/{job_id}/power_hourly.csv",
        dataset_file
    )

    df = pd.read_csv(dataset_file)

    df["consumption"] = pd.to_numeric(df["consumption"], errors="coerce")
    df = df.dropna()

    values = df["consumption"].values.reshape(-1, 1)

    scaler = MinMaxScaler()
    scaler.fit(values)

    # store in cache
    model_cache[job_id] = model
    scaler_cache[job_id] = scaler

    return model, scaler


@app.get("/")
def home():
    return {"message": "Forecast API running"}


@app.post("/forecast")
def forecast(data: ForecastInput):

    if len(data.last_24_hours) != 24:
        return {"error": "You must provide exactly 24 hourly values"}

    job_id = data.job_id

    model, scaler = load_model_from_s3(job_id)

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

    return {
        "job_id": job_id,
        "predicted_next_24_hours": predictions_inv.flatten().tolist(),
        "total_next_day_consumption": total_next_day
    }