# FeedStream PWA - Deployment Guide

## Ubuntu Server Deployment

### Prerequisites
- Docker and Docker Compose installed
- Tailscale configured on the host
- Git installed

### Quick Deployment

**Single Command:**
```bash
cd /opt/stacks/feedstreampwa
./scripts/deploy.sh
```

**What the script does:**
1. 📥 Pulls latest code from git
2. 🔨 Builds Docker images with latest base images
3. 🎨 Runs web builder to refresh frontend in volume
4. 🚀 Starts/updates API and Caddy services
5. 🔄 Restarts Caddy to serve new frontend
6. 📊 Shows deployment status

### Manual Deployment (if needed)

```bash
# 1. Pull latest code
git pull

# 2. Build images
docker compose build --pull

# 3. Build frontend (refreshes web-build volume)
docker compose run --rm web

# 4. Start/update services
docker compose up -d api caddy

# 5. Restart Caddy
docker compose restart caddy

# 6. Check status
docker compose ps
```

### Important Notes

- **No npm required on host**: All builds happen inside Docker
- **Frontend refresh**: `docker compose run --rm web` rebuilds and updates the volume
- **Volume persistence**: `web-build` volume persists between deployments
- **Clean builds**: Use `--pull` to get latest base images

### What Happens During Deployment

1. **Web Service** (`web`):
   - Uses Debian-based Node.js 20 image for deterministic builds
   - Copies `package.json` and `package-lock.json` first (layer caching)
   - Runs `npm ci` for reproducible dependency installation
   - Copies source code and runs `npm run build`
   - Outputs static files to `/out` directory
   - `/out` is mounted to `web-build` named volume
   - Container exits after build completes

2. **API Service** (`api`):
   - Builds Node.js backend
   - Starts on port 3060 (localhost only)
   - Uses `feedstream-data` volume for SQLite database

3. **Caddy Service** (`caddy`):
   - Serves static files from `web-build` volume
   - Proxies `/api/*` requests to backend
   - Handles HTTPS via Tailscale
   - Runs on host network mode

### Important Notes

- **No npm required on host**: All builds happen inside Docker
- **No node_modules on host**: Dependencies installed in container
- **Fresh builds**: `--build` flag ensures latest code is built
- **Persistent data**: Database stored in Docker volume

### Viewing Logs

```bash
# All services
docker compose logs -f

# Specific service
docker compose logs -f api
docker compose logs -f caddy
docker compose logs web  # Build logs (exits after build)
```

### Troubleshooting

**Frontend not updating:**
```bash
# Force rebuild web service
docker compose build --no-cache web
docker compose up -d web
docker compose restart caddy
```

**Clear all data and start fresh:**
```bash
docker compose down -v  # WARNING: Deletes database!
docker compose up -d --build
```

**Check build output:**
```bash
# Inspect web-build volume
docker run --rm -v feedstreampwa_web-build:/data alpine ls -la /data
```

### File Structure

```
/opt/stacks/feedstreampwa/
├── api/
│   ├── Dockerfile
│   ├── package.json
│   └── src/
├── web/
│   ├── Dockerfile          # Frontend build container
│   ├── package.json
│   └── src/
├── docker-compose.yml      # Service orchestration
├── Caddyfile              # Web server config
└── DEPLOY.md              # This file
```

### Volumes

- `feedstream-data`: SQLite database and API data
- `web-build`: Built frontend static files
- `caddy-data`: Caddy certificates and data
- `caddy-config`: Caddy configuration

### Ports

- `443`: HTTPS (Caddy, host network mode)
- `3060`: API (localhost only, not exposed)

### Environment

The deployment uses:
- Node.js 20 Alpine for builds
- Production mode for API
- Tailscale for HTTPS

### Updates

To update to the latest version:

```bash
git pull
docker compose up -d --build
docker compose restart caddy
```

That's it! No npm, no node_modules, no manual builds.
