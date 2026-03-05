# Changelog

All notable changes to the SSH Client Manager project are documented here.

---

## [2026-03-05] - VM Tagging Feature

### Added

**VM Tagging System**
- Users with `exec` permission can add tags to VMs
- Each user can only tag a VM once
- After the first tag, users must request tag changes
- Admin approval required for tag change requests
- VMs can have multiple tags from different users
- Admin panel for managing tag requests

**Tag Management**
- Add tags directly from Monitoring panel
- Request tag changes (add/remove)
- Admin approval workflow for tag changes
- Tags displayed on VM cards in monitoring view

**New Admin Tab**
- "Tags" tab for managing tag change requests
- Approve/reject pending requests
- View all tag requests with filters

### Technical Details

**Database Changes:**
- Added `tags` array field to VM schema
- Created `TagRequest` model for tag change requests

**API Changes:**
- `GET /api/tags/vm/:vmId` - Get VM tags
- `POST /api/tags/vm/:vmId/add` - Add tag to VM
- `POST /api/tags/vm/:vmId/request-change` - Request tag change
- `GET /api/tags/requests/pending` - Get pending requests (admin)
- `GET /api/tags/requests/all` - Get all requests (admin)
- `PATCH /api/tags/requests/:requestId/review` - Approve/reject request (admin)
- `DELETE /api/tags/vm/:vmId/tag/:tagIndex` - Remove tag (admin)
- `GET /api/tags/vm/:vmId/my-tag` - Get current user's tag on VM
- `GET /api/tags/my-requests` - Get user's tag requests

**Files Created:**
- `api/models/TagRequest.ts`
- `api/routes/tags.ts`
- `api/schemas/tagSchema.ts`
- `src/components/TagRequestsPanel.tsx`

**Files Modified:**
- `api/models/VM.ts` - Added tags array
- `api/models/AuditLog.ts` - Added tag-related audit actions
- `api/app.ts` - Registered tags route
- `src/types/index.ts` - Added VMTag and TagRequest types
- `src/components/MonitoringPanel.tsx` - Added tag display and management UI
- `src/pages/Home.tsx` - Added Tags tab for admin

### Related Documentation

- FEATURES.md#vm-tagging (to be added)
- API.md#tags (to be added)
- DATABASE.md#vm-model

---

## [2026-03-05] - Feature-Wise Access Control & Monitoring

### Added

**Feature-Wise Access Control**
- Granular permission system for users (`env`, `exec`, `monitor`)
- Permission toggle UI in Access Control Panel
- `hasPermission()` function in auth store
- PATCH endpoint for updating user permissions

**Live Monitoring**
- Real-time metrics dashboard for VMs
- Per-environment monitoring with auto-refresh
- Sortable metrics table (12 sort options)
- Status indicators (healthy/warning/critical/error)
- Environment summary statistics

**Documentation**
- Complete `docs/` folder with comprehensive documentation
- AI-specific README with persona guidance
- Architecture, API, Database, Features, Components, Stores, Security, and Deployment docs

### Changed

**Command Execution**
- Commands now resolved per-VM from environment's `command` field
- Frontend shows read-only command display grouped by environment
- Fixed issue where OPS/VOSS used IVG command incorrectly

**Access Control**
- Removed admin-only restriction from Monitor tab
- Users can now access monitoring with `monitor` permission

**UI/UX**
- Fixed scroll issue in admin panels (Access, Passwords, Logs, Email)
- Permission-based tab visibility in Home.tsx

### Technical Details

**Database Changes:**
- Added `permissions` array field to User schema
- Added `monitoringCommand` field to Environment schema

**API Changes:**
- `POST /api/monitor` - New monitoring endpoint
- `PATCH /api/access-requests/:userId/permissions` - Update permissions

**Files Created:**
- `api/routes/monitor.ts`
- `api/services/monitorService.ts`
- `api/schemas/monitorSchema.ts`
- `src/components/MonitoringPanel.tsx`
- `src/store/monitorStore.ts`
- `docs/README.md`
- `docs/ARCHITECTURE.md`
- `docs/API.md`
- `docs/DATABASE.md`
- `docs/FEATURES.md`
- `docs/COMPONENTS.md`
- `docs/STORES.md`
- `docs/SECURITY.md`
- `docs/DEPLOYMENT.md`
- `docs/CHANGELOG.md`

