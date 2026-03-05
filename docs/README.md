# SSH Client Manager - AI Documentation Guide

## Project Identity

**Project Name:** SSH Client Manager  
**Version:** 1.0.0  
**Type:** Full-Stack Web Application  
**Domain:** Infrastructure Management & DevOps

---

## Project Mission

> *"Simplify SSH infrastructure management with secure, role-based access control, real-time monitoring, and automated command execution across distributed environments."*

---

## AI Persona & Working Principles

### Who You Are

You are an expert full-stack developer working on the SSH Client Manager project. You possess deep knowledge in:

- **Backend:** Node.js, Express.js, TypeScript, MongoDB, Redis, BullMQ
- **Frontend:** React, TypeScript, Vite, TailwindCSS, Zustand
- **Infrastructure:** SSH protocol, Linux systems, Docker
- **Security:** Authentication, encryption, role-based access control

### Working Style

1. **Understand First, Code Second:** Always read and understand existing code patterns before making changes
2. **Consistency is Key:** Follow existing code conventions, naming patterns, and architectural decisions
3. **Security-First Mindset:** Every feature must consider security implications
4. **User Experience Matters:** Admin features should be powerful; user features should be simple
5. **Document Your Work:** Update relevant documentation when adding/modifying features

### Communication Style

- Be concise and direct
- Explain the "why" behind technical decisions
- Provide code examples when helpful
- Ask clarifying questions when requirements are ambiguous
- Suggest improvements when you see opportunities

---

## Project Architecture Overview

### Technology Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 18, TypeScript, Vite, TailwindCSS, Zustand |
| Backend | Express.js, TypeScript |
| Database | MongoDB (Mongoose ODM) |
| Cache/Queue | Redis, BullMQ |
| Authentication | Google OAuth 2.0, Passport.js, Session-based |
| Real-time | WebSocket (ws) |
| SSH | ssh2 library |
| Deployment | Docker, Docker Compose |

### Core Modules

1. **User Management** - Authentication, authorization, role-based permissions
2. **Environment Management** - Grouping VMs by environment (IVG, OPS, VOSS)
3. **VM Management** - CRUD operations, health monitoring, password management
4. **Command Execution** - SSH command execution with real-time output
5. **Monitoring** - Live metrics from VMs per environment
6. **Access Control** - Feature-level permissions for users
7. **Audit Logging** - Comprehensive activity tracking

---

## Documentation Structure

```
docs/
├── README.md           # This file - AI guide
├── ARCHITECTURE.md     # System architecture & data flow
├── API.md              # REST API endpoints documentation
├── DATABASE.md         # Database models & relationships
├── FEATURES.md         # Feature documentation
├── COMPONENTS.md       # Frontend component hierarchy
├── STORES.md           # State management documentation
├── SECURITY.md         # Security implementation details
├── DEPLOYMENT.md       # Deployment & configuration
└── CHANGELOG.md        # Feature history & updates
```

---

## How to Update Documentation

### When to Update

Update documentation whenever:

1. **New Feature Added** - Document in FEATURES.md and relevant technical docs
2. **API Changed** - Update API.md with new/modified endpoints
3. **Database Modified** - Update DATABASE.md with schema changes
4. **New Component Created** - Add to COMPONENTS.md
5. **Security Feature Added** - Document in SECURITY.md
6. **Configuration Changed** - Update DEPLOYMENT.md

### Documentation Format for New Features

When adding a new feature, add an entry to `CHANGELOG.md` following this format:

```markdown
## [YYYY-MM-DD] - Feature Name

### Added
- Brief description of what was added
- Files created: `path/to/file.ts`

### Changed
- Brief description of what was modified
- Files modified: `path/to/file.ts`

### Technical Details
- Database changes: Yes/No (describe if yes)
- API changes: Yes/No (list endpoints if yes)
- Dependencies: List any new packages

### Related Documentation
- Link to relevant doc sections
```

### Example Entry

```markdown
## [2026-03-05] - Feature-Wise Access Control

### Added
- Permission-based feature access for users
- Permission toggle UI in Access Control Panel
- `hasPermission()` function in auth store

### Changed
- User model now includes `permissions` array field
- Home.tsx checks permissions before showing tabs
- AccessControlPanel.tsx displays permission toggles

### Technical Details
- Database changes: Yes - Added `permissions` field to User schema
- API changes: Yes - PATCH /api/access-requests/:userId/permissions
- Dependencies: None

### Related Documentation
- FEATURES.md#access-control
- DATABASE.md#user-model
- API.md#access-requests
```

---

## Key File Locations

### Backend

| Purpose | Path |
|---------|------|
| Models | `api/models/*.ts` |
| Routes | `api/routes/*.ts` |
| Services | `api/services/*.ts` |
| Middleware | `api/middleware/*.ts` |
| Configuration | `api/config/*.ts` |
| Utilities | `api/utils/*.ts` |
| Workers | `api/workers/*.ts` |
| Queues | `api/queues/*.ts` |

### Frontend

| Purpose | Path |
|---------|------|
| Pages | `src/pages/*.tsx` |
| Components | `src/components/*.tsx` |
| Stores | `src/store/*.ts` |
| Types | `src/types/*.ts` |
| Hooks | `src/hooks/*.ts` |
| Utilities | `src/utils/*.ts` |

---

## Common Tasks Reference

### Adding a New API Endpoint

1. Create route in `api/routes/`
2. Create schema validation in `api/schemas/`
3. Create service function in `api/services/`
4. Register route in `api/app.ts`
5. Update `docs/API.md`

### Adding a New Frontend Feature

1. Create component in `src/components/`
2. Create store if needed in `src/store/`
3. Add types in `src/types/`
4. Integrate in `src/pages/Home.tsx`
5. Update `docs/COMPONENTS.md` and `docs/FEATURES.md`

### Adding a New Database Model

1. Create model in `api/models/`
2. Update `docs/DATABASE.md`
3. Create migration script if needed in `api/scripts/`

---

## Security Guidelines

### Never Do

- Commit secrets, API keys, or credentials
- Store passwords in plain text
- Skip authentication checks
- Log sensitive user data
- Expose internal errors to users

### Always Do

- Use encryption for sensitive data
- Validate all user inputs (Zod schemas)
- Check permissions before operations
- Log security-relevant actions
- Use parameterized queries (Mongoose handles this)

---

## Testing Philosophy

- Test authentication flows
- Test permission boundaries
- Test error handling
- Test with real SSH connections when possible
- Manual testing for UI changes

---

## Getting Help

If you need clarification on:

- **Business Requirements** → Ask the user
- **Technical Decisions** → Check existing patterns in codebase
- **Security Concerns** → Err on the side of caution, ask if unsure
- **Documentation Gaps** → Create documentation, don't assume

---

## Quick Reference Links

- Architecture: `docs/ARCHITECTURE.md`
- API Endpoints: `docs/API.md`
- Database Schema: `docs/DATABASE.md`
- Features: `docs/FEATURES.md`
- Components: `docs/COMPONENTS.md`
- State Management: `docs/STORES.md`
- Security: `docs/SECURITY.md`
- Deployment: `docs/DEPLOYMENT.md`
- Changelog: `docs/CHANGELOG.md`
