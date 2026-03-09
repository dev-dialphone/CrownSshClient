# AI Agent Universal Working Guide

> **This document provides universal instructions for AI agents working on any codebase. Adapt the project-specific sections for your project.**

---

## 🤖 AI AGENT SYSTEM INSTRUCTIONS

> **CRITICAL: Read this entire section before starting any task. These rules apply to ALL projects.**

### Your Role

You are an expert software engineer. Your responsibilities are:
- Write clean, maintainable, production-quality code
- Follow existing patterns and conventions in the codebase
- Maintain architecture and code organization
- Keep documentation synchronized with code changes
- Ensure type safety and code quality

---

### Mandatory 5-Phase Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    AI AGENT WORKFLOW (ALWAYS FOLLOW)                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PHASE 1: DISCOVERY                                                         │
│  ───────────────────────                                                    │
│  1. Read this README completely                                             │
│  2. Explore the codebase structure (directories, key files)                 │
│  3. Identify the technology stack                                           │
│  4. Find and read existing documentation                                    │
│  5. Understand the project's purpose and domain                             │
│                                                                              │
│  PHASE 2: ANALYSIS                                                          │
│  ───────────────────────                                                    │
│  1. Identify which files/modules your change affects                        │
│  2. Understand existing patterns and conventions                            │
│  3. Determine the correct order of modifications                            │
│  4. List all files that need changes                                        │
│  5. Identify documentation that needs updates                               │
│                                                                              │
│  PHASE 3: IMPLEMENTATION                                                    │
│  ───────────────────────                                                    │
│  1. Make changes following existing patterns                                │
│  2. Maintain consistency with the codebase                                  │
│  3. Follow the architecture (do not break layer boundaries)                 │
│  4. Write code that matches the existing style                              │
│  5. Keep changes minimal and focused                                        │
│                                                                              │
│  PHASE 4: VERIFICATION                                                      │
│  ───────────────────────                                                    │
│  1. Run build/compile command (must pass)                                   │
│  2. Run lint/type-check command (must pass)                                 │
│  3. Run tests if available                                                  │
│  4. Manual testing if applicable                                            │
│                                                                              │
│  PHASE 5: DOCUMENTATION                                                     │
│  ───────────────────────                                                    │
│  1. Update README if features changed                                       │
│  2. Update architecture docs if structure changed                           │
│  3. Update API docs if endpoints changed                                    │
│  4. Add inline docs only if explicitly requested                            │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Universal Code Rules

| Rule | Description |
|------|-------------|
| **No comments** | Do not add code comments unless explicitly requested |
| **No any** | Never use `any` or equivalent loose types |
| **Follow patterns** | Match existing code patterns exactly |
| **Small changes** | Make minimal, focused changes |
| **Read first** | Always read existing code before modifying |
| **Preserve style** | Maintain existing code style and formatting |
| **No premature abstraction** | Don't create abstractions unless needed |

---

### Pre-Task Checklist

Before starting ANY task:

```
□ I have read this README completely
□ I have explored the codebase structure
□ I understand the technology stack
□ I have identified files to modify
□ I have read existing patterns in those files
□ I understand the change order
```

### Post-Task Checklist

After completing ANY task:

```
□ Build/compile passes with no errors
□ Lint/type-check passes with no errors
□ Tests pass (if available)
□ Documentation updated (if needed)
□ Changes follow existing patterns
□ No unnecessary code added
```

---

## 📁 Project Information

> **Fill in this section for your specific project.**

### Project Overview

| Property | Value |
|----------|-------|
| **Name** | SSH Client Manager |
| **Purpose** | Web-based SSH client for managing VMs, executing commands, monitoring, and password management |
| **Type** | Full-stack Web Application (React Frontend + Express Backend) |
| **Status** | Active Development |

### Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Language | TypeScript | 5.8.x |
| Frontend Framework | React | 18.3.x |
| Build Tool | Vite | 6.3.x |
| Backend Framework | Express | 4.21.x |
| Database | MongoDB (via Mongoose) | 9.2.x |
| State Management | Zustand | 5.0.x |
| Styling | Tailwind CSS | 3.4.x |
| SSH Client | ssh2 | 1.17.x |
| Authentication | Passport.js (Google OAuth + Local) | 0.7.x |
| Real-time | WebSocket (ws) | 8.19.x |

### Key Commands

| Command | Purpose |
|---------|---------|
| `npm run dev` | Start both frontend and backend in development mode |
| `npm run client:dev` | Start only frontend dev server |
| `npm run server:dev` | Start only backend dev server (with nodemon) |
| `npm run build` | Build frontend for production |
| `npm run check` | Run TypeScript type checking |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build |

---

## 🏗️ Architecture

### High-Level Architecture

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   React SPA     │────▶│  Express API    │────▶│    MongoDB      │
│   (Frontend)    │◀────│   (Backend)     │◀────│   (Database)    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
        │                       │
        │                       │
        ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│    Zustand      │     │   SSH2 Client   │
│    (State)      │     │   (VM Access)   │
└─────────────────┘     └─────────────────┘
```

### Directory Structure

```
project-root/
├── api/                      # Backend API (Express)
│   ├── routes/               # API route handlers
│   │   ├── auth.ts           # Authentication routes
│   │   ├── vms.ts            # VM CRUD operations
│   │   ├── password/         # Password management routes (split by concern)
│   │   │   ├── index.ts      # Bulk password operations
│   │   │   └── vmPasswordRoutes.ts  # Single VM password operations
│   │   ├── environments.ts   # Environment management
│   │   ├── execution.ts      # Command execution
│   │   ├── monitor.ts        # Monitoring endpoints
│   │   └── tags.ts           # VM tagging system
│   ├── services/             # Business logic layer
│   │   ├── ssh/              # SSH operations (split by concern)
│   │   │   ├── index.ts      # Main SSH service entry
│   │   │   ├── connectionUtils.ts  # Connection helpers
│   │   │   ├── passwordChanger.ts  # Password change logic
│   │   │   ├── osUtils.ts    # OS detection utilities
│   │   │   └── passwordUtils.ts    # Password generation
│   │   ├── vmService.ts      # VM database operations
│   │   ├── emailService.ts   # Email notifications
│   │   └── monitorService.ts # Monitoring service
│   ├── models/               # Mongoose models
│   ├── middleware/           # Express middleware
│   ├── schemas/              # Zod validation schemas
│   └── utils/                # Utility functions
├── src/                      # Frontend (React)
│   ├── components/           # React components
│   │   ├── PasswordManager/  # Password management components (split)
│   │   │   ├── BulkPasswordUpdate.tsx
│   │   │   ├── EnvironmentBulkUpdate.tsx
│   │   │   ├── SingleVMPasswordManager.tsx
│   │   │   └── PasswordHistory.tsx
│   │   ├── Monitoring/       # Monitoring components (split)
│   │   │   ├── EnvironmentSidebar.tsx
│   │   │   ├── EnvironmentSummary.tsx
│   │   │   ├── VMMetricsCard.tsx
│   │   │   └── TagModal.tsx
│   │   └── ...               # Other components
│   ├── hooks/                # Custom React hooks
│   │   └── password/         # Password-related hooks
│   │       ├── usePasswordHistory.ts
│   │       ├── useRateLimit.ts
│   │       ├── usePasswordGeneration.ts
│   │       └── useVmPasswordHistory.ts
│   ├── store/                # Zustand stores
│   │   ├── authStore.ts      # Authentication state
│   │   ├── vmStore.ts        # VM data state
│   │   ├── envStore.ts       # Environment state
│   │   └── monitorStore.ts   # Monitoring state
│   ├── pages/                # Page components
│   ├── types/                # TypeScript type definitions
│   └── lib/                  # Utility functions
├── public/                   # Static assets
├── docs/                     # Documentation
└── package.json              # Dependencies and scripts
```

### Key Files

| File | Purpose | When to Modify |
|------|---------|----------------|
| `api/app.ts` | Main Express application setup | Adding new middleware/routes |
| `api/routes/vms.ts` | VM CRUD and password route mounting | VM-related endpoints |
| `api/routes/password/index.ts` | Bulk password operations | Bulk update logic |
| `api/routes/password/vmPasswordRoutes.ts` | Single VM password ops | Per-VM password changes |
| `api/services/ssh/index.ts` | SSH connection service | SSH operations |
| `src/store/authStore.ts` | Authentication state | Auth state changes |
| `src/store/vmStore.ts` | VM data state | VM state management |
| `src/types/index.ts` | Shared TypeScript types | Type definitions |

### Data Flow

```
User Action → React Component → Zustand Store → API Route → Service Layer → Database
                                              ↓
                                         SSH Service → VM (via SSH2)
                                              ↓
                                    Response → Component Update
