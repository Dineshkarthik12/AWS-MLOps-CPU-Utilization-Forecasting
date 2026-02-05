import pandas as pd
import numpy as np
import math
import json
import subprocess
from sklearn.preprocessing import MinMaxScaler
from sklearn.metrics import mean_squared_error
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Conv1D, MaxPooling1D, Flatten, Bidirectional, Input

# ==========================
# CONFIG
# ==========================
BUCKET_NAME = "power-forecast-dinesh"   

# ==========================
# Load and clean data
# ==========================
df = pd.read_csv("power_hourly.csv")
df["consumption"] = pd.to_numeric(df["consumption"], errors="coerce")
df = df.dropna()

values = df["consumption"].values.reshape(-1, 1)
values = np.clip(values, 0, np.percentile(values, 99))

scaler = MinMaxScaler()
scaled = scaler.fit_transform(values)

def create_dataset(data, look_back=24):
    X, y = [], []
    for i in range(len(data) - look_back):
        X.append(data[i:i+look_back, 0])
        y.append(data[i+look_back, 0])
    return np.array(X), np.array(y)

look_back = 24
X, y = create_dataset(scaled, look_back)
X = X.reshape((X.shape[0], X.shape[1], 1))

train_size = int(len(X) * 0.8)
X_train, X_test = X[:train_size], X[train_size:]
y_train, y_test = y[:train_size], y[train_size:]

# ==========================
# Models
# ==========================
def build_lstm():
    model = Sequential([Input(shape=(look_back,1)), LSTM(32), Dense(1)])
    model.compile(optimizer="adam", loss="mse")
    return model

def build_bilstm():
    model = Sequential([Input(shape=(look_back,1)), Bidirectional(LSTM(32)), Dense(1)])
    model.compile(optimizer="adam", loss="mse")
    return model

def build_cnn():
    model = Sequential([
        Input(shape=(look_back,1)),
        Conv1D(32, kernel_size=2, activation="relu"),
        MaxPooling1D(pool_size=2),
        Flatten(),
        Dense(32, activation="relu"),
        Dense(1)
    ])
    model.compile(optimizer="adam", loss="mse")
    return model

models = {
    "LSTM": build_lstm(),
    "BiLSTM": build_bilstm(),
    "CNN": build_cnn()
}

# ==========================
# Train models
# ==========================
results = []

for name, model in models.items():
    print(f"\nTraining {name}...")
    model.fit(X_train, y_train, epochs=10, batch_size=64, verbose=1)

    preds = model.predict(X_test)
    preds_inv = scaler.inverse_transform(preds)
    y_test_inv = scaler.inverse_transform(y_test.reshape(-1,1))

    rmse = math.sqrt(mean_squared_error(y_test_inv, preds_inv))
    print(f"{name} RMSE: {rmse}")

    model.save(f"{name}_model.keras")
    results.append({"model": name, "rmse": rmse})

# ==========================
# Save results
# ==========================
results_df = pd.DataFrame(results)
results_df.to_csv("results.csv", index=False)

with open("results.json", "w") as f:
    json.dump(results, f, indent=4)

best_model = min(results, key=lambda x: x["rmse"])
with open("best_model.txt", "w") as f:
    f.write(best_model["model"])

print("Best model:", best_model)

# ==========================
# Upload to S3
# ==========================
print("Uploading to S3...")

subprocess.run(["aws", "s3", "cp", "results.csv", f"s3://{BUCKET_NAME}/results/results.csv"])
subprocess.run(["aws", "s3", "cp", "results.json", f"s3://{BUCKET_NAME}/results/results.json"])
subprocess.run(["aws", "s3", "cp", "best_model.txt", f"s3://{BUCKET_NAME}/results/best_model.txt"])

subprocess.run(["aws", "s3", "cp", "LSTM_model.keras", f"s3://{BUCKET_NAME}/models/LSTM_model.keras"])
subprocess.run(["aws", "s3", "cp", "BiLSTM_model.keras", f"s3://{BUCKET_NAME}/models/BiLSTM_model.keras"])
subprocess.run(["aws", "s3", "cp", "CNN_model.keras", f"s3://{BUCKET_NAME}/models/CNN_model.keras"])

print("Upload complete.")
