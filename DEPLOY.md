# FeedStream PWA - Deployment Guide

## Architecture
The deployment uses pre-built Docker images hosted on GitHub Container Registry (GHCR):
- **api**: `ghcr.io/<owner>/feedstream-api:latest`
- **web**: `ghcr.io/<owner>/feedstream-web:latest` (Contains Caddy + Static Frontend)

## Workflow

1.  **Develop & Push (MacOS)**
    - Commit changes and push to GitHub master/main.
    - GitHub Actions automatically builds and pushes Docker images to GHCR.

2.  **Deploy (Ubuntu Server / Dockge)**
    - Ensure your `docker-compose.yml` uses the image references above.
    - Click "Pull Images" then "Update/Redeploy" in Dockge.
    - **No manual git pull, build, or npm commands required on the server.**

## Initial Setup (Ubuntu)

1.  **Authenticate with GHCR**:
    ```bash
    # Use a GitHub PAT with read:packages scope
    echo $CR_PAT | docker login ghcr.io -u USERNAME --password-stdin
    ```

2.  **Docker Compose**:
    Use the `docker-compose.yml` from the repository, ensuring `<owner>` is replaced with your GitHub username (lowercase).

    ```yaml
    services:
      api:
        image: ghcr.io/username/feedstream-api:latest
        ...
      web:
        image: ghcr.io/username/feedstream-web:latest
        network_mode: host
        environment:
          - DOMAIN_NAME=https://your-domain.ts.net:443
        ...
    ```

3.  **Start**:
    ```bash
    docker compose up -d
    ```

## Environment Variables

- `PORT`: API internal port (default 3060)
- `NODE_ENV`: production
- `DOMAIN_NAME`: Full URL for Caddy (e.g. `https://machine.ts.net:443`)

## Volumes
- `feedstream-data`: Persists SQLite database
- `caddy-data`: Caddy certificates
- `caddy-config`: Caddy configuration

## Tailscale
The `web` service runs in `network_mode: host` to access the Tailscale socket on the host machine for HTTPS certificates. Ensure `/var/run/tailscale/tailscaled.sock` is mounted.