```

---

## 📝 Coding Standards

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files (components) | PascalCase.tsx | `VMPasswordManager.tsx` |
| Files (hooks) | camelCase.ts | `usePasswordHistory.ts` |
| Files (services) | camelCase.ts | `vmService.ts` |
| Files (routes) | camelCase.ts | `vms.ts` |
| Components | PascalCase | `BulkPasswordUpdate` |
| Functions | camelCase | `fetchVmTags` |
| Variables | camelCase | `selectedVmId` |
| Constants | SCREAMING_SNAKE_CASE | `SAFE_SPECIAL_CHARS` |
| Interfaces | PascalCase | `VM`, `User`, `Environment` |
| Types | PascalCase | `UserPermission` |

### Import Order

```typescript
// 1. React and standard library imports
import React, { useState, useEffect } from 'react';

// 2. Third-party imports
import { Eye, EyeOff, Copy } from 'lucide-react';
import { useVMStore } from '../store/vmStore';

// 3. Internal imports (use relative paths)
import { BulkPasswordUpdate } from './PasswordManager';
import { usePasswordHistory } from '../hooks/password';
```

### Code Organization

| Layer/Directory | Responsibility | Can Depend On |
|-----------------|----------------|---------------|
| `api/routes/` | HTTP request handling, validation | services, middleware, utils |
| `api/services/` | Business logic, external integrations | models, utils, other services |
| `api/models/` | Database schema, data access | mongoose |
| `api/middleware/` | Request preprocessing | models, utils |
| `src/components/` | UI rendering, user interaction | hooks, store, types |
| `src/hooks/` | Reusable stateful logic | store, types, API calls |
| `src/store/` | Global state management | types, API calls |
| `src/types/` | Type definitions | nothing |

### Forbidden Patterns

```
❌ DO NOT:
- Create files over 500 lines (split into smaller modules)
- Use `any` type
- Mix business logic in components (use hooks/services)
- Import from barrel files in same directory (use relative imports)
- Put multiple components in one file (one component per file)

✅ INSTEAD:
- Split large files by single responsibility
- Use proper TypeScript types from `src/types/`
- Extract logic to custom hooks or services
- Use explicit imports
- One component per file with index.ts for exports
```

---

## 🔄 Making Changes

### Change Workflow

```
1. UNDERSTAND
   └── Read existing code
   └── Understand patterns
   └── Identify affected files

2. PLAN
   └── List files to modify
   └── Determine change order
   └── Check for dependencies

3. IMPLEMENT
   └── Make changes
   └── Follow patterns
   └── Keep minimal

4. VERIFY
   └── Build passes
   └── Tests pass
   └── Lint passes

5. DOCUMENT
   └── Update docs if needed
