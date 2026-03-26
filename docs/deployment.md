# Deployment

The application is deployed on an AWS EC2 instance using Docker.

## How Deployment Works

1. The application is containerized using a Dockerfile.
2. A docker-compose.yml file is used to define and run the container.
3. The container exposes the application on port 80.
4. The EC2 instance serves incoming traffic from the internet.

## Important Points

- The server does not store the application source code.
- The application is deployed using a pre-built Docker image.
- Environment variables are stored securely on the server using a `.env` file.
- Docker Compose manages the container lifecycle (start, stop, restart).
- New deployments update the container by pulling the latest image and restarting it.
