# System Architecture

## Overview

SSH Client Manager is a full-stack web application for managing SSH connections to virtual machines across multiple environments.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (Browser)                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │  React App (Vite + TypeScript)                                          │ │
│  │  - TailwindCSS for styling                                               │ │
│  │  - Zustand for state management                                          │ │
│  │  - WebSocket client for real-time updates                                │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ HTTPS/WSS
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           NGINX (Reverse Proxy)                               │
│  - SSL Termination                                                            │
│  - Static file serving (frontend)                                             │
│  - Proxy /api/* to backend                                                    │
│  - WebSocket proxy                                                            │
│  Port: 7001                                                                   │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         EXPRESS.JS BACKEND                                    │
│  Port: 7002 (internal)                                                        │
│  ┌───────────────────────┐  ┌───────────────────────┐                       │
│  │  Routes               │  │  Middleware           │                       │
│  │  - /api/auth          │  │  - requireAuth        │                       │
│  │  - /api/vms           │  │  - requireRole        │                       │
│  │  - /api/environments  │  │  - validate           │                       │
│  │  - /api/execute       │  │  - ipWhitelist        │                       │
│  │  - /api/monitor       │  │  - rateLimiter        │                       │
│  │  - /api/access-*      │  └───────────────────────┘                       │
│  │  - /api/settings       │                                                  │
│  │  - /api/audit-logs     │  ┌───────────────────────┐                       │
│  │  - /api/totp           │  │  Services             │                       │
│  │  - /api/push           │  │  - sshService         │                       │
│  │  - /api/email          │  │  - monitorService     │                       │
│  └───────────────────────┘  │  - vmService          │                       │
│                              │  - environmentService │                       │
│  ┌───────────────────────┐  │  - emailService       │                       │
│  │  WebSocket Server     │  │  - healthService      │                       │
│  │  - Real-time output   │  │  - auditService       │                       │
│  │  - Status updates     │  │  - totpService        │                       │
│  └───────────────────────┘  │  - pushService        │                       │
│                              │  - authService        │                       │
│  ┌───────────────────────┐  └───────────────────────┘                       │
│  │  BullMQ Workers       │                                                  │
│  │  - executionWorker    │  ┌───────────────────────┐                       │
│  │  - emailWorker        │  │  Models (Mongoose)    │                       │
│  └───────────────────────┘  │  - User               │                       │
│                              │  - VM                 │                       │
│                              │  - Environment        │                       │
│                              │  - AuditLog           │                       │
│                              │  - Setting            │                       │
│                              │  - PasswordHistory    │                       │
│                              └───────────────────────┘                       │
└───────────────┬───────────────────────────────────┬─────────────────────────┘
                │                                   │
                ▼                                   ▼
┌───────────────────────────┐       ┌───────────────────────────┐
│  MongoDB                  │       │  Redis                    │
│  - Users collection       │       │  - Session store          │
│  - VMs collection         │       │  - BullMQ queues          │
│  - Environments collection│       │  - Rate limiting          │
│  - AuditLogs collection   │       │  - Caching                │
│  - Settings collection    │       │                           │
│  - PasswordHistory        │       │                           │
└───────────────────────────┘       └───────────────────────────┘
```

---

## Data Flow Diagrams

### Authentication Flow

```
User → Google OAuth → Callback → Session Created → MongoDB Session Store
                                    ↓
                              Check User Status
                                    ↓
                    ┌───────────────┼───────────────┐
                    ↓               ↓               ↓
                Pending          Active          Blocked
                    ↓               ↓               ↓
            Show Pending UI   Full Access      Show Blocked
```

### Command Execution Flow

```
User selects VMs
       ↓
User clicks "Run"
       ↓
Frontend: POST /api/execute { vmIds }
       ↓
Backend: For each VM
       ├── Get VM details
       ├── Get environment command
       ├── Create BullMQ job
       └── Return job count
       ↓
Worker: For each job
       ├── SSH connect to VM
       ├── Execute command
       ├── Stream output via WebSocket
       └── Update status
       ↓
Frontend: Real-time output display
```

### Monitoring Flow

```
User selects environment
       ↓
Frontend: POST /api/monitor { environmentId }
       ↓
Backend:
       ├── Get environment
       ├── Get monitoring command
       ├── Get all VMs in environment
       └── For each VM:
              ├── SSH connect
              ├── Execute monitoring command
              ├── Parse output
              └── Return metrics
       ↓
Frontend: Display metrics
       ↓
Auto-refresh every 10 seconds
```

---

## Component Interaction

### Frontend State Management

```
┌─────────────────────────────────────────────────────────────┐
│                    ZUSTAND STORES                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  authStore                 envStore              vmStore     │
│  ┌─────────────────┐      ┌─────────────────┐   ┌────────┐ │
│  │ user            │      │ environments    │   │ vmGroups│ │
│  │ isAdmin         │      │ selectedEnvId   │   │ logs    │ │
│  │ isPinVerified   │      │ isLoading       │   │statuses │ │
│  │ hasPermission() │      │ resetCommands() │   │selected │ │
│  └─────────────────┘      └─────────────────┘   └────────┘ │
│                                                              │
│  monitorStore                                               │
│  ┌──────────────────────┐                                   │
│  │ selectedEnvId        │                                   │
│  │ vmMetrics            │                                   │
│  │ sortField/Direction  │                                   │
│  │ getSortedVmMetrics() │                                   │
│  └──────────────────────┘                                   │
└─────────────────────────────────────────────────────────────┘
```

### Backend Service Layer

```
Routes → Services → Models → Database
  │         │
  │         └── Business Logic
  │
  └── Request/Response Handling
```

---

## Security Layers

```
Request
   │
   ▼
┌──────────────────┐
│  Helmet Headers  │ ← Security headers
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  CORS Check      │ ← Origin validation
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Session Check   │ ← Authentication
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  IP Whitelist    │ ← Role-based IP restriction
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Role Check      │ ← Authorization
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Permission Check│ ← Feature-level access
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Rate Limiting   │ ← DoS protection
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Input Validation│ ← Zod schemas
└────────┬─────────┘
         │
         ▼
    Route Handler
```

---

## Environment Configuration

### Docker Compose Services

```yaml
services:
  frontend:
    - Nginx reverse proxy
    - Serves static React files
    - Port: 7001
    
  backend:
    - Express.js application
    - Port: 7002 (internal)
    - Depends on: redis
    
  redis:
    - Session storage
    - BullMQ queues
    - Port: 6379
```

### Environment Variables

| Variable | Purpose |
|----------|---------|
| `mongo` | MongoDB connection string |
| `SESSION_SECRET` | Session encryption key |
| `REDIS_HOST` | Redis hostname |
| `ENCRYPTION_KEY` | 64-char AES key for passwords |
| `GOOGLE_CLIENT_ID` | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth client secret |
| `FRONTEND_URL` | Frontend URL for CORS |
| `VITE_REQUIRED_PIN` | User PIN |
| `VITE_ADMIN_PIN` | Admin PIN |

---

## SSH Connection Management

```
Command Request
       │
       ▼
┌─────────────────────┐
│ sshService          │
│ .executeCommand()   │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ ssh2 Client         │
│ - Connect to VM     │
│ - Authenticate      │
│ - Execute command   │
│ - Stream output     │
└─────────┬───────────┘
          │
          ▼
┌─────────────────────┐
│ WebSocket Broadcast │
│ - Real-time output  │
│ - Status updates    │
└─────────────────────┘
```

---

## Real-Time Communication

### WebSocket Events

| Direction | Event | Payload |
|-----------|-------|---------|
| Server → Client | `output` | `{ vmId, type, data }` |
| Server → Client | `status` | `{ vmId, status }` |

### Message Flow

```
Backend (sshService)
       │
       │ Execute command
       ▼
Worker (BullMQ)
       │
       │ Stream output
       ▼
WebSocket Server
       │
       │ Broadcast
       ▼
Connected Clients
       │
       │ Update UI
       ▼
Frontend (vmStore.addLog)
```

---

## Scalability Considerations

### Current Architecture

- Single backend instance
- Redis for session & queue management
- MongoDB for persistence

### Scaling Path

1. **Horizontal Scaling**: Multiple backend instances behind load balancer
2. **Redis Cluster**: For high-availability queue management
3. **MongoDB Replica Set**: For database redundancy
4. **CDN**: For static assets
5. **Connection Pooling**: For SSH connections

---

## Failure Handling

### SSH Connection Failures

```
Attempt Connection
       │
       ├─ Success → Execute command
       │
       └─ Failure
              │
              ├─ Timeout → Log error, update status
              ├─ Auth Error → Log error, notify user
              └─ Network Error → Retry logic, then fail
```

### Database Failures

```
Database Operation
       │
       ├─ Success → Continue
       │
       └─ Failure
              │
              ├─ Connection Error → Retry with backoff
              ├─ Validation Error → Return 400
              └─ Unknown Error → Log, return 500
```

---

## Performance Optimizations

### Frontend

- React.memo for expensive components
- Zustand selectors for minimal re-renders
- WebSocket for real-time updates (no polling)
- Debounced search inputs

### Backend

- Indexed MongoDB queries
- BullMQ for async job processing
- Redis caching for sessions
- Connection pooling for SSH

### Database

- Indexes on: `environmentId`, `userId`, `createdAt`
- Text indexes for search
- Pagination for large datasets