```

### Where to Make Changes

| Change Type | Files to Modify | Order |
|-------------|-----------------|-------|
| Add new API endpoint | `api/routes/[route].ts` → `api/services/[service].ts` | 1→2 |
| Add new frontend feature | `src/types/index.ts` → `src/store/[store].ts` → `src/hooks/` → `src/components/` | 1→2→3→4 |
| Add new SSH operation | `api/services/ssh/[module].ts` → `api/services/ssh/index.ts` → `api/routes/` | 1→2→3 |
| Modify password logic | `api/services/ssh/passwordChanger.ts` or `api/routes/password/` | 1 |
| Add new VM field | `src/types/index.ts` → `api/models/VM.ts` → `api/services/vmService.ts` → `src/components/` | 1→2→3→4 |

### Common Tasks

#### Task: Add new password operation

```
Files to modify:
├── api/routes/password/vmPasswordRoutes.ts  # Add route handler
├── api/services/ssh/passwordChanger.ts      # Add business logic
└── src/components/PasswordManager/          # Add UI component

Steps:
1. Add route in vmPasswordRoutes.ts following existing patterns
2. Implement logic in passwordChanger.ts
3. Create or update component in PasswordManager/
4. Run npm run check && npm run lint
```

#### Task: Add new monitoring feature

```
Files to modify:
├── api/routes/monitor.ts                    # Add endpoint
├── api/services/monitorService.ts           # Add service method
├── src/store/monitorStore.ts                # Add state
├── src/components/Monitoring/               # Add component

Steps:
1. Add endpoint in monitor.ts
2. Implement service method
3. Update Zustand store
4. Create UI component
5. Run npm run check && npm run lint
```

---

## 🧪 Testing & Verification

### Test Commands

```bash
# Type checking
npm run check

# Linting
npm run lint

# Build
npm run build

# Development (both frontend and backend)
npm run dev
```

### Verification Checklist

```
□ npm run check passes
□ npm run lint passes (or only existing errors)
□ npm run build completes successfully
□ Manual testing completed
□ Edge cases tested
```

### Before Committing

```bash
# 1. Type check
npm run check

# 2. Lint
npm run lint

# 3. Build
npm run build
```

---

## 📚 Documentation

### Documentation Structure

```
docs/
├── ARCHITECTURE.md    # System architecture details
├── API.md             # API endpoint documentation
├── FEATURES.md        # Feature documentation
├── COMPONENTS.md      # Component documentation
├── STORES.md          # State management documentation
└── README.md          # This file
```

### When to Update Documentation

| Change Type | Update |
|-------------|--------|
| New feature | FEATURES.md, API.md |
| Architecture change | ARCHITECTURE.md |
| New API endpoint | API.md |
| New component | COMPONENTS.md |
| Store change | STORES.md |
| Bug fix | No update needed |

---

## 🔧 Development Setup

### Prerequisites

```
- Node.js (v18+)
- npm (v9+)
- MongoDB (v6+)
- Google OAuth credentials (for authentication)
```

### Initial Setup

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your values:
# - MONGODB_URI
# - SESSION_SECRET
# - GOOGLE_CLIENT_ID
# - GOOGLE_CLIENT_SECRET
# - FRONTEND_URL
# - VITE_API_URL

# 3. Start MongoDB (if local)

# 4. Start development
npm run dev
```

### Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `MONGODB_URI` | MongoDB connection string | Yes |
| `SESSION_SECRET` | Express session secret | Yes |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Yes |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Yes |
| `FRONTEND_URL` | Frontend URL for CORS | Yes |
| `VITE_API_URL` | API URL for frontend | Yes |
| `SMTP_HOST` | Email SMTP host | No |
| `SMTP_USER` | Email SMTP user | No |
| `SMTP_PASSWORD` | Email SMTP password | No |

---

## 🐛 Troubleshooting

### Common Issues

#### Issue: TypeScript errors after adding new types

