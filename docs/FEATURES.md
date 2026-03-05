# Features Documentation

## Overview

SSH Client Manager provides comprehensive infrastructure management capabilities.

---

## Feature List

### 1. User Management

**Description:** Complete user lifecycle management with Google OAuth authentication.

**Capabilities:**
- Google OAuth 2.0 login
- Role-based access (Admin/User)
- User approval workflow
- Temporary access with expiration
- User blocking/unblocking
- Feature-level permissions

**Access:** Admin-only for management, all authenticated users can view own profile

**Related Files:**
- `api/models/User.ts`
- `api/routes/auth.ts`
- `api/routes/accessRequests.ts`
- `src/components/AccessControlPanel.tsx`

---

### 2. Environment Management

**Description:** Organize VMs into logical environments.

**Capabilities:**
- Create/Delete environments
- Custom commands per environment
- Monitoring commands per environment
- Default environments (IVG, OPS, VOSS)

**Access:** All users can view, admin-only for management

**Environments:**

| Name | Purpose |
|------|---------|
| IVG | FreeSWITCH servers |
| OPS | OpenSIPS servers |
| VOSS | VOSS media servers |

**Related Files:**
- `api/models/Environment.ts`
- `api/routes/environments.ts`
- `api/config/defaultEnvironments.ts`
- `src/store/envStore.ts`

---

### 3. VM Management

**Description:** Full CRUD operations for virtual machines.

**Capabilities:**
- Add/Edit/Delete VMs
- SSH connection testing
- Pin/Unpin VMs
- Search and filter
- Environment grouping

**Access:** All users can view, admin-only for management

**Related Files:**
- `api/models/VM.ts`
- `api/routes/vms.ts`
- `api/services/vmService.ts`
- `src/components/EnvironmentVMTree.tsx`

---

### 4. Command Execution

**Description:** Execute SSH commands on multiple VMs with real-time output.

**Capabilities:**
- Multi-VM execution
- Environment-specific commands
- Real-time output streaming
- Status tracking per VM
- Command history (audit log)

**Access:** Users with 'exec' permission

**How It Works:**
1. User selects VMs from sidebar
2. Command auto-populated from VM's environment
3. User clicks "Run"
4. Backend queues jobs via BullMQ
5. Worker executes via SSH
6. Output streamed via WebSocket

**Related Files:**
- `api/routes/execution.ts`
- `api/workers/executionWorker.ts`
- `api/services/sshService.ts`
- `src/components/CommandExecutor.tsx`

---

### 5. Live Monitoring

**Description:** Real-time metrics for VMs grouped by environment.

**Capabilities:**
- Per-environment monitoring
- Auto-refresh (configurable)
- Sortable metrics
- Status indicators (healthy/warning/critical/error)
- Environment summary statistics

**Metrics Tracked:**
- Active Calls
- Max Sessions (capacity)
- Peak Calls
- Current CPS (calls per second)
- Total Sessions
- Usage Percentage

**Access:** Users with 'monitor' permission

**Related Files:**
- `api/routes/monitor.ts`
- `api/services/monitorService.ts`
- `src/components/MonitoringPanel.tsx`
- `src/store/monitorStore.ts`

---

### 6. Password Management

**Description:** Secure password storage and rotation.

**Capabilities:**
- Encrypted password storage
- Manual password changes
- Auto-rotation with generated passwords
- Password history tracking
- Rate limiting on changes

**Access:** Admin-only

**Security:**
- AES-256-GCM encryption
- Encryption key from environment variable
- Passwords never logged
- Rate limited (5 attempts/hour)

**Related Files:**
- `api/services/sshService.ts`
- `api/routes/vms.ts`
- `api/models/PasswordHistory.ts`
- `src/components/VMPasswordManager.tsx`

---

### 7. Health Monitoring

**Description:** Automated VM health checks.

**Capabilities:**
- Periodic SSH connection tests
- Configurable check interval (default: 5 minutes)
- Email notifications on status change
- Push notifications
- Recovery detection

**Access:** Automatic background process

**Related Files:**
- `api/services/healthService.ts`

---

### 8. Access Control

**Description:** Feature-level permission management.

**Capabilities:**
- Granular permissions per user
- Real-time permission updates
- Visual permission toggles
- Default permissions for new users

**Permissions:**

| Permission | Feature |
|------------|---------|
| `env` | View environments & VMs |
| `exec` | Execute commands |
| `monitor` | View monitoring |

**Access:** Admin-only for management

**Related Files:**
- `api/routes/accessRequests.ts`
- `src/components/AccessControlPanel.tsx`
- `src/store/authStore.ts`

---

### 9. Two-Factor Authentication (TOTP)

**Description:** Optional 2FA for admin accounts.

**Capabilities:**
- TOTP setup via QR code
- Required for destructive operations
- Disable capability

