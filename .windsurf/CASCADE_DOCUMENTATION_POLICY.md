# 📋 Documentation Policy

## Critical Documentation Rules

### The Complete Documentation Structure (ENFORCED)

```
/docs/
├── README.md              # Entry point & navigation
├── getting-started.md     # Installation & tutorials
├── user-guide.md          # ALL features - comprehensive
├── api-reference.md       # Complete API documentation
├── architecture.md        # System design & technical
├── troubleshooting.md     # Common issues
│
├── kanban/                # Feature tracking (Kanban workflow)
│   ├── TEMPLATE-feature-plan.md  # Template for new items
│   ├── backlog/          # ⏳ Planned features (not started)
│   ├── in-progress/      # 🔄 Currently implementing
│   └── completed/        # ✅ Done, awaiting doc updates & archival
│
├── instructions/          # All guides, rules & playbooks
│   ├── DEVELOPMENT_RULES.md      # All development rules
│   ├── testing-guide.md          # Testing checklist
│   └── DEPLOYMENT.md             # Production deployment guide
│
└── archive/               # Historical documentation
    └── implementation-notes/     # Completed feature notes
```

**Core Rules:**
- **Only 6 core docs** in `/docs/` root (+ README)
- **Feature plans** go in `/docs/kanban/backlog/`
- **Guides & rules** go in `/docs/instructions/`
- **Completed work** archived in `/docs/archive/implementation-notes/`

---

## New Feature Implementation Workflow (Kanban-Style)

### Phase 1: Planning (BEFORE Implementation)

**Create implementation plan in backlog:**
```bash
cp /docs/kanban/TEMPLATE-feature-plan.md /docs/kanban/backlog/[feature-name]-plan.md
```

**Plan should include:**
- Feature overview & goals
- Technical approach
- Implementation phases
- Files to be modified
- Testing strategy
- Documentation updates needed

**Status:** ⏳ Backlog

### Phase 2: Implementation

**Move to in-progress:**
```bash
mv /docs/kanban/backlog/[feature-name]-plan.md /docs/kanban/in-progress/
```

**During implementation:**
- Follow the plan
- Track progress in the plan file
- Mark phases as completed (✅)
- Note any deviations or discoveries
- Update progress log

**Status:** 🔄 In Progress

### Phase 3: Completion

**Move to completed:**
```bash
mv /docs/kanban/in-progress/[feature-name]-plan.md /docs/kanban/completed/
```

**Status:** ✅ Complete

### Phase 4: Documentation (AFTER Completion)

**Automatically update core docs:**

1. **user-guide.md** - Add feature section
   - Overview (what it does)
   - How to use (step-by-step)
   - Examples
   - Best practices

2. **api-reference.md** - Add API endpoints (if applicable)
   - Endpoint details
   - Request/response formats
   - Examples

3. **architecture.md** - Add technical details (if significant)
   - System design changes
   - Data models
   - Integration points

4. **troubleshooting.md** - Add common issues (if applicable)
   - Known issues
   - Solutions
   - FAQ

5. **Archive the plan:**
   ```bash
   mkdir -p /docs/archive/implementation-notes/[feature-name]
   mv /docs/kanban/completed/[feature-name]-plan.md /docs/archive/implementation-notes/[feature-name]/plan.md
   ```

### Kanban Workflow Summary

```
1. Create plan → /docs/kanban/backlog/[name]-plan.md (⏳ Backlog)
2. Start work → /docs/kanban/in-progress/[name]-plan.md (🔄 In Progress)
3. Complete → /docs/kanban/completed/[name]-plan.md (✅ Complete)
4. Update core docs (user-guide, api-reference, architecture, troubleshooting)
5. Archive → /docs/archive/implementation-notes/[name]/plan.md (📦 Archived)
```

**This ensures:**
- ✅ Thoughtful planning before coding
- ✅ Visible work-in-progress (Kanban board)
- ✅ Tracked implementation progress
- ✅ Automatic documentation updates
- ✅ Clean final state (no scattered docs)

---

## Golden Rules

### Rule 1: NEVER Create New Top-Level Docs
❌ **FORBIDDEN:**
```
Creating: docs/NEW_FEATURE_GUIDE.md
Creating: docs/PATTERN_MANAGEMENT.md
Creating: IMPLEMENTATION_COMPLETE.md
Creating: PHASE_X_SUMMARY.md
```

