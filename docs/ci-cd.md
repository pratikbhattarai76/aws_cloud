# CI/CD Pipeline

This project uses GitHub Actions to automate building and deploying the application.

## Pipeline Flow

```text
git push
    ↓
GitHub Actions runs workflow
    ↓
Install dependencies (Verification Step)
    ↓
Build Docker image
    ↓
Push image to GHCR
    ↓
GitHub Actions connects to EC2 over SSH
    ↓
EC2 runs docker compose pull
    ↓
EC2 restarts the container
```
## Key Ideas

- The pipeline runs automatically on every push to the main branch.
- GitHub Actions builds and pushes the Docker image to GHCR.
- Deployment is triggered remotely using SSH from GitHub Actions.
- The EC2 server pulls the latest image instead of rebuilding the application.
- The application is deployed using Docker Compose for consistent runtime behaviour.
- The server does not store or use application source code during deployment.

