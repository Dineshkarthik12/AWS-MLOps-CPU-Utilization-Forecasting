# Cloud-Based MLOps System for Electricity Consumption Forecasting

This project implements an end-to-end MLOps pipeline using AWS and deep learning
to automatically retrain models and deploy forecasts for electricity usage.

## Features
- API-based dataset upload using FastAPI
- S3-triggered automated retraining
- LSTM, BiLSTM, CNN model comparison
- Automatic best-model selection using RMSE
- Cloud-based model registry in Amazon S3
- Forecast API for next-day electricity consumption

## Tech Stack
- AWS: S3, EC2, Lambda, Systems Manager
- Python, TensorFlow, Scikit-learn
- FastAPI
- Docker (optional)

## Workflow
Upload data → S3 → Lambda → EC2 training → Best model → Forecast API

## Forecast API
Input: Last 24 hours of power consumption  
Output: Total predicted power for next day
