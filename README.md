# 🚀 MalaiDeu – AWS File Upload & Storage System

A cloud-based file upload system where users can upload and retrieve files using AWS S3.  
The application is built with Node.js and Express, containerized with Docker, and deployed using a CI/CD pipeline with GitHub Actions.

---

## 🔗 Live Demo

https://malaideu.pratik-labs.xyz

---

## 📌 Project Overview

This project demonstrates an end-to-end DevOps workflow, covering:

* Cloud infrastructure (AWS EC2, S3, IAM)
* Containerized application deployment (Docker)
* Automated CI/CD pipeline (GitHub Actions)
* Image registry integration (GHCR)
* Domain routing and HTTPS (Cloudflare)

---

## ✨ Features

- Upload multiple files through the web interface
- Upload a folder from your device and keep its folder structure
- Create folders and nested folders from the website
- Upload files into a selected folder for better organization
- Store files securely in AWS S3
- Browse folders, open files, and download files
- Rename files before upload
- Server-side rendering using EJS
- Containerized deployment using Docker
- Automated deployment via CI/CD pipeline

---

## 💻 Local Run

From the project root:

```bash
npm install
npm start
```

The app loads environment variables from `app/src/.env`.

Minimum required variables:

- `AWS_REGION`
- `S3_BUCKET_NAME`

Optional variables:

- `PORT`
- `S3_PREFIX`
- `MAX_FILE_SIZE_MB`
- `MAX_FILE_COUNT`
- `MAX_LIST_COUNT`

Current upload behavior:

- Up to `10` files per upload by default
- Each file can be up to `20 MB` by default

You can also run the app directly from `app/src`:

```bash
cd app/src
npm start
```

---

## 🏗️ Architecture
The application follows a simple request flow from user to cloud storage:

```text
User (HTTPS)
    ↓
Cloudflare
    ↓
EC2 Instance
    ↓
Docker Container
    ↓
AWS SDK
    ↓
S3 Bucket
```

---

## ⚙️ Tech Stack

- **Cloud:** AWS EC2, AWS S3, IAM  
- **Backend:** Node.js, Express.js  
- **Templating:** EJS  
- **File Handling:** Multer  
- **Cloud SDK:** AWS SDK v3  
- **Containerization:** Docker, Docker Compose  
- **CI/CD:** GitHub Actions, GHCR  
- **Automation:** Ansible  
- **Networking & Security:** Cloudflare (DNS + SSL)

---

## 🚀 CI/CD Workflow

On every push to the main branch:

```text
git push
    ↓
GitHub Actions runs pipeline
    ↓
Build Docker image
    ↓
Push image to GHCR
    ↓
SSH into EC2
    ↓
Pull latest image
    ↓
Restart container
```

---

## 🌐 Deployment Details

* Application runs on AWS EC2 using Docker
* Domain managed via Cloudflare
* HTTPS enabled using Cloudflare Flexible SSL
* Environment variables stored securely on the server
* Application interacts with S3 using an IAM role (no hardcoded credentials)

---

## 🧠 What I Learned

- How to deploy a real application on AWS using Docker
- Difference between building locally vs deploying using images
- How CI/CD automates deployment
- How IAM roles are used instead of hardcoding credentials
- Basics of DNS and HTTPS using Cloudflare

---