**Access:** Admin-only

**When Required:**
- Deleting environments
- Deleting VMs
- Batch deleting VMs
- Password auto-rotation

**Related Files:**
- `api/services/totpService.ts`
- `api/routes/totp.ts`
- `src/components/TwoFactorSetup.tsx`

---

### 10. Audit Logging

**Description:** Comprehensive activity tracking.

**Capabilities:**
- All user actions logged
- Searchable history
- CSV export
- Retention policy

**Tracked Actions:**
- Authentication events
- VM CRUD operations
- Command execution
- User management
- Settings changes

**Access:** Admin-only

**Related Files:**
- `api/models/AuditLog.ts`
- `api/services/auditService.ts`
- `api/routes/auditLogs.ts`
- `src/components/AuditLogView.tsx`

---

### 11. Email Notifications

**Description:** SMTP-based email alerts.

**Capabilities:**
- Configurable SMTP settings
- Test email functionality
- Selective notifications
- HTML templates

**Notification Types:**
- VM Down alerts
- VM Recovery alerts
- User approval notifications

**Access:** Admin-only for settings

**Related Files:**
- `api/services/emailService.ts`
- `api/routes/email.ts`
- `api/workers/emailWorker.ts`
- `src/components/EmailSettings.tsx`

---

### 12. Push Notifications

**Description:** Browser-based push notifications.

**Capabilities:**
- Web Push protocol
- Subscription management
- Real-time alerts

**Access:** All authenticated users

**Related Files:**
- `api/services/pushService.ts`
- `api/routes/push.ts`
- `src/hooks/usePushNotifications.ts`

---

### 13. Global Search

**Description:** Search across VMs, environments, and users.

**Capabilities:**
- Real-time search
- MongoDB text search
- Quick access to resources

**Access:** All authenticated users

**Related Files:**
- `src/components/GlobalSearch.tsx`

---

### 14. IP Whitelisting

**Description:** Role-based IP restrictions.

**Capabilities:**
- Admin: Access from any IP
- Users: Restricted to allowed IPs
- Configurable via environment variable

**Configuration:**
```env
ALLOWED_IPS=192.168.1.0/24,10.0.0.0/8
```

**Related Files:**
- `api/middleware/ipWhitelist.ts`

---

### 15. PIN Protection

**Description:** Additional security layer for dashboard access.

**Capabilities:**
- Separate user and admin PINs
- Required after OAuth login
- Session-based verification

**Access:** All users need user PIN, admins can use admin PIN

**Related Files:**
- `api/routes/auth.ts`
- `src/components/PinScreen.tsx`

---

### 16. VM Tagging

**Description:** Collaborative tagging system for VMs.

**Capabilities:**
- Users with `exec` permission can add tags to VMs
- Each user can tag a VM only once
- Tag change requests for subsequent modifications
- Admin approval workflow for tag changes
- Multiple tags per VM from different users
- Tag display in monitoring panel

**Tag Workflow:**
1. User with exec permission adds tag to VM
2. Tag is immediately visible to all users
3. To change/remove tag, user submits request
4. Admin reviews and approves/rejects request
5. On approval, tag is added/removed

**Access:** Users with `exec` permission can add tags, admins can approve changes and remove any tag

**Related Files:**
- `api/models/TagRequest.ts`
- `api/routes/tags.ts`
- `api/schemas/tagSchema.ts`
- `src/components/MonitoringPanel.tsx`
- `src/components/TagRequestsPanel.tsx`

---

## Feature Permissions Matrix

| Feature | Admin | User (default) | Customizable |
|---------|-------|----------------|--------------|
| Environments (view) | ✓ | ✓ | Yes |
| Environments (manage) | ✓ | ✗ | No |
| VMs (view) | ✓ | ✓ | Yes |
| VMs (manage) | ✓ | ✗ | No |
| Execute Commands | ✓ | ✓ | Yes |
| Monitoring | ✓ | ✓ | Yes |
| VM Tagging | ✓ | ✓ | Yes (exec) |
| Tag Request Approval | ✓ | ✗ | No |
| Access Control | ✓ | ✗ | No |
| Password Management | ✓ | ✗ | No |
| Audit Logs | ✓ | ✗ | No |
| Email Settings | ✓ | ✗ | No |
| TOTP Setup | ✓ | ✗ | No |

---

## Feature Dependencies

```
Command Execution
├── Environment Management (for commands)
├── VM Management (for targets)
├── SSH Service (for execution)
├── WebSocket (for output)
└── Audit Logging (for history)

Monitoring
├── Environment Management (for commands)
├── VM Management (for targets)
├── SSH Service (for data collection)
└── Permission Check

Password Management
├── VM Management
├── Encryption Service
├── TOTP (if enabled)
└── Rate Limiting
```
