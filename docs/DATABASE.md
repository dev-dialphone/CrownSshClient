# Database Schema

## Overview

SSH Client Manager uses MongoDB with Mongoose ODM for data persistence.

---

## Collections

| Collection | Purpose |
|------------|---------|
| `users` | User accounts and authentication |
| `environments` | Environment configurations |
| `vms` | Virtual machine configurations |
| `auditlogs` | Activity and event logging |
| `settings` | Application settings |
| `passwordhistories` | Password change history |
| `sessions` | User sessions (via connect-mongo) |

---

## User Model

**Collection:** `users`

```typescript
interface IUser {
  googleId: string;          // Google OAuth ID (unique)
  displayName: string;        // User's display name
  email: string;              // User's email (unique)
  photo?: string;             // Profile photo URL
  role: 'admin' | 'user';     // User role
  status: UserStatus;         // Account status
  accessExpiresAt?: Date;     // Temporary access expiration
  isTempAccess: boolean;      // Whether access is temporary
  totpSecret?: string;        // TOTP secret (encrypted)
  isTotpEnabled: boolean;     // 2FA enabled flag
  permissions: UserPermission[]; // Feature permissions
  createdAt: Date;
  updatedAt: Date;
}

type UserStatus = 'pending' | 'active' | 'rejected' | 'blocked';
type UserPermission = 'env' | 'exec' | 'monitor';
```

**Indexes:**
- `googleId` (unique)
- `email` (unique)

**Default Permissions:** `['env', 'exec', 'monitor']`

---

## Environment Model

**Collection:** `environments`

```typescript
interface IEnvironment {
  name: string;               // Environment name (IVG, OPS, VOSS)
  command?: string;           // Execution command template
  monitoringCommand?: string; // Monitoring command template
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes:**
- `name` (unique)

**Default Environments:**

| Name | Command Purpose | Monitoring Command |
|------|----------------|-------------------|
| IVG | FreeSWITCH restart | `fs_cli -x "show status" \| grep session` |
| OPS | OpenSIPS restart | (not configured) |
| VOSS | VOSS restart | (not configured) |

---

## VM Model

**Collection:** `vms`

```typescript
interface IVM {
  name: string;               // VM display name
  ip: string;                 // IP address
  username: string;           // SSH username
  password?: string;          // SSH password (encrypted at rest)
  port: number;               // SSH port (default: 22)
  environmentId?: string;     // Reference to Environment
  isPinned?: boolean;         // Pinned to top of list
  createdAt: Date;
  updatedAt: Date;
}
```

**Indexes:**
- `environmentId`
- `isPinned`
- Text index on: `name`, `ip`, `username`

**Encryption:**
- Passwords are encrypted using AES-256-GCM before storage
- Encryption key stored in `ENCRYPTION_KEY` env variable

---

## AuditLog Model

**Collection:** `auditlogs`

```typescript
interface IAuditLog {
  actorId: string;            // User ID who performed action
  actorEmail: string;         // User email (for quick display)
  actorRole: string;          // User role at time of action
  action: AuditAction;        // Type of action
  target?: string;            // Target resource name
  metadata?: object;          // Additional context
  createdAt: Date;
}

type AuditAction =
  | 'LOGIN'
  | 'LOGOUT'
  | 'VM_CREATED'
  | 'VM_UPDATED'
  | 'VM_DELETED'
  | 'VM_PINNED'
  | 'VM_PASSWORD_CHANGED'
  | 'VM_PASSWORD_RESET'
  | 'COMMAND_EXECUTED'
  | 'ENV_CREATED'
  | 'ENV_UPDATED'
  | 'ENV_DELETED'
  | 'USER_APPROVED'
  | 'USER_REJECTED'
  | 'USER_REVOKED'
  | 'USER_BLOCKED'
  | 'USER_UNBLOCKED'
  | 'SETTING_UPDATED'
  | 'PASSWORD_HISTORY_EXPORTED';
