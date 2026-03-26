# Architecture

This project follows a simple flow from user request to cloud storage.

## Flow
```text
User (HTTPS)
    ↓
Cloudflare
    ↓
EC2 Instance
    ↓
Docker Container (Node.js App)
    ↓
AWS SDK
    ↓
S3 Bucket
```

## Explanation

- The user accesses the application through a custom domain.
- Cloudflare handles DNS and HTTPS.
- Requests are forwarded to the EC2 instance.
- The application runs inside a Docker container.
- The backend uses the AWS SDK to upload and retrieve files from S3.
- Files are stored in an S3 bucket.

