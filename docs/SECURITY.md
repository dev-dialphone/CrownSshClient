# Security Implementation

## Overview

The SSH Client Manager implements multiple layers of security to protect sensitive infrastructure access.

---

## Security Layers

```
┌──────────────────────────────────────────────────────────────┐
│                        REQUEST                                │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  1. CORS Validation                                           │
│     - Origin whitelist                                        │
│     - Preflight handling                                      │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  2. Helmet Security Headers                                   │
│     - Content-Security-Policy                                 │
│     - X-Frame-Options                                         │
│     - X-Content-Type-Options                                  │
│     - Strict-Transport-Security                               │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  3. IP Whitelist (api/middleware/ipWhitelist.ts)             │
│     - Role-based restrictions                                 │
│     - Admin: All IPs                                          │
│     - Users: Configured IPs only                              │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  4. Session Authentication (api/middleware/requireAuth.ts)   │
│     - Express session with Redis store                        │
│     - Google OAuth 2.0                                        │
│     - Session expiration                                      │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  5. Role Authorization (api/middleware/requireRole.ts)       │
│     - Admin vs User roles                                     │
│     - Route-level protection                                  │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  6. Permission Check (in routes)                             │
│     - Feature-level permissions                               │
│     - env, exec, monitor                                      │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  7. Rate Limiting                                             │
│     - Password changes: 5/hour                                │
│     - API endpoints: Configurable                             │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  8. Input Validation (api/middleware/validate.ts)            │
│     - Zod schema validation                                   │
│     - Type safety                                             │
│     - SQL/Command injection prevention                        │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                     ROUTE HANDLER                             │
└──────────────────────────────────────────────────────────────┘
```

---

## Authentication

### Google OAuth 2.0

**Flow:**

```
1. User clicks "Login with Google"
        │
        ▼
2. Redirect to Google consent screen
        │
        ▼
3. User authorizes application
        │
        ▼
4. Google redirects to /api/auth/google/callback
        │
        ▼
5. Backend exchanges code for tokens
        │
        ▼
6. User profile retrieved from Google
        │
        ▼
7. Session created in Redis
        │
        ▼
8. Redirect to frontend with PIN screen
        │
        ▼
9. User enters PIN
        │
        ▼
10. Session marked as verified
        │
        ▼
11. Redirect to dashboard
```

**Session Configuration:**

```typescript
session({
  store: new RedisStore({ client: redisClient }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: true,           // HTTPS only
    httpOnly: true,         // No JavaScript access
    sameSite: 'lax',        // CSRF protection
    maxAge: 24 * 60 * 60 * 1000  // 24 hours
  }
})
```

### PIN Protection

Two-tier PIN system:

| PIN Type | Environment Variable | Purpose |
|----------|---------------------|---------|
| User PIN | `VITE_REQUIRED_PIN` | Regular user access |
| Admin PIN | `VITE_ADMIN_PIN` | Admin dashboard access |

**Verification:**

```typescript
// api/routes/auth.ts
router.post('/verify-pin', async (req, res) => {
  const { pin } = req.body;
  const user = req.session.user;
  
  const expectedPin = user.role === 'admin' 
    ? process.env.VITE_ADMIN_PIN 
    : process.env.VITE_REQUIRED_PIN;
  
  if (pin === expectedPin) {
    req.session.isPinVerified = true;
    return res.json({ success: true });
  }
  
  res.status(401).json({ success: false });
});
```

---

## Authorization

### Role-Based Access Control (RBAC)

**Roles:**

| Role | Permissions |
|------|-------------|
| `admin` | Full access to all features |
| `user` | Limited access based on permissions |

**Middleware Implementation:**

```typescript
// api/middleware/requireRole.ts
export function requireRole(role: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    
    if (req.session.user.role !== role) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    
    next();
  };
}
```

### Feature-Level Permissions

**Permission Types:**

```typescript
type UserPermission = 'env' | 'exec' | 'monitor';
```

**Database Schema:**

```typescript
// api/models/User.ts
permissions: {
  type: [String],
  enum: ['env', 'exec', 'monitor'],
  default: ['env', 'exec', 'monitor']
}
```

**Frontend Check:**

```typescript
// src/store/authStore.ts
hasPermission(permission) {
  if (isAdmin) return true;
  if (!user) return false;
  
  const permissions = user.permissions || DEFAULT_PERMISSIONS;
  return permissions.includes(permission);
}
```

**Backend Check:**

```typescript
// In route handler
if (!user.permissions?.includes('exec') && user.role !== 'admin') {
  return res.status(403).json({ error: 'Permission denied' });
}
```

---

## Password Encryption

### AES-256-GCM Encryption

VM passwords are encrypted at rest using AES-256-GCM.

**Encryption Process:**

```typescript
// api/utils/encryption.ts
import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const KEY = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedData: string): string {
  const [ivHex, authTagHex, encrypted] = encryptedData.split(':');
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  
  const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}
```

