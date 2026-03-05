# State Management

## Overview

The application uses **Zustand** for state management - a lightweight, hook-based state library.

---

## Store Architecture

```
src/store/
├── authStore.ts     # Authentication & user state
├── envStore.ts      # Environment management
├── vmStore.ts       # VM selection & execution
└── monitorStore.ts  # Monitoring metrics
```

---

## authStore

**File:** `src/store/authStore.ts`

### State

| Property | Type | Description |
|----------|------|-------------|
| `user` | `User \| null` | Current authenticated user |
| `isLoading` | `boolean` | Auth check in progress |
| `error` | `string \| null` | Auth error message |
| `isPinVerified` | `boolean` | PIN verification status |
| `isAdmin` | `boolean` | User is admin |

### Actions

| Action | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `checkAuth` | - | `Promise<void>` | Fetch current user from session |
| `logout` | - | `Promise<void>` | End session and clear state |
| `verifyPin` | `pin: string` | `Promise<boolean>` | Verify PIN and set isPinVerified |
| `hasPermission` | `permission: UserPermission` | `boolean` | Check if user has feature permission |

### Usage Example

```typescript
import { useAuthStore } from '@/store/authStore';

function MyComponent() {
  const { user, isAdmin, hasPermission } = useAuthStore();
  
  if (!hasPermission('exec')) {
    return <div>Access denied</div>;
  }
  
  return <div>Welcome, {user?.email}</div>;
}
```

### Permission Logic

```typescript
hasPermission(permission) {
  // Admins have all permissions
  if (isAdmin) return true;
  
  // Not logged in
  if (!user) return false;
  
  // Check user's permissions array
  // Falls back to DEFAULT_PERMISSIONS: ['env', 'exec', 'monitor']
  const permissions = user.permissions || DEFAULT_PERMISSIONS;
  return permissions.includes(permission);
}
```

---

## envStore

**File:** `src/store/envStore.ts`

### State

| Property | Type | Description |
|----------|------|-------------|
| `environments` | `Environment[]` | All available environments |
| `selectedEnvId` | `string` | Currently selected environment ID |
| `isLoading` | `boolean` | Fetch in progress |

### Actions

| Action | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `fetchEnvironments` | - | `Promise<void>` | Load environments from API |
| `addEnvironment` | `name: string` | `Promise<void>` | Create new environment |
| `updateEnvironment` | `id, data` | `Promise<void>` | Update environment fields |
| `deleteEnvironment` | `id, totpCode?` | `Promise<{success, error?}>` | Delete environment |
| `selectEnvironment` | `id: string` | `void` | Set selected environment |
| `resetCommands` | - | `Promise<{success, updatedCount?}>` | Reset all environment commands |

### Environment Interface

```typescript
interface Environment {
  id: string;
  name: string;
  command?: string;
  monitoringCommand?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Optimization

- Skips unnecessary re-renders by comparing JSON
- Only sets loading on first fetch
- Validates selectedEnvId against available environments

---

## vmStore

**File:** `src/store/vmStore.ts`

### State

| Property | Type | Description |
|----------|------|-------------|
| `vmGroups` | `VMGroup[]` | VMs grouped by environment |
| `selectedVmIds` | `string[]` | Currently selected VM IDs |
| `activeTerminalVmId` | `string \| null` | VM with focused terminal |
| `expandedEnvIds` | `string[]` | Expanded environment IDs |
| `logs` | `ExecutionLog[]` | Command execution logs |
| `statuses` | `Record<string, Status>` | Execution status per VM |
| `isLoading` | `boolean` | Fetch in progress |

### Selection Actions

| Action | Parameters | Description |
|--------|------------|-------------|
| `toggleVMSelection` | `id: string` | Toggle single VM selection |
| `selectAllVMs` | - | Select all VMs |
| `selectAllVMsInEnv` | `envId: string` | Select all VMs in environment |
| `deselectAllVMs` | - | Clear all selections |
| `deselectAllVMsInEnv` | `envId: string` | Deselect VMs in environment |

### UI Actions

| Action | Parameters | Description |
|--------|------------|-------------|
| `toggleEnvExpand` | `envId: string` | Expand/collapse environment |
| `expandAllEnvs` | - | Expand all environments |
| `collapseAllEnvs` | - | Collapse all environments |
| `setActiveTerminalVmId` | `id` | Set focused terminal VM |

### Execution Actions

| Action | Parameters | Description |
|--------|------------|-------------|
| `addLog` | `log: ExecutionLog` | Add execution log entry |
| `updateStatus` | `status: ExecutionStatus` | Update VM status |
| `clearLogs` | - | Clear all logs and statuses |

### CRUD Actions

| Action | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `fetchVMGroups` | `forceRefresh?` | `Promise<void>` | Load VMs with caching |
| `addVM` | `vm: Omit<VM, 'id'>` | `Promise<void>` | Create new VM |
| `updateVM` | `id, vmData` | `Promise<void>` | Update VM fields |
| `deleteVM` | `id: string` | `Promise<void>` | Delete VM |

### Caching

```typescript
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  data: VMGroup[];
  timestamp: number;
}
```

- Uses in-memory cache with 5-minute TTL
- Skips API call if cache is valid
- `forceRefresh` bypasses cache

### VMGroup Interface

```typescript
interface VMGroup {
  environmentId: string;
  environmentName: string;
  vms: VM[];
  vmCount: number;
}

