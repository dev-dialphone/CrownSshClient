# Deployment Guide

## Overview

The SSH Client Manager is deployed using Docker containers with automatic CI/CD via GitHub Actions.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                       Docker Host                            │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              frontend (Nginx)                         │    │
│  │              Port: 7001 (public)                      │    │
│  │  ┌─────────────────────────────────────────────────┐ │    │
│  │  │  - Serves React static files                     │ │    │
│  │  │  - Reverse proxy /api/* → backend:7002           │ │    │
│  │  │  - WebSocket proxy /ws → backend:7002            │ │    │
│  │  │  - SSL termination (if configured)               │ │    │
│  │  └─────────────────────────────────────────────────┘ │    │
│  └────────────────────────┬────────────────────────────┘    │
│                           │                                  │
│  ┌────────────────────────▼────────────────────────────┐    │
│  │              backend (Express.js)                     │    │
│  │              Port: 7002 (internal)                    │    │
│  │  ┌─────────────────────────────────────────────────┐ │    │
│  │  │  - REST API                                      │ │    │
│  │  │  - WebSocket server                              │ │    │
│  │  │  - SSH connections                               │ │    │
│  │  │  - BullMQ workers                                │ │    │
│  │  └─────────────────────────────────────────────────┘ │    │
│  └────────────────────────┬────────────────────────────┘    │
│                           │                                  │
│  ┌────────────────────────▼────────────────────────────┐    │
│  │              redis                                   │    │
│  │              Port: 6379 (internal)                   │    │
│  │  ┌─────────────────────────────────────────────────┐ │    │
│  │  │  - Session store                                 │ │    │
│  │  │  - BullMQ queues                                 │ │    │
│  │  │  - Caching                                       │ │    │
│  │  └─────────────────────────────────────────────────┘ │    │
│  └──────────────────────────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Prerequisites

### Server Requirements

| Requirement | Minimum | Recommended |
|-------------|---------|-------------|
| CPU | 1 vCPU | 2 vCPU |
| RAM | 1 GB | 2 GB |
| Storage | 10 GB | 20 GB |
| OS | Ubuntu 20.04+ | Ubuntu 22.04 LTS |

### External Services

| Service | Purpose |
|---------|---------|
| MongoDB | Database (MongoDB Atlas recommended) |
| Google Cloud Console | OAuth credentials |
| SMTP Server | Email notifications |

### Software Requirements

- Docker 20.10+
- Docker Compose 2.0+
- Git

---

## Environment Variables

### Required Variables

```env
# Google OAuth
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret

# Application URL
FRONTEND_URL=https://your-domain.com

# Database
mongo=mongodb+srv://user:pass@cluster.mongodb.net/db

# Security
ENCRYPTION_KEY=64_char_hex_string
SESSION_SECRET=random_secret_string
VITE_REQUIRED_PIN=user_pin
VITE_ADMIN_PIN=admin_pin
```

### Optional Variables

```env
# IP Whitelist
ALLOWED_IPS=192.168.1.0/24,10.0.0.0/8

# Email (can also be configured in admin panel)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASSWORD=app_password
SMTP_FROM_NAME=SSH Manager
SMTP_FROM_EMAIL=noreply@domain.com
```

---

## Docker Services

### docker-compose.yml

```yaml
services:
  backend:
    container_name: crownsshclient-backend
    build:
      context: .
      dockerfile: Dockerfile.backend
    expose:
      - "7002"
    env_file:
      - .env
    environment:
      - PORT=7002
      - NODE_ENV=production
      - REDIS_HOST=redis
    networks:
      - app-network
    depends_on:
      - redis
    restart: unless-stopped

  redis:
    image: redis:alpine
    container_name: crownsshclient-redis
    expose:
      - "6379"
    networks:
      - app-network
    restart: unless-stopped

  frontend:
    build:
      context: .
      dockerfile: Dockerfile.frontend
      args:
        - BACKEND_PORT=7002
        - VITE_REQUIRED_PIN=${VITE_REQUIRED_PIN}
    ports:
      - "7001:80"
    networks:
      - app-network
    depends_on:
      - backend
    restart: unless-stopped

networks:
  app-network:
    driver: bridge
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

**File:** `.github/workflows/deploy.yml`

**Triggers:**
- Push to `main` branch

**Steps:**

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout code
        uses: actions/checkout@v3

      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.HOST }}
          username: ${{ secrets.USERNAME }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /path/to/app
            git pull origin main
            docker compose down
            docker compose build --no-cache
            docker compose up -d
```

### Required GitHub Secrets

| Secret | Description |
|--------|-------------|
| `HOST` | Server IP or hostname |
| `USERNAME` | SSH username |
| `SSH_KEY` | Private SSH key for server access |

---

## Initial Deployment

### Step 1: Prepare Server

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin -y
```

### Step 2: Clone Repository

```bash
git clone https://github.com/your-org/ssh-client.git
cd ssh-client
```

### Step 3: Create Environment File

```bash
cp .env.example .env
nano .env
```

Fill in all required variables.

### Step 4: Configure Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create OAuth 2.0 credentials
3. Add authorized redirect URI:
   ```
   https://your-domain.com/api/auth/google/callback
   ```
4. Copy Client ID and Secret to `.env`

### Step 5: Create MongoDB Database

1. Create cluster at [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Create database user
3. Whitelist server IP (or use 0.0.0.0/0 for all)
4. Get connection string
5. Add to `.env` as `mongo=`

### Step 6: Generate Security Keys

```bash
# Encryption key (64 hex chars)
openssl rand -hex 32

# Session secret
openssl rand -base64 32
```

### Step 7: Build and Start

```bash
docker compose up -d --build
```

### Step 8: Verify Deployment

```bash
# Check containers
docker compose ps

# Check logs
docker compose logs -f backend
docker compose logs -f frontend
```

---

## Updating

### Automatic (CI/CD)

Push to `main` branch triggers automatic deployment.

### Manual

```bash
cd /path/to/app
git pull origin main
docker compose down
docker compose build --no-cache
docker compose up -d
```

---

## SSL Configuration

### Option 1: Nginx Reverse Proxy (Recommended)

Use external Nginx with Let's Encrypt:

```nginx
server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:7001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### Option 2: Built-in SSL

Modify `nginx.conf` in frontend container to include SSL.

---

## Monitoring

### Container Health

```bash
# Container status
docker compose ps

# Resource usage
docker stats

# Logs
docker compose logs -f --tail=100
```

### Application Health

```bash
# Backend health
curl http://localhost:7001/api/health

# Redis connection
docker compose exec redis redis-cli ping
```

---

## Troubleshooting

### Container Won't Start

```bash
# Check logs
docker compose logs backend
docker compose logs frontend

# Check environment
docker compose config

# Rebuild from scratch
docker compose down -v
docker compose build --no-cache
docker compose up -d
```

### Database Connection Issues

```bash
# Test MongoDB connection
docker compose exec backend node -e "
const mongoose = require('mongoose');
mongoose.connect(process.env.mongo)
  .then(() => console.log('Connected'))
  .catch(e => console.error(e));
"
```

### Session Issues

```bash
# Clear Redis sessions
docker compose exec redis redis-cli FLUSHALL
```

### SSH Connection Failures

1. Verify VM credentials in database
2. Check firewall allows outbound SSH (port 22)
3. Verify encryption key is correct
4. Check VM is reachable from server

---

## Backup & Recovery

### Database Backup

```bash
# Using mongodump
mongodump --uri="mongodb+srv://..." --out=/backup/$(date +%Y%m%d)
```

### Environment Backup

```bash
# Backup .env
cp .env .env.backup.$(date +%Y%m%d)
```

### Full Recovery

```bash
# Restore database
mongorestore --uri="mongodb+srv://..." /backup/20260305

# Restart containers
docker compose restart
```

---

## Scaling Considerations

### Horizontal Scaling

1. Use external Redis cluster
2. Use MongoDB replica set
3. Deploy multiple backend instances behind load balancer
4. Use sticky sessions for WebSocket

### Resource Limits

Add to docker-compose.yml:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '1'
          memory: 1G
```

---

## Security Checklist

- [ ] HTTPS enabled
- [ ] Strong encryption key generated
- [ ] Session secret is random
- [ ] MongoDB user has limited permissions
- [ ] IP whitelist configured (if needed)
- [ ] Firewall allows only port 7001 (or 80/443)
- [ ] SSH key authentication for server
- [ ] Regular backups scheduled
- [ ] Dependencies updated

---

## Environment-Specific Configurations

### Development

```env
NODE_ENV=development
# Verbose logging
DEBUG=*
```

### Staging

```env
NODE_ENV=production
FRONTEND_URL=https://staging.your-domain.com
```

### Production

```env
NODE_ENV=production
FRONTEND_URL=https://your-domain.com
# Enable all security features
```
