# FeedStream PWA

A minimal Progressive Web App for private feed reading, built with SvelteKit and Fastify.

## Architecture

- **Frontend**: SvelteKit + TypeScript (static output)
- **Backend**: Fastify + TypeScript + SQLite
- **Deployment**: Docker Compose + Caddy (with Tailscale)

## Project Structure

```
FeedStream-PWA/
├── web/              # SvelteKit frontend
│   ├── src/
│   │   ├── routes/   # Pages and layouts
│   │   └── app.html  # HTML template
│   ├── static/       # Static assets (icons, manifest, service worker)
│   └── build/        # Production build output (generated)
├── api/              # Fastify backend
│   ├── src/
│   │   └── index.ts  # Main server file
│   └── Dockerfile
├── docker-compose.yml
├── Caddyfile
└── .gitignore
```

## Next Steps

### 1. Install Dependencies

```bash
# Frontend
cd web
npm install

# Backend
cd ../api
npm install
cd ..
```

### 2. Development Mode (Optional)

Test locally before building for production:

```bash
# Terminal 1 - Backend
cd api
npm run dev

# Terminal 2 - Frontend
cd web
npm run dev
```

Visit http://localhost:5173 (frontend dev server will proxy `/api` to backend).

### 3. Build for Production

```bash
# Build frontend static files
cd web
npm run build
# This creates web/build/ folder

# Build backend (optional - Docker will do this)
cd ../api
npm run build
cd ..
```

### 4. Deploy with Docker

```bash
# From FeedStream-PWA/ root
docker-compose up -d
```

**What to expect:**
- API will be available at http://127.0.0.1:3000/health (locally)
- Caddy will serve the app at https://feedstream.swallow-cliff.ts.net
- SQLite database will persist in a Docker volume at `/data/feedstream.sqlite`
- Service worker will register on first visit (production only)

### 5. Verify Deployment

Visit https://feedstream.swallow-cliff.ts.net in your browser:
- You should see "FeedStream - Private feed reader"
- Click "Health check" button
- You should see JSON response: `{ "ok": true, "time": "..." }`

### 6. Check Logs

```bash
# View all logs
docker-compose logs -f

# View specific service
docker-compose logs -f api
docker-compose logs -f caddy
```

### 7. Stop Services

```bash
docker-compose down

# To also remove volumes (database will be deleted!)
docker-compose down -v
```

## Notes

- **Static Output**: The frontend builds to `web/build/` as configured in `svelte.config.js`
- **API Prefix**: Caddy strips `/api` prefix before proxying to backend
- **Service Worker**: Only registers in production builds (not in dev mode)
- **Icons**: Replace placeholder files in `web/static/icons/` with actual PNG icons
- **Database**: Persists in Docker volume; survives container restarts

## Customization

- **Change hostname**: Edit `Caddyfile` line 1
- **Change port**: Edit `docker-compose.yml` API service environment
- **Add routes**: Create new files in `web/src/routes/`
- **Add API endpoints**: Edit `api/src/index.ts`
