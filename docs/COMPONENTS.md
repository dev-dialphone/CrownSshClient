# Frontend Components

## Component Hierarchy

```
App.tsx
├── PinEntry.tsx (PIN verification screen)
├── Login.tsx (OAuth login screen)
└── Home.tsx (Main dashboard)
    ├── GlobalSearch (Search bar)
    ├── EnvironmentVMTree (Sidebar - VM selection)
    ├── CommandExecutor (Command execution panel)
    ├── MonitoringPanel (Live metrics)
    ├── AccessControlPanel (Admin - User management)
    ├── VMPasswordManager (Admin - Password management)
    ├── AuditLogView (Admin - Activity logs)
    └── EmailSettings (Admin - SMTP configuration)
```

---

## Pages

### Login.tsx

**Purpose:** OAuth authentication entry point.

**Features:**
- Google OAuth login button
- Redirects to Google consent screen
- Handles OAuth callback

**State:** None (redirects after auth)

---

### PinEntry.tsx

**Purpose:** PIN verification after OAuth login.

**Features:**
- PIN input field (masked)
- Verifies against user or admin PIN
- Shows error on invalid PIN
- Redirects to dashboard on success

**State Used:** `authStore.verifyPin()`

---

### Home.tsx

**Purpose:** Main dashboard container with tabbed interface.

**Features:**
- Responsive tab navigation (desktop/mobile)
- Permission-based tab visibility
- Mobile bottom navigation bar
- Global search integration

**Props:** None

**State Used:**
- `vmStore.fetchVMGroups()`
- `envStore.fetchEnvironments()`
- `authStore.isAdmin`, `authStore.hasPermission()`

**Tabs:**

| Tab | Component | Permission | Admin Only |
|-----|-----------|------------|------------|
| Env & VMs | EnvironmentVMTree | `env` | No |
| Exec | CommandExecutor | `exec` | No |
| Monitor | MonitoringPanel | `monitor` | No |
| Access | AccessControlPanel | - | Yes |
| Passwords | VMPasswordManager | - | Yes |
| Logs | AuditLogView | - | Yes |
| Email | EmailSettings | - | Yes |

---

## Components

### EnvironmentVMTree.tsx

**Purpose:** Sidebar for environment and VM selection.

**Features:**
- Environment grouping with expand/collapse
- Multi-select VMs with checkboxes
- Select all / Deselect all per environment
- Pinned VMs section
- Add/Edit/Delete VM dialogs (admin)
- Environment management (admin)
- Search/filter VMs

**State Used:**
- `vmStore`: vmGroups, selectedVmIds, expandedEnvIds, toggleVMSelection, selectAllVMsInEnv
- `envStore`: environments, selectedEnvId, selectEnvironment

**Admin Actions:**
- Create/Edit/Delete environments
- Create/Edit/Delete VMs
- Test VM SSH connection
- Pin/Unpin VMs

---

### CommandExecutor.tsx

**Purpose:** Execute SSH commands on selected VMs.

**Features:**
- Displays selected VMs grouped by environment
- Shows command per environment (read-only)
- Run / Stop execution
- Real-time output streaming (WebSocket)
- Per-VM status indicators
- Clear logs
- Terminal-style output display

**State Used:**
- `vmStore`: selectedVmIds, logs, statuses, clearLogs, addLog, updateStatus
- `envStore`: environments (for command lookup)

**Output Format:**
- Timestamped logs
- Color-coded by type (stdout/stderr)
- Status badges (pending/running/success/error)

---

### MonitoringPanel.tsx

**Purpose:** Live VM metrics dashboard.

**Features:**
- Environment selector dropdown
- Auto-refresh toggle (10-second interval)
- Sortable metrics table
- Status indicators (healthy/warning/critical/error)
- Environment summary statistics
- Individual VM expansion for details

**Metrics Displayed:**
- Active Calls
- Max Sessions (capacity)
- Peak Calls
- Current CPS (calls per second)
- Max CPS
- Total Sessions
- Usage Percentage

**Sort Options:**
- Active Calls, Usage %, VM Name, IP
- Max Sessions, Peak Calls, Current CPS, Max CPS, Total Sessions

**State Used:**
- `monitorStore`: selectedEnvId, vmMetrics, summary, isLoading, autoRefresh, sortField, sortDirection

---

### AccessControlPanel.tsx

**Purpose:** User management interface (admin only).

