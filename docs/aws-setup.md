# AWS Setup

This project uses AWS services for hosting the application and storing uploaded files.

## EC2

- Used to host the application
- Runs Docker and Docker Compose
- Exposes the application on port 80 to the internet

## S3

- Stores uploaded files
- Provides scalable and durable object storage
- Used by the application to upload and retrieve files

## IAM

- An IAM role is attached to the EC2 instance
- The application uses this role to access S3
- No AWS credentials are stored in the code or environment variables

## Why IAM roles?

- More secure than using access keys
- No secrets are stored in the application
- Permissions are managed centrally by AWS
