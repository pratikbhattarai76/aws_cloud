# 🚀 MalaiDeu – AWS File Upload & Storage System

A cloud-based file upload and storage system built on AWS, demonstrating end-to-end DevOps practices including Infrastructure as Code, containerized deployment, and automated CI/CD pipelines.

The application allows users to upload, organize, browse, and retrieve files using Amazon S3 through a Node.js and Express backend. It is deployed on AWS using Docker, provisioned with Terraform, configured with Ansible, and exposed through a load-balanced architecture.

---

## 🔗 Live Demo
### MalaiDeu
https://malaideu.pratik-labs.xyz
### Test
https://test.pratik-labs.xyz

---

## Architecture Diagram

The following diagram illustrates the end-to-end system architecture:

![Flow Architecture](docs/architecture/architecture.png)

---

## 📌 Project Overview

This project demonstrates a complete DevOps workflow, covering:

- Infrastructure as Code (Terraform – EC2, ALB, S3, IAM, Security Groups)
- Configuration Management (Ansible – server bootstrap & deployment setup)
- Containerized application deployment (Docker)
- Automated CI/CD pipeline (GitHub Actions)
- Image registry integration (GHCR)
- Domain routing and HTTPS (Cloudflare + AWS ALB)
- Multi-Service routing

The system separates infrastructure, configuration, and application deployment for maintainability and scalability.

---

## 🔀 Multi-Service Routing

This project also demonstrates host-based routing using a single AWS Application Load Balancer (ALB).

Two services are deployed behind the same ALB:

- `malaideu.pratik-labs.xyz` → Main application (Node.js app on port 8080)
- `test.pratik-labs.xyz` → Test application (Nginx container on port 8081)

The ALB uses host header rules to route traffic to the correct target group.

### Routing Flow

```text
User request
    ↓
Cloudflare DNS
    ↓
AWS ALB (HTTPS 443)
malaideu.pratik-labs.xyz → malaideu-tg → EC2:8080
test.pratik-labs.xyz     → test-tg     → EC2:8081
```

---

## ✨ Features

- Upload multiple files through the web interface
- Upload folders while preserving folder structure
- Create and manage nested folders
- Upload files into selected folders
- Store files securely in AWS S3
- Browse, download, and manage uploaded files
- Rename files before upload
- Server-side rendering using EJS
- Containerized deployment using Docker
- Automated deployment via CI/CD pipeline

---

## 💻 Local Run

```bash
cd app/src
npm install
npm start
```
---

## 🏗️ Architecture

### Request Flow

```text
User
    ↓
Cloudflare
    ↓
AWS Application Load Balancer
    ↓
Target Group
    ↓
EC2 Instance
    ↓
Docker Container
    ↓
Malaideu Application
    ↓
AWS SDK
    ↓
S3 Bucket
```

---

## 🔐 Security & Networking

- The Application Load Balancer (ALB) acts as the public entry point and handles all incoming traffic
- Security Groups are configured to enforce strict access control:
  - ALB allows inbound traffic on ports **80 (HTTP)** and **443 (HTTPS)** from the internet
  - EC2 instance allows application traffic only from the ALB security group
- Direct public access to the application port is restricted, ensuring traffic flows only through the ALB
- SSH access is controlled via a configurable CIDR block for secure administrative access
- IAM role is attached to the EC2 instance to securely interact with AWS services
- No AWS credentials are stored in the application code or repository
- Cloudflare is used for DNS resolution and acts as an additional security layer at the edge

---

## ⚙️ Tech Stack

- **Infrastructure as Code:** Terraform
- **Configuration Management:** Ansible
- **Cloud Services:** AWS EC2, S3, IAM, ALB
- **Backend:** Node.js, Express.js
- **Templating Engine:** EJS
- **File Handling:** Multer
- **Cloud SDK:** AWS SDK v3
- **Containerization:** Docker, Docker Compose
- **CI/CD:** GitHub Actions, GHCR
- **Networking & Security:** Cloudflare

---

## 🚀 CI/CD Workflow

On every push to the `main` branch:

```text
git push
    ↓
GitHub Actions workflow triggered
    ↓
Install dependencies (verification step)
    ↓
Build Docker image
    ↓
Push image to GitHub Container Registry (GHCR)
    ↓
SSH into EC2 instance
    ↓
Pull latest image
    ↓
Restart container using Docker Compose
```

---

## 🌐 Deployment Details

- Application is deployed on an AWS EC2 instance using Docker
- AWS Application Load Balancer (ALB) acts as the public entry point and distributes incoming traffic
- Domain is managed via Cloudflare DNS and points to the ALB
- HTTPS is configured manually using AWS ACM and an ALB HTTPS listener
- HTTP traffic is redirected to HTTPS at the load balancer level
- Application is exposed on EC2 port 8080 and mapped to container port 3000
- Environment variables are securely stored on the server and not committed to the repository
- Application interacts with S3 using an IAM role attached to the EC2 instance (no hardcoded credentials)

---

## 🏗️ Infrastructure as Code

Infrastructure is defined using Terraform.

Terraform provisions:

- EC2 instance (application server)
- Application Load Balancer (ALB)
- Target Group for routing traffic
- S3 bucket for file storage
- IAM role and instance profile for secure access
- Security groups for controlled network access

This ensures reproducible infrastructure and avoids manual configuration.

---

## ⚙️ Configuration Management

Ansible is used after provisioning to configure the EC2 instance:

- Installs Docker and required dependencies
- Configures Docker environment
- Creates application directories
- Copies Docker Compose and environment files
- Prepares the server for deployment

---

## 🧠 What I Learned

- Designing and deploying a real-world cloud architecture on AWS
- Using Terraform to provision infrastructure declaratively
- Separating infrastructure provisioning and server configuration
- Deploying containerized applications using Docker
- Understanding ALB, target groups, and request routing
- Implementing host-based routing using AWS ALB
- Serving multiple applications behind a single load balancer
- Understanding listener rules, pririties, and target groups
- Applying container resource limits in Docker Compose
- Implementing CI/CD pipelines for automated deployment
- Using IAM roles instead of hardcoded credentials
- Managing DNS and HTTPS in production environments

## Future Improvements
- Convert HTTPS setup into fully terraform
---