**Features:**
- List all users with status
- Approve/Block/Delete users
- Toggle user role (admin/user)
- Permission toggles (env, exec, monitor)
- Temporary access with expiration
- User search/filter

**User States:**
- `pending`: Awaiting approval
- `active`: Full access
- `blocked`: Access denied

**State Used:**
- `authStore.user` (current admin)
- Local state for user list

**API Calls:**
- `GET /api/access-requests` - List users
- `PATCH /api/access-requests/:id/approve` - Approve user
- `PATCH /api/access-requests/:id/block` - Block user
- `PATCH /api/access-requests/:id/permissions` - Update permissions

---

### VMPasswordManager.tsx

**Purpose:** VM password management (admin only).

**Features:**
- List all VMs with password status
- View decrypted password
- Manual password change
- Auto-generate new password
- Password history
- Rate limiting (5 attempts/hour)

**Security:**
- Requires TOTP for destructive operations
- AES-256-GCM encryption
- Passwords never logged

**State Used:** Local component state

---

### AuditLogView.tsx

**Purpose:** Activity log viewer (admin only).

**Features:**
- Paginated log entries
- Search by action/user/VM
- Date range filter
- Export to CSV
- Action type badges

**Log Entry Fields:**
- Timestamp
- User (email)
- Action type
- Target (VM/Environment/User)
- Details

**State Used:** Local component state

---

### EmailSettings.tsx

**Purpose:** SMTP configuration (admin only).

**Features:**
- SMTP server settings
- Test email functionality
- Notification preferences
- Connection validation

**Settings:**
- Host, Port, User, Password
- From Name, From Email
- Use TLS toggle

**State Used:** Local component state

---

### GlobalSearch.tsx

**Purpose:** Search across all resources.

**Features:**
- Real-time search
- Debounced input
- Results grouped by type (VMs, Environments, Users)
- Quick navigation to results

**Search Scope:**
- VMs (name, IP)
- Environments (name)
- Users (email, name)

**State Used:** Local component state

---

### TwoFactorSetup.tsx

**Purpose:** TOTP setup for admin accounts.

**Features:**
- QR code display
- Manual secret entry
- Verification code input
- Disable 2FA option

**State Used:** Local component state

---

### TwoFactorModal.tsx

**Purpose:** TOTP verification prompt.

**Features:**
- 6-digit code input
- Cancel/Confirm actions
- Error display

**Used When:** Destructive operations require 2FA

---

### PendingApprovalScreen.tsx

**Purpose:** Shown to users awaiting approval.

**Features:**
- Waiting message
- Auto-refresh status
- Logout button

---

### Empty.tsx

**Purpose:** Reusable empty state component.

**Props:**
- `message`: Display text
- `icon`: Optional Lucide icon

---

## Component Communication

### WebSocket Events

Command execution uses WebSocket for real-time updates:

```
Frontend (vmStore) ←── WebSocket ──→ Backend (sshService)
                                        │
                                        ├── output event
                                        └── status event
```

### Event Flow

```
User clicks "Run"
        │
        ▼
CommandExecutor.tsx
        │ POST /api/execute
        ▼
Backend creates BullMQ jobs
        │
        ▼
Worker executes via SSH
        │
        ├── emits 'output' → vmStore.addLog()
        └── emits 'status' → vmStore.updateStatus()
        │
        ▼
UI updates in real-time
```

---

## Responsive Design

### Desktop Layout

```
┌─────────────────────────────────────────────────────────┐
│                    Top Bar (Tabs)                        │
├─────────────────────┬───────────────────────────────────┤
│                     │                                    │
│   Sidebar (Env &    │     Main Content Area              │
│   VM Selection)     │     (Command Executor /            │
│                     │      Monitoring / Admin Panels)    │
│                     │                                    │
└─────────────────────┴───────────────────────────────────┘
```

### Mobile Layout

```
┌─────────────────────────┐
│      Top Bar (Search)    │
├─────────────────────────┤
│                          │
│    Full-screen Panel     │
│    (Active Tab)          │
│                          │
├─────────────────────────┤
│   Bottom Navigation Bar  │
└─────────────────────────┘
```

---

## Styling Convention

- **Framework:** TailwindCSS
- **Color Scheme:** Dark theme (zinc-950 background)
- **Accent Color:** Blue-500
- **Icons:** Lucide React
- **Responsive:** Mobile-first with md: breakpoints