interface VM {
  id: string;
  name: string;
  ip: string;
  port: number;
  username: string;
  environmentId: string;
  isPinned: boolean;
  lastHealthCheck?: Date;
  healthStatus?: 'healthy' | 'unhealthy';
}
```

### Execution Log Interface

```typescript
interface ExecutionLog {
  vmId: string;
  vmName: string;
  type: 'stdout' | 'stderr' | 'system';
  data: string;
  timestamp: Date;
}

type ExecutionStatus = {
  vmId: string;
  status: 'pending' | 'running' | 'success' | 'error';
};
```

---

## monitorStore

**File:** `src/store/monitorStore.ts`

### State

| Property | Type | Description |
|----------|------|-------------|
| `selectedEnvId` | `string \| null` | Selected environment for monitoring |
| `environmentName` | `string \| null` | Environment display name |
| `configured` | `boolean` | Environment has monitoring command |
| `message` | `string \| null` | Status/error message |
| `summary` | `EnvironmentSummary \| null` | Aggregate statistics |
| `vmMetrics` | `Record<string, MonitoringMetrics>` | Metrics per VM |
| `isLoading` | `boolean` | Fetch in progress |
| `autoRefresh` | `boolean` | Auto-refresh enabled |
| `lastUpdated` | `Date \| null` | Last fetch timestamp |
| `expandedVmIds` | `string[]` | Expanded VM detail rows |
| `sortField` | `SortField` | Current sort column |
| `sortDirection` | `SortDirection` | Sort order (asc/desc) |

### Sort Types

```typescript
type SortField = 
  | 'vmName' | 'vmIp' 
  | 'activeCalls' | 'maxSessions' | 'peakCalls' 
  | 'currentCPS' | 'maxCPS' | 'totalSessions' 
  | 'usagePercent';

type SortDirection = 'asc' | 'desc';
```

### Actions

| Action | Parameters | Returns | Description |
|--------|------------|---------|-------------|
| `selectEnvironment` | `envId: string` | `void` | Select environment and fetch metrics |
| `fetchMetrics` | - | `Promise<void>` | Load metrics from API |
| `toggleAutoRefresh` | - | `void` | Toggle auto-refresh |
| `toggleVmExpand` | `vmId: string` | `void` | Expand/collapse VM details |
| `clearSelection` | - | `void` | Reset all state |
| `setSort` | `field, direction` | `void` | Set sort parameters |
| `getSortedVmMetrics` | - | `MonitoringMetrics[]` | Get sorted metrics array |

### Metrics Interface

```typescript
interface MonitoringMetrics {
  vmId: string;
  vmName: string;
  vmIp: string;
  status: 'healthy' | 'warning' | 'critical' | 'error';
  activeCalls: number;
  maxSessions: number;
  peakCalls: number;
  currentCPS: number;
  maxCPS: number;
  totalSessions: number;
  usagePercent: number;
  error?: string;
}

interface EnvironmentSummary {
  totalVMs: number;
  healthyVMs: number;
  warningVMs: number;
  criticalVMs: number;
  errorVMs: number;
  totalActiveCalls: number;
  totalMaxSessions: number;
  totalPeakCalls: number;
  avgUsagePercent: number;
}
```

### Sorting Logic

```typescript
getSortedVmMetrics() {
  const metrics = Object.values(vmMetrics);
  
  return metrics.sort((a, b) => {
    const aVal = a[sortField];
    const bVal = b[sortField];
    
    // String comparison
    if (typeof aVal === 'string') {
      return sortDirection === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }
    
    // Number comparison
    if (typeof aVal === 'number') {
      return sortDirection === 'asc'
        ? aVal - bVal
        : bVal - aVal;
    }
    
    return 0;
  });
}
```

---

## Store Usage Patterns

### Selectors for Performance

Use selectors to prevent unnecessary re-renders:

```typescript
// Good - only re-renders when selectedVmIds changes
const selectedVmIds = useVMStore(state => state.selectedVmIds);

// Avoid - re-renders on any vmStore change
const { selectedVmIds, vmGroups } = useVMStore();
```

### Multiple Store Access

```typescript
function MyComponent() {
  const isAdmin = useAuthStore(state => state.isAdmin);
  const selectedEnvId = useEnvStore(state => state.selectedEnvId);
  const selectedVmIds = useVMStore(state => state.selectedVmIds);
  
  // ...
}
```

### Action Usage

```typescript
function VMList() {
  const toggleVMSelection = useVMStore(state => state.toggleVMSelection);
  
  return (
    <button onClick={() => toggleVMSelection(vm.id)}>
      Select
    </button>
  );
}
```

---

## WebSocket Integration

The vmStore receives real-time updates via WebSocket:

```typescript
// In WebSocket connection handler
socket.on('output', (log: ExecutionLog) => {
  useVMStore.getState().addLog(log);
});

socket.on('status', (status: ExecutionStatus) => {
  useVMStore.getState().updateStatus(status);
});
```

---

## State Flow Diagram

```
User Action
     │
     ▼
Component calls store action
     │
     ▼
Action updates state (set())
     │
     ▼
Zustand notifies subscribers
     │
     ▼
Components using that state re-render
```
