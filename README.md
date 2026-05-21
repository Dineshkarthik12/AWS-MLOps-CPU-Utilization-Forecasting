# Cloud-Based MLOps System for CPU Utilization Forecasting

This repository contains an end-to-end MLOps pipeline designed to automate the lifecycle of deep learning models for forecasting CPU utilization. The system leverages AWS infrastructure to manage dataset ingestion, automated model retraining, model evaluation, and deployment of a forecasting API.

## Key Features

- **Automated Dataset Ingestion**: A FastAPI-based service handles the secure upload of datasets to Amazon S3.
- **Event-Driven Retraining**: Dataset uploads trigger AWS Lambda, which initiates a training job on an Amazon EC2 instance via Systems Manager.
- **Model Comparison**: Automatically trains and evaluates multiple neural network architectures (LSTM, BiLSTM, and CNN).
- **Intelligent Model Selection**: Dynamically selects the best-performing model based on the lowest Root Mean Square Error (RMSE).
- **Cloud Model Registry**: Trained models and evaluation metrics are automatically versioned and stored in Amazon S3.
- **Real-Time Forecast API**: Deploys a dedicated FastAPI endpoint that consumes the past 24 hours of CPU utilization data and predicts the subsequent 24-hour utilization trend.

## Technology Stack

- **Cloud Provider**: Amazon Web Services (S3, EC2, Lambda, Systems Manager)
- **Machine Learning**: Python, TensorFlow/Keras, Scikit-learn, Pandas, NumPy
- **Backend APIs**: FastAPI, Uvicorn, Boto3
- **Frontend**: Vanilla HTML/CSS/JavaScript, Chart.js
- **Deployment**: Nginx, Vercel

## System Architecture & Workflow

1. **Ingestion**: The user uploads a CPU utilization dataset (`.csv`) via the Upload API or the frontend interface.
2. **Storage**: The dataset is securely saved in an S3 bucket.
3. **Trigger**: An S3 event notification triggers an AWS Lambda function.
4. **Training**: Lambda uses AWS Systems Manager (SSM) to execute the training script (`train_models.py`) on a dedicated EC2 instance.
5. **Evaluation**: The script trains LSTM, BiLSTM, and CNN models, compares their RMSE, and determines the optimal model.
6. **Registry**: The best model and metrics are uploaded back to S3.
7. **Inference**: The Forecast API loads the updated best model from S3 and serves real-time predictions.

## Deployment Guide

The architecture separates the backend inference/upload services from the static frontend application.

### Backend Deployment (AWS EC2)

The backend consists of two FastAPI services that must be run on your EC2 instance:
1. **Upload API** (Port 8000)
2. **Forecast API** (Port 9000)

Start both services on your EC2 instance using Uvicorn (or a process manager like systemd/pm2):
```bash
uvicorn app:app --host 0.0.0.0 --port 8000 &
uvicorn forecast_api:app --host 0.0.0.0 --port 9000 &
```
*Note: Ensure your EC2 Security Group allows inbound traffic on ports 8000 and 9000.*

### Frontend Deployment (Vercel)

The frontend is a static single-page application located in the `frontend/` directory. It is designed to be deployed seamlessly on **Vercel**. 

1. Push this repository to GitHub.
2. Go to [Vercel](https://vercel.com/new) and import the repository.
3. In the project configuration, set the **Root Directory** to `frontend`.
4. Deploy the application.

**CORS & Proxying**: The `frontend/vercel.json` file is pre-configured with URL rewrites. It automatically proxies `/api/upload` and `/api/forecast` requests from Vercel directly to your EC2 backend, completely eliminating CORS issues without requiring any backend modifications.

*(Optional)* If you prefer to host the frontend directly on the EC2 instance alongside the APIs, use the provided `deploy.sh` script in the `frontend/` directory to configure an Nginx reverse proxy.