✅ **CORRECT:**
```
Updating: docs/user-guide.md (add section)
Updating: docs/api-reference.md (add endpoints)
Archiving: docs/archive/implementation-notes/feature-x/notes.md
```

### Rule 2: Follow Implementation Workflow

**Decision Tree:**
```
New work to do?
│
├─ New feature to build?
│  └─ 1. Create plan in /docs/kanban/backlog/[name]-plan.md (⏳)
│     2. Move to /docs/kanban/in-progress/ when starting (🔄)
│     3. Move to /docs/kanban/completed/ when done (✅)
│     4. Update core docs (user-guide, api-reference, architecture)
│     5. Archive to /docs/archive/implementation-notes/ (📦)
│
├─ New API endpoint only?      → Add to api-reference.md
├─ Architecture change only?   → Update architecture.md
├─ Deployment change?          → Update deployment.md
├─ Common issue?               → Add to troubleshooting.md
├─ Setup step?                 → Update getting-started.md
├─ Implementation note?        → Archive in /docs/archive/implementation-notes/
├─ Setup/reference guide?      → Add to /docs/instructions/
└─ Dev rules/playbook?         → Add to /docs/instructions/
```

### Rule 3: Keep Sections Concise

**Per Feature in user-guide.md:**
- Overview: 2-3 paragraphs
- How to use: Step-by-step
- Examples: 1-2 code blocks
- Best practices: Bullet points
- **Total: 50-150 lines per feature**

### Rule 4: No Duplication

**Single Source of Truth:**
- Feature explanation → user-guide.md ONLY
- API documentation → api-reference.md ONLY
- Architecture → architecture.md ONLY

**If information exists in multiple places, it WILL become inconsistent.**

---

## Document Purposes

### 1. README.md - Entry Point
**Purpose:** Navigation hub  
**Length:** ~70 lines  
**Content:**
- Quick start (5 commands)
- Links to all docs
- Quick links by feature
- Status badges

### 2. getting-started.md - Onboarding
**Purpose:** Get users productive in 10 minutes  
**Length:** ~150 lines  
**Content:**
- Installation steps
- First tutorial
- Basic concepts
- Next steps

### 3. user-guide.md - Feature Encyclopedia
**Purpose:** Complete feature documentation  
**Length:** ~800 lines  
**Content:**
- ALL features explained
- Usage examples
- Best practices
- Tips and tricks

### 4. api-reference.md - API Documentation
**Purpose:** Complete API documentation  
**Length:** ~900 lines  
**Content:**
- All endpoints
- Request/response formats
- Examples
- Error codes

### 5. architecture.md - System Design
**Purpose:** Technical architecture & design decisions  
**Length:** ~600 lines  
**Content:**
- System overview
- Component architecture
- Data models
- Design decisions
- Technology stack

### 6. troubleshooting.md - Problem Solving
**Purpose:** Common issues & solutions  
**Length:** ~300 lines  
**Content:**
- Error messages
- Debug steps
- FAQ
- Known issues

---

## Enforcement Checklist

Before creating ANY documentation:

- [ ] Is this user-facing documentation?
  - YES → Update one of the 6 core docs
  - NO → Archive in implementation-notes

- [ ] Does this information already exist?
  - YES → Update existing section
  - NO → Add new section to appropriate doc

- [ ] Am I creating a new top-level doc?
  - YES → STOP! Update existing doc instead
  - NO → Proceed

- [ ] Is this an implementation note?
  - YES → Put in /docs/archive/implementation-notes/
  - NO → Put in appropriate core doc

---

## Quick Reference

### Where to Document What

| Content Type | Location | Example |
|--------------|----------|---------|
| **Feature Plans** | kanban/backlog/ | feature-x-plan.md |
| **In Progress** | kanban/in-progress/ | feature-x-plan.md |
| **Completed** | kanban/completed/ | feature-x-plan.md |
| **Guides & Rules** | instructions/ | DEVELOPMENT_RULES.md |
| New feature | user-guide.md | Feature section |
| New API | api-reference.md | /api/endpoint |
| Architecture | architecture.md | System design |
| Setup step | getting-started.md | Install dependencies |
| Common issue | troubleshooting.md | Error solution |
| Implementation | archive/implementation-notes/ | Phase summaries |

---

**This structure was established to prevent documentation sprawl. It MUST be maintained.**

Last Updated: 2026-03-10
Version: 1.0
Status: ENFORCED
