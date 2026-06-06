from fastapi import FastAPI, UploadFile, File
import boto3
import uuid
from prometheus_fastapi_instrumentator import Instrumentator

app = FastAPI()

Instrumentator().instrument(app).expose(app)

BUCKET_NAME = "power-forecast-dinesh"

s3 = boto3.client("s3")

@app.get("/")
def home():
    return {"message": "Power MLOps API is running"}

@app.post("/upload-data")
async def upload_data(file: UploadFile = File(...)):

    job_id = str(uuid.uuid4())[:8]

    s3_path = f"datasets/{job_id}/power_hourly.csv"

    s3.upload_fileobj(file.file, BUCKET_NAME, s3_path)

    return {
        "status": "uploaded successfully",
        "job_id": job_id,
        "s3_path": s3_path
    }