**Key Requirements:**

- Must be exactly 64 hex characters (32 bytes)
- Generate with: `openssl rand -hex 32`
- Store in `ENCRYPTION_KEY` environment variable

---

## Two-Factor Authentication (TOTP)

### TOTP Setup

**For Admin Accounts Only**

**Implementation:**

```typescript
// api/services/totpService.ts
import speakeasy from 'speakeasy';

export function generateSecret(email: string) {
  return speakeasy.generateSecret({
    name: `SSH Manager (${email})`,
    length: 20
  });
}

export function verifyToken(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: 'base32',
    token,
    window: 1  // Allow 1 step before/after
  });
}
```

**Required For:**
- Deleting environments
- Deleting VMs
- Batch deleting VMs
- Auto-rotating passwords

### TOTP Flow

```
1. Admin enables 2FA
        │
        ▼
2. Generate secret and QR code
        │
        ▼
3. Admin scans with authenticator app
        │
        ▼
4. Admin enters verification code
        │
        ▼
5. Secret stored in database (encrypted)
        │
        ▼
6. Future destructive operations require TOTP code
```

---

## IP Whitelisting

### Configuration

```env
# Comma-separated CIDR notation
ALLOWED_IPS=192.168.1.0/24,10.0.0.0/8
```

### Middleware

```typescript
// api/middleware/ipWhitelist.ts
import ipaddr from 'ipaddr.js';

export function ipWhitelist(req, res, next) {
  // Admin bypasses IP check
  if (req.session.user?.role === 'admin') {
    return next();
  }
  
  const allowedIPs = process.env.ALLOWED_IPS?.split(',') || [];
  
  // No whitelist configured = allow all
  if (allowedIPs.length === 0) {
    return next();
  }
  
  const clientIP = req.ip || req.headers['x-forwarded-for'];
  
  const isAllowed = allowedIPs.some(range => {
    const parsed = ipaddr.parseCIDR(range);
    return ipaddr.parse(clientIP).match(parsed);
  });
  
  if (!isAllowed) {
    return res.status(403).json({ error: 'IP not whitelisted' });
  }
  
  next();
}
```

---

## Rate Limiting

### Password Changes

```typescript
// api/middleware/passwordRateLimit.ts
import rateLimit from 'express-rate-limit';

export const passwordRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 5,                     // 5 attempts per window
  message: { error: 'Too many password attempts' },
  keyGenerator: (req) => req.session.user?.id || req.ip
});
```

---

## Input Validation

### Zod Schemas

```typescript
// api/schemas/vmSchema.ts
import { z } from 'zod';

export const createVMSchema = z.object({
  name: z.string().min(1).max(100),
  ip: z.string().ip(),
  port: z.number().int().min(1).max(65535),
  username: z.string().min(1).max(50),
  password: z.string().min(1),
  environmentId: z.string().min(1)
});

export const executeSchema = z.object({
  vmIds: z.array(z.string()).min(1).max(100)
});
```

### Validation Middleware

```typescript
// api/middleware/validate.ts
export function validate(schema: z.ZodSchema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    
    if (!result.success) {
      return res.status(400).json({
        error: 'Validation failed',
        details: result.error.flatten()
      });
    }
    
    req.body = result.data;
    next();
  };
}
```

---

## Security Headers

### Helmet Configuration

```typescript
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "wss:"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: true,
  crossOriginResourcePolicy: { policy: "same-origin" },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
```

---

## Audit Logging

### What Is Logged

| Category | Actions |
|----------|---------|
| Auth | Login, logout, PIN verification, 2FA setup |
| VMs | Create, update, delete, password change |
| Environments | Create, update, delete |
| Users | Approve, block, permission change |
| Execution | Command runs |
| Settings | Email, TOTP, system settings |

### Log Entry

```typescript
interface AuditLog {
  userId: string;
  userEmail: string;
  action: string;
  targetType: 'vm' | 'environment' | 'user' | 'system';
  targetId?: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  timestamp: Date;
}
```

---

## Best Practices

### Never Do

- Store passwords in plain text
- Log sensitive data (passwords, tokens, keys)
- Commit `.env` files
- Expose internal errors to users
- Skip authentication checks
- Use weak encryption keys

### Always Do

- Use HTTPS in production
- Validate all user inputs
- Use parameterized queries (Mongoose handles this)
- Log security-relevant actions
- Rotate encryption keys periodically
- Use strong, unique secrets
- Enable 2FA for admin accounts
- Keep dependencies updated

---

## Security Checklist

- [x] HTTPS enabled
- [x] Session-based authentication
- [x] OAuth 2.0 integration
- [x] PIN protection
- [x] Role-based access control
- [x] Feature-level permissions
- [x] Password encryption at rest
- [x] TOTP 2FA for admins
- [x] IP whitelisting
- [x] Rate limiting
- [x] Input validation
- [x] Security headers
- [x] Audit logging
- [x] No secrets in code
- [x] CORS configuration
