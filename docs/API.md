# API Documentation

## Base URL

```
Production: https://your-domain.com/api
Development: http://localhost:7002/api
```

---

## Authentication

All endpoints require session-based authentication via Google OAuth.

### Headers

```
Content-Type: application/json
Cookie: connect.sid=<session_id>
```

---

## Table of Contents

1. [Authentication](#authentication-endpoints)
2. [Users](#users-endpoints)
3. [Environments](#environments-endpoints)
4. [VMs](#vms-endpoints)
5. [Execution](#execution-endpoints)
6. [Monitoring](#monitoring-endpoints)
7. [Access Requests](#access-requests-endpoints)
8. [Settings](#settings-endpoints)
9. [Audit Logs](#audit-logs-endpoints)
10. [TOTP](#totp-endpoints)
11. [Push Notifications](#push-notifications)
12. [Email](#email-endpoints)

---

## Authentication Endpoints

### GET /auth/me

Get current authenticated user.

**Response:**
```json
{
  "user": {
    "id": "string",
    "displayName": "string",
    "email": "string",
    "role": "admin" | "user",
    "status": "pending" | "active" | "rejected" | "blocked",
    "permissions": ["env", "exec", "monitor"],
    "isTotpEnabled": boolean
  }
}
```

### GET /auth/google

Initiate Google OAuth login.

**Response:** Redirects to Google OAuth consent screen.

### GET /auth/google/callback

OAuth callback endpoint.

**Response:** Redirects to frontend on success.

### POST /auth/logout

Logout current user.

**Response:**
```json
{
  "success": true
}
```

### POST /auth/verify-pin

Verify PIN for dashboard access.

**Request:**
```json
{
  "pin": "string"
}
```

**Response:**
```json
{
  "success": true
}
```

### GET /auth/pins

Get current PINs (admin only).

**Response:**
```json
{
  "userPin": "string",
  "adminPin": "string"
}
```

### PUT /auth/user-pin

Update user PIN (admin only).

**Request:**
```json
{
  "pin": "string" // min 4 characters
}
```

### PUT /auth/admin-pin

Update admin PIN (admin only).

**Request:**
```json
{
  "pin": "string" // min 4 characters
}
```

---

## Users Endpoints

### GET /users

Get all users (admin only).

**Response:**
```json
[
  {
    "id": "string",
    "displayName": "string",
    "email": "string",
    "role": "admin" | "user",
    "status": "string",
    "permissions": ["env", "exec", "monitor"]
  }
]
```

---

## Environments Endpoints

### GET /environments

Get all environments.

**Response:**
```json
[
  {
    "id": "string",
    "name": "string",
    "command": "string",
    "monitoringCommand": "string",
    "vmCount": number
  }
]
```

### POST /environments

Create new environment (admin only).

**Request:**
```json
{
  "name": "string"
}
```

**Response:**
```json
{
  "id": "string",
  "name": "string",
  "command": ""
}
```

### PUT /environments/:id

Update environment (admin only).

**Request:**
```json
{
  "name": "string",
  "command": "string",
  "monitoringCommand": "string"
}
```

### DELETE /environments/:id

Delete environment (admin only, requires 2FA).

**Request:**
```json
{
  "totpCode": "string"
}
```

### POST /environments/reset-commands

Reset all environment commands to defaults (admin only).

**Response:**
```json
{
  "success": true,
  "updatedCount": 3,
  "environments": [...]
}
```

---

## VMs Endpoints

### GET /vms

Get all VMs with pagination.

**Query Parameters:**
- `environmentId` (optional): Filter by environment
- `search` (optional): Search term
- `page` (default: 1)
- `limit` (default: 20)

**Response:**
```json
{
  "data": [
    {
      "id": "string",
      "name": "string",
      "ip": "string",
      "username": "string",
      "port": number,
      "environmentId": "string",
      "isPinned": boolean
    }
  ],
  "total": number
}
```

### GET /vms/grouped

Get VMs grouped by environment.

**Response:**
```json
[
  {
    "environmentId": "string",
    "environmentName": "string",
    "vms": [...],
    "vmCount": number
  }
]
```

### GET /vms/:id

Get single VM.

### POST /vms

Create new VM (admin only).

**Request:**
```json
{
  "name": "string",
  "ip": "string",
  "username": "string",
  "password": "string",
  "port": number,
  "environmentId": "string"
}
```

### PUT /vms/:id

Update VM (admin only).

### DELETE /vms/:id

Delete VM (admin only, requires 2FA).

**Request:**
```json
{
  "totpCode": "string"
}
```

### POST /vms/:id/test

Test SSH connection to VM.

**Response:**
```json
{
  "success": true,
  "message": "string",
  "latency": number
}
```

### POST /vms/:id/pin

Pin VM to top of list.

### POST /vms/:id/unpin

Unpin VM.

### POST /vms/batch-delete

Delete multiple VMs (admin only, requires 2FA).

**Request:**
```json
{
  "vmIds": ["id1", "id2"],
  "totpCode": "string"
}
```

---

## Execution Endpoints

### POST /execute

Execute command on selected VMs.

**Request:**
```json
{
  "vmIds": ["id1", "id2"],
  "command": "string" // optional - if not provided, uses environment command
}
```

**Response:**
```json
{
  "message": "Execution started",
  "jobCount": 2
}
```

**Note:** Command is resolved per VM from its environment's `command` field.

---

## Monitoring Endpoints

### POST /monitor

Get monitoring metrics for an environment.

**Request:**
```json
{
  "environmentId": "string"
}
```

**Response:**
```json
{
  "configured": true,
  "environmentName": "IVG",
  "summary": {
    "totalActive": 2845,
    "totalCapacity": 25000,
    "totalCPS": 182,
    "maxCPS": 650,
    "usagePercent": 11.4,
    "healthyVMs": 4,
    "errorVMs": 1,
    "totalVMs": 5
  },
  "vms": {
    "vmId": {
      "vmId": "string",
      "vmName": "string",
      "vmIp": "string",
      "activeCalls": 966,
      "maxSessions": 5000,
      "peakCalls": 4786,
      "currentCPS": 59,
      "maxCPS": 130,
      "totalSessions": 211155577,
      "usagePercent": 19.3,
      "status": "healthy" | "warning" | "critical" | "error",
      "error": "string | null",
      "timestamp": "2026-03-05T10:32:45.000Z"
    }
  },
  "lastUpdated": "2026-03-05T10:32:45.000Z"
}
```

**If not configured:**
```json
{
  "configured": false,
  "message": "No monitoring command configured",
  "environmentName": "OPS"
}
```

---

## Access Requests Endpoints

### GET /access-requests

Get all user access requests (admin only).

**Response:**
```json
[
  {
    "_id": "string",
    "displayName": "string",
    "email": "string",
    "photo": "string",
    "status": "pending" | "active" | "rejected" | "blocked",
    "accessExpiresAt": "string | null",
    "isTempAccess": boolean,
    "createdAt": "string",
    "permissions": ["env", "exec", "monitor"]
  }
]
```

### PATCH /access-requests/:userId/approve

Approve user access.

**Request:**
```json
{
  "durationDays": number | null // null = permanent
}
```

### PATCH /access-requests/:userId/reject

Reject user access.

### PATCH /access-requests/:userId/block

Block user permanently.

### PATCH /access-requests/:userId/unblock

Unblock user.

### PATCH /access-requests/:userId/revoke

Revoke user access.

### PATCH /access-requests/:userId/permissions

Update user permissions.

**Request:**
```json
{
  "permissions": ["env", "monitor"]
}
```

---

## Settings Endpoints

### GET /settings

Get all settings.

**Response:**
```json
{
  "accessRequestsRequired": boolean,
  "notifyVmDown": boolean,
  "notifyVmRecovered": boolean,
  "notifyUserApproved": boolean
}
```

### PATCH /settings/:key

Update specific setting (admin only).

**Request:**
```json
{
  "value": boolean
}
```

---

## Audit Logs Endpoints

### GET /audit-logs

Get audit logs with pagination (admin only).

**Query Parameters:**
- `action` (optional): Filter by action type
- `actorId` (optional): Filter by actor
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string
- `page` (default: 1)
- `limit` (default: 50)

**Response:**
```json
{
  "data": [
    {
      "id": "string",
      "actorId": "string",
      "actorEmail": "string",
      "actorRole": "string",
      "action": "VM_CREATED" | "VM_DELETED" | ...,
      "target": "string",
      "metadata": {},
      "createdAt": "string"
    }
  ],
  "total": number
}
```

### GET /audit-logs/export

Export audit logs as CSV (admin only).

---

## TOTP Endpoints

### POST /totp/setup

Initialize TOTP setup.

**Response:**
```json
{
  "qrCodeUrl": "string",
  "secret": "string"
}
```

### POST /totp/verify

Verify TOTP code during setup.

**Request:**
```json
{
  "token": "string"
}
```

### POST /totp/disable

Disable TOTP (requires current code).

**Request:**
```json
{
  "token": "string"
}
```

---

## Push Notifications

### POST /push/subscribe

Subscribe to push notifications.

**Request:**
```json
{
  "subscription": {
    "endpoint": "string",
    "keys": {
      "p256dh": "string",
      "auth": "string"
    }
  }
}
```

### POST /push/unsubscribe

Unsubscribe from push notifications.

---

## Email Endpoints

### GET /email/settings

Get email settings (admin only).

### PUT /email/settings

Update email settings (admin only).

**Request:**
```json
{
  "enabled": boolean,
  "host": "string",
  "port": number,
  "secure": boolean,
  "user": "string",
  "pass": "string",
  "from": "string",
  "notifyVmDown": boolean,
  "notifyVmRecovered": boolean,
  "notifyUserApproved": boolean
}
```

### POST /email/test

Send test email (admin only).

---

## Password Management Endpoints

### POST /vms/:id/password

Change VM password (admin only).

**Request:**
```json
{
  "newPassword": "string",
  "totpCode": "string" // required if admin has 2FA enabled
}
```

### POST /vms/passwords/auto-rotate

Auto-rotate passwords for selected VMs (admin only).

**Request:**
```json
{
  "vmIds": ["id1", "id2"],
  "totpCode": "string"
}
```

### GET /vms/passwords/history

Get password change history (admin only).

**Query Parameters:**
- `vmId` (optional)
- `startDate` (optional)
- `endDate` (optional)

---

## Tags Endpoints

### GET /tags/vm/:vmId

Get tags for a specific VM.

**Response:**
```json
{
  "tags": [
    {
      "text": "string",
      "addedBy": "string",
      "addedByEmail": "string",
      "addedAt": "2026-03-05T10:00:00.000Z"
    }
  ],
  "vmName": "string",
  "vmIp": "string"
}
```

### POST /tags/vm/:vmId/add

Add a tag to a VM (requires `exec` permission).

**Request:**
```json
{
  "tagText": "string" // max 50 characters
}
```

**Response:**
```json
{
  "success": true,
  "tags": [...]
}
```

**Error (already tagged):**
```json
{
  "error": "You have already tagged this VM. Please request a tag change instead.",
  "hasExistingTag": true,
  "existingTag": { ... }
}
```

### POST /tags/vm/:vmId/request-change

Request a tag change (requires `exec` permission).

**Request:**
```json
{
  "tagText": "string",
  "requestType": "add" | "remove"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Tag change request submitted. An admin will review it.",
  "request": { ... }
}
```

### GET /tags/vm/:vmId/my-tag

Get current user's tag on a VM.

**Response:**
```json
{
  "myTag": {
    "text": "string",
    "addedBy": "string",
    "addedByEmail": "string",
    "addedAt": "2026-03-05T10:00:00.000Z"
  } | null,
  "hasPendingRequest": boolean,
  "pendingRequest": { ... } | null
}
```

### GET /tags/requests/pending

Get all pending tag requests (admin only).

**Response:**
```json
[
  {
    "_id": "string",
    "vmId": "string",
    "vmName": "string",
    "vmIp": "string",
    "requestedBy": "string",
    "requestedByEmail": "string",
    "tagText": "string",
    "requestType": "add" | "remove",
    "status": "pending",
    "createdAt": "2026-03-05T10:00:00.000Z"
  }
]
```

### GET /tags/requests/all

Get all tag requests with filters (admin only).

**Query Parameters:**
- `status` (optional): Filter by status (pending, approved, rejected)
- `vmId` (optional): Filter by VM
- `requestedBy` (optional): Filter by requester

### PATCH /tags/requests/:requestId/review

Approve or reject a tag request (admin only).

**Request:**
```json
{
  "approved": true | false
}
```

**Response:**
```json
{
  "success": true,
  "request": { ... }
}
```

### DELETE /tags/vm/:vmId/tag/:tagIndex

Remove a tag from a VM (admin only).

**Response:**
```json
{
  "success": true,
  "tags": [...]
}
```

### GET /tags/my-requests

Get current user's tag requests.

**Response:**
```json
[
  {
    "_id": "string",
    "vmId": "string",
    "vmName": "string",
    "tagText": "string",
    "requestType": "add" | "remove",
    "status": "pending" | "approved" | "rejected",
    "createdAt": "2026-03-05T10:00:00.000Z"
  }
]
```

---

## Error Responses

All endpoints may return these error responses:

### 400 Bad Request
```json
{
  "error": "Validation error message"
}
```

### 401 Unauthorized
```json
{
  "error": "Not authenticated"
}
```

### 403 Forbidden
```json
{
  "error": "Insufficient permissions"
}
```

### 404 Not Found
```json
{
  "error": "Resource not found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error"
}
```

---

## Rate Limiting

- Auth endpoints: 10 requests per 15 minutes
- Password endpoints: 5 requests per hour
- Other endpoints: No rate limiting

---

## WebSocket Events

Connect to: `wss://your-domain.com/api/`

### Server → Client Events

| Event | Payload |
|-------|---------|
| `output` | `{ vmId, type: 'stdout' \| 'stderr' \| 'info' \| 'error', data }` |
| `status` | `{ vmId, status: 'pending' \| 'running' \| 'success' \| 'error' }` |
