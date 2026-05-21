from fastapi import FastAPI, UploadFile, File
import boto3

app = FastAPI()

BUCKET_NAME = "power-forecast-dinesh"

s3 = boto3.client("s3")

@app.get("/")
def home():
    return {"message": "Power MLOps API is running"}

@app.post("/upload-data")
async def upload_data(file: UploadFile = File(...)):
    s3_path = f"data/{file.filename}"

    s3.upload_fileobj(file.file, BUCKET_NAME, s3_path)

    return {
        "status": "uploaded successfully",
        "s3_path": s3_path
    }