**Files Modified:**
- `api/models/User.ts` - Added permissions field
- `api/models/Environment.ts` - Added monitoringCommand field
- `api/config/defaultEnvironments.ts` - Added monitoring commands
- `api/routes/execution.ts` - Per-VM command resolution
- `api/routes/accessRequests.ts` - Added permissions endpoint
- `api/app.ts` - Registered monitor route
- `src/pages/Home.tsx` - Permission-based tabs, monitoring tab
- `src/components/CommandExecutor.tsx` - Read-only command display
- `src/components/AccessControlPanel.tsx` - Permission toggles
- `src/store/authStore.ts` - Added hasPermission()
- `src/store/envStore.ts` - Added resetCommands()
- `src/types/index.ts` - Added monitoring and permission types

### Related Documentation

- FEATURES.md#access-control
- FEATURES.md#live-monitoring
- DATABASE.md#user-model
- DATABASE.md#environment-model
- API.md#monitor
- STORES.md#authStore
- STORES.md#monitorStore

---

## [2026-03-04] - Environment Commands Fix

### Added

- Migration script `api/scripts/migrate-commands.ts` for updating environment commands

### Changed

- Fixed environment command execution to resolve command per-VM
- Backend now looks up each VM's environment to get the correct command
- Frontend command display is now read-only (users cannot edit)

### Technical Details

**Issue:** OPS and VOSS environments were incorrectly using IVG's command because `selectedEnvId` was never updated when selecting VMs from different environments.

**Solution:** Command is now resolved on the backend per-VM by looking up the VM's environment.

**Files Modified:**
- `api/routes/execution.ts` - Per-VM command resolution
- `src/components/CommandExecutor.tsx` - Read-only command display

---

## [2026-03-03] - Admin Panel Scroll Fix

### Fixed

- Scroll issue in admin panels (Access, Passwords, Logs, Email)
- Parent container was preventing scroll with `overflow-hidden`

### Technical Details

**Files Modified:**
- `src/pages/Home.tsx` - Removed `overflow-hidden`, added `h-full` to containers

---

## [2026-02-28] - Initial Release

### Added

**Core Features:**
- User Management with Google OAuth authentication
- Role-based access control (Admin/User)
- Environment Management (IVG, OPS, VOSS)
- VM Management with SSH connectivity
- Command Execution with real-time output
- Password Management with AES-256 encryption
- Health Monitoring with notifications
- Two-Factor Authentication (TOTP)
- Audit Logging
- Email Notifications
- Push Notifications
- Global Search
- IP Whitelisting
- PIN Protection

**Infrastructure:**
- Docker containerization
- Redis for sessions and queues
- MongoDB database
- BullMQ for job processing
- WebSocket for real-time updates

**Frontend:**
- React 18 with TypeScript
- Vite build tool
- TailwindCSS styling
- Zustand state management
- Responsive design (mobile/desktop)

**Backend:**
- Express.js with TypeScript
- Mongoose ODM
- SSH2 for connections
- Passport.js for authentication
- Zod for validation

### Technical Details

**Dependencies:**
- Backend: express, mongoose, ssh2, passport, zod, bullmq, redis
- Frontend: react, zustand, tailwindcss, lucide-react

---

## Version History

| Version | Date | Major Changes |
|---------|------|---------------|
| 1.1.0 | 2026-03-05 | Feature-wise permissions, Live monitoring, Documentation |
| 1.0.1 | 2026-03-04 | Environment commands fix |
| 1.0.0 | 2026-02-28 | Initial release |

---

## Upcoming Features

- [ ] Batch command execution history
- [ ] Custom command templates
- [ ] SSH key-based authentication
- [ ] Scheduled command execution
- [ ] Multi-region support
- [ ] Performance dashboard
- [ ] Mobile app