```

**Indexes:**
- `actorId` + `createdAt` (compound)
- `createdAt`

---

## Setting Model

**Collection:** `settings`

```typescript
interface ISetting {
  key: string;                // Setting key (unique)
  value: any;                 // Setting value
  createdAt: Date;
  updatedAt: Date;
}
```

**Default Settings:**

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `accessRequestsRequired` | boolean | `false` | Require approval for new users |
| `notifyVmDown` | boolean | `true` | Email notification when VM goes down |
| `notifyVmRecovered` | boolean | `true` | Email notification when VM recovers |
| `notifyUserApproved` | boolean | `true` | Email notification when user approved |

---

## PasswordHistory Model

**Collection:** `passwordhistories`

```typescript
interface IPasswordHistory {
  vmId: string;               // Reference to VM
  vmName: string;             // VM name at time of change
  vmIp: string;               // VM IP at time of change
  vmUsername: string;         // VM username at time of change
  newPassword: string;        // New password (encrypted)
  oldPassword?: string;       // Old password (encrypted)
  operationType: 'manual' | 'auto'; // Change type
  changedBy: string;          // User who initiated change
  changedById: string;        // User ID
  success: boolean;           // Whether change succeeded
  errorMessage?: string;      // Error if failed
  createdAt: Date;
}
```

**Indexes:**
- `vmId`
- `createdAt`

---

## TagRequest Model

**Collection:** `tagrequests`

```typescript
interface ITagRequest {
  vmId: string;               // Reference to VM
  vmName: string;             // VM name at time of request
  vmIp: string;               // VM IP at time of request
  requestedBy: string;        // User ID who requested
  requestedByEmail: string;   // User email for display
  tagText: string;            // Tag text (max 50 chars)
  requestType: 'add' | 'remove';
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;        // Admin ID who reviewed
  reviewedByEmail?: string;   // Admin email
  reviewedAt?: Date;          // Review timestamp
  createdAt: Date;
}
```

**Indexes:**
- `vmId`
- `requestedBy`
- `status`
- `createdAt`
- Compound: `vmId` + `requestedBy` + `status`

**Workflow:**
1. User with exec permission requests tag change
2. Request created with `pending` status
3. Admin reviews and approves/rejects
4. On approval, tag is added/removed from VM

---

## Entity Relationships

```
┌─────────────┐       ┌─────────────────┐
│   User      │       │   Environment   │
│─────────────│       │─────────────────│
│ id          │       │ id              │
│ email       │       │ name            │
│ role        │       │ command         │
│ permissions │       │ monitoringCmd   │
└──────┬──────┘       └────────┬────────┘
       │                       │
       │                       │ 1:N
       │                       │
       │              ┌────────▼────────┐
       │              │       VM        │
       │              │─────────────────│
       │              │ id              │
       │              │ name            │
       │              │ ip              │
       │              │ environmentId   │
       │              └─────────────────┘
       │
       │ 1:N
       │
┌──────▼────────┐
│   AuditLog    │
│───────────────│
│ actorId       │
│ action        │
│ target        │
└───────────────┘
```

---

## Data Validation

### User
- `email`: Valid email format, unique
- `role`: Enum ['admin', 'user']
- `status`: Enum ['pending', 'active', 'rejected', 'blocked']
- `permissions`: Array of ['env', 'exec', 'monitor']

### Environment
- `name`: Required, unique, case-insensitive

### VM
- `name`: Required
- `ip`: Required, valid IPv4 format
- `username`: Required
- `port`: Number, default 22

---

## Migration Scripts

### migrate-commands.ts

Updates environment commands and monitoring commands to defaults.

```bash
npx tsx api/scripts/migrate-commands.ts
```

**What it does:**
1. Connects to MongoDB
2. Finds all existing environments
3. Updates commands to match DEFAULT_ENVIRONMENTS
4. Creates missing environments
5. Reports results

---

## Query Patterns

### Get VMs with Environment Details

```typescript
VMModel.aggregate([
  {
    $lookup: {
      from: 'environments',
      localField: 'environmentId',
      foreignField: '_id',
      as: 'environment'
    }
  }
])
```

### Get Active Users with Expiring Access

```typescript
User.find({
  status: 'active',
  accessExpiresAt: { $lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
})
```

### Get Audit Logs by Action Type

```typescript
AuditLog.find({ action: 'COMMAND_EXECUTED' })
  .sort({ createdAt: -1 })
  .limit(100)
```

---

## Backup Recommendations

1. **Daily backups** of MongoDB
2. **Point-in-time recovery** enabled
3. **Export audit logs** monthly for compliance
4. **Test restore** quarterly

---

## Performance Considerations

### Indexes

All frequently queried fields have indexes:
- Foreign keys (environmentId, actorId, vmId)
- Sorting fields (createdAt)
- Search fields (text indexes on VM name, ip, username)

### Pagination

All list endpoints use pagination:
- Default limit: 20-50
- Skip-based pagination
- Total count returned

### Aggregation

Used sparingly due to MongoDB limitations:
- Environment grouping for VMs
- Statistics calculations