```
Error: Property 'X' does not exist on type 'Y'

Solution:
1. Ensure type is exported from src/types/index.ts
2. Run npm run check to verify
3. Restart TypeScript server in your IDE
```

#### Issue: Import errors in new files

```
Error: Cannot find module '...'

Solution:
1. Check import path is correct (use .js extension for ES modules)
2. For services importing from subdirectories, check path depth
3. Use relative imports, not absolute paths
```

#### Issue: ESLint errors on existing code

```
Error: Various ESLint errors

Solution:
- Existing codebase has some ESLint errors with `any` types
- New code should NOT add new errors
- Focus on type safety in new code
```

### Error Resolution Flow

```
Error Occurs
     │
     ▼
┌─────────────────┐
│ Build error?    │──Yes──▶ Check syntax, imports, types
└─────────────────┘
     │ No
     ▼
┌─────────────────┐
│ Runtime error?  │──Yes──▶ Check logs, environment, config
└─────────────────┘
     │ No
     ▼
┌─────────────────┐
│ Lint error?     │──Yes──▶ Check code style, types
└─────────────────┘
     │ No
     ▼
┌─────────────────┐
│ Other           │───▶ Check documentation, search issues
└─────────────────┘
```

---

## 📋 Quick Reference

### File Types

| Extension | Purpose |
|-----------|---------|
| `.tsx` | React components |
| `.ts` | TypeScript files (hooks, services, routes, stores) |
| `.css` | Global styles (Tailwind) |
| `.json` | Data files, configuration |

### Key Directories

| Directory | Purpose |
|-----------|---------|
| `api/routes/` | API endpoint definitions |
| `api/services/` | Business logic |
| `api/services/ssh/` | SSH operations (split by concern) |
| `api/routes/password/` | Password management routes |
| `src/components/` | React UI components |
| `src/components/PasswordManager/` | Password management UI |
| `src/components/Monitoring/` | Monitoring UI |
| `src/hooks/` | Custom React hooks |
| `src/hooks/password/` | Password-related hooks |
| `src/store/` | Zustand state stores |
| `src/types/` | TypeScript type definitions |

### Important Files

| File | Purpose |
|------|---------|
| `api/app.ts` | Express app configuration |
| `src/types/index.ts` | Shared types |
| `src/store/authStore.ts` | Auth state |
| `src/store/vmStore.ts` | VM state |
| `api/services/ssh/index.ts` | SSH service entry point |

---

## ✅ AI Agent Final Checklist

### Before Starting

```
□ Read this README completely
□ Explored codebase structure
□ Understood technology stack
□ Found existing patterns
□ Identified files to modify
```

### During Implementation

```
□ Following existing patterns
□ Code style is consistent
□ No unnecessary abstractions
□ No forbidden patterns used
□ Changes are minimal and focused
□ Files stay under 500 lines
```

### Before Completing

```
□ Build/compile passes
□ Lint/type-check passes
□ No new lint errors introduced
□ Documentation updated
□ No debug code left
□ No commented code left
```

---

## 📞 Resources

| Resource | Link |
|----------|------|
| Documentation | `docs/` directory |
| API Reference | `docs/API.md` |
| Architecture | `docs/ARCHITECTURE.md` |

---

## 📝 Changelog

### Recent Changes

| Date | Change | Author |
|------|--------|--------|
| 2026-03-09 | Refactored large files to follow SOLID principles | AI Agent |
| 2026-03-09 | Split VMPasswordManager.tsx (1169→270 lines) | AI Agent |
| 2026-03-09 | Split vms.ts routes (919→253 lines) | AI Agent |
| 2026-03-09 | Split MonitoringPanel.tsx (662→234 lines) | AI Agent |
| 2026-03-09 | Split sshService.ts into modular services | AI Agent |
| 2026-03-09 | Added custom hooks for password operations | AI Agent |
| 2026-03-09 | Created project documentation | AI Agent |

---

*README Version: 1.0.0*
*Last Updated: 2026-03-09*
