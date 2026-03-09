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
| **Name** | [Project Name] |
| **Purpose** | [Brief description] |
| **Type** | [Web App / API / CLI / Library / Mobile App / Other] |
| **Status** | [Active / Maintenance / Development] |

### Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Language | [e.g., TypeScript, Python, Go] | [version] |
| Framework | [e.g., Next.js, Django, Gin] | [version] |
| Database | [e.g., PostgreSQL, MongoDB] | [version] |
| Runtime | [e.g., Node.js, Python, Go] | [version] |
| Build Tool | [e.g., npm, pip, go mod] | [version] |

### Key Commands

| Command | Purpose |
|---------|---------|
| `[install cmd]` | Install dependencies |
| `[dev cmd]` | Start development server |
| `[build cmd]` | Build for production |
| `[test cmd]` | Run tests |
| `[lint cmd]` | Run linter/type checker |

---

## 🏗️ Architecture

> **Document your architecture here. Update as the codebase evolves.**

### High-Level Architecture

```
[ASCII diagram of your architecture]

Example:
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Client    │────▶│   Server    │────▶│  Database   │
└─────────────┘     └─────────────┘     └─────────────┘
```

### Directory Structure

```
project-root/
├── [dir1]/              # [Description]
│   ├── [file1]          # [Purpose]
│   └── [file2]          # [Purpose]
├── [dir2]/              # [Description]
│   └── ...
├── [config files]       # [Purpose]
└── README.md            # This file
```

### Key Files

| File | Purpose | When to Modify |
|------|---------|----------------|
| `[file path]` | [Description] | [Condition] |
| `[file path]` | [Description] | [Condition] |

### Data Flow

```
[ASCII diagram of data flow]

Example:
User Input → Controller → Service → Repository → Database
                         ↓
                      Response
```

---

## 📝 Coding Standards

> **Define your project-specific coding standards here.**

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Files | [pattern] | `example.ts` |
| Components | [pattern] | `ExampleComponent` |
| Functions | [pattern] | `doSomething` |
| Variables | [pattern] | `userName` |
| Constants | [pattern] | `MAX_SIZE` |
| Classes | [pattern] | `UserService` |

### Import Order

```[language]
// 1. External/standard library imports
// 2. Third-party imports
// 3. Internal imports (use aliases if available)
// 4. Relative imports (avoid when possible)
```

### Code Organization

| Layer/Directory | Responsibility | Can Depend On |
|-----------------|----------------|---------------|
| `[layer1]` | [Description] | [dependencies] |
| `[layer2]` | [Description] | [dependencies] |

### Forbidden Patterns

```
❌ DO NOT:
- [Anti-pattern 1]
- [Anti-pattern 2]
- [Anti-pattern 3]

✅ INSTEAD:
- [Correct pattern 1]
- [Correct pattern 2]
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
| Add new feature | [list files] | 1→2→3 |
| Add new field | [list files] | 1→2→3 |
| Fix bug | [list files] | 1→2→3 |
| Add new API endpoint | [list files] | 1→2→3 |
| Modify database | [list files] | 1→2→3 |

### Common Tasks

#### Task: [Task Name]

```
Files to modify:
├── [file1]    # [what to change]
├── [file2]    # [what to change]
└── [file3]    # [what to change]

Steps:
1. [Step 1]
2. [Step 2]
3. [Step 3]
```

---

## 🧪 Testing & Verification

### Test Commands

```bash
# Run all tests
[command]

# Run specific test
[command]

# Run with coverage
[command]
```

### Verification Checklist

```
□ [build/compile command] passes
□ [lint command] passes
□ [test command] passes
□ Manual testing completed
□ Edge cases tested
```

### Before Committing

```bash
# 1. Build/compile
[build command]

# 2. Lint/check
[lint command]

# 3. Test
[test command]
```

---

## 📚 Documentation

### Documentation Structure

```
docs/
├── [doc1].md       # [Purpose]
├── [doc2].md       # [Purpose]
└── README.md       # This file
```

### When to Update Documentation

| Change Type | Update |
|-------------|--------|
| New feature | README.md, API docs |
| Architecture change | Architecture docs |
| New API endpoint | API documentation |
| Breaking change | Migration guide |
| Bug fix | No update needed |

---

## 🔧 Development Setup

### Prerequisites

```
- [Requirement 1] ([version])
- [Requirement 2] ([version])
- [Requirement 3] ([version])
```

### Initial Setup

```bash
# 1. Install dependencies
[install command]

# 2. Configure environment
cp .env.example .env
# Edit .env with your values

# 3. Setup database (if applicable)
[database setup command]

# 4. Start development
[dev command]
```

### Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `[VAR_NAME]` | [Description] | Yes/No |
| `[VAR_NAME]` | [Description] | Yes/No |

---

## 🐛 Troubleshooting

### Common Issues

#### Issue: [Issue Name]

```
Error: [Error message]

Solution:
1. [Step 1]
2. [Step 2]
```

#### Issue: [Issue Name]

```
Error: [Error message]

Solution:
[Solution]
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
│ Test failure?   │──Yes──▶ Check test data, mocking, logic
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
| `.[ext]` | [Description] |
| `.[ext]` | [Description] |

### Key Directories

| Directory | Purpose |
|-----------|---------|
| `[dir]/` | [Description] |
| `[dir]/` | [Description] |

### Important Files

| File | Purpose |
|------|---------|
| `[file]` | [Description] |
| `[file]` | [Description] |

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
```

### Before Completing

```
□ Build/compile passes
□ Lint/type-check passes
□ Tests pass
□ Documentation updated
□ No debug code left
□ No commented code left
```

---

## 📞 Resources

| Resource | Link |
|----------|------|
| Documentation | [path or URL] |
| API Reference | [path or URL] |
| Issue Tracker | [URL] |
| CI/CD | [URL] |

---

## 📝 Changelog

### Recent Changes

| Date | Change | Author |
|------|--------|--------|
| [Date] | [Description] | [Name] |
| [Date] | [Description] | [Name] |

---

*README Version: 1.0.0*
*Last Updated: [Date]*
