# Project Starter Template

**Platform-agnostic project template with built-in dev guardrails, documentation structure, and workflows.**

Use this template for any new project (Next.js, PHP, Python, etc.) to start with proven development practices.

---

## What's Included

### 📋 Documentation Structure
- **6 core docs** (README, getting-started, user-guide, api-reference, architecture, deployment, troubleshooting)
- **Kanban workflow** (backlog → in-progress → completed → archive)
- **Instructions folder** (development rules, testing guides, deployment playbooks)

### 🔒 Development Guardrails
- **Baseline-first rule** (measure before optimizing)
- **Anti-drift protection** (small steps, verify each change)
- **Regression gates** (block merges if metrics drop >10%)
- **Component reuse** (design system policy)
- **Rollback planning** (every complex change needs a fallback)

### ⚙️ Workflows
- **Testing workflow** (type-check → test → build → deploy)
- **Documentation workflow** (update core docs, never create new ones)
- **Feature planning** (Kanban-style with templates)
- **Memory/progress tracking** (remember workflow)

---

## Quick Start

### 1. Copy Template to New Project

```bash
# Copy the entire starter-template folder
cp -r starter-template /path/to/your-new-project
cd /path/to/your-new-project

# Initialize git
git init
```

### 2. Customize for Your Tech Stack

**Update these files:**
- `docs/getting-started.md` - Add your installation steps
- `docs/architecture.md` - Describe your tech stack
- `docs/deployment.md` - Add deployment instructions
- `.windsurf/workflows/test.md` - Adapt test commands to your stack
- `.windsurf/workflows/servers.md` - Update dev server commands

**Keep unchanged:**
- Documentation policy (works for any stack)
- Development rules (universal principles)
- Kanban workflow (platform-agnostic)
- Feature plan template (universal)

### 3. Start Your First Feature

```bash
# Create a feature plan
cp docs/kanban/TEMPLATE-feature-plan.md docs/kanban/backlog/my-first-feature-plan.md

# Edit the plan, then move to in-progress when ready
mv docs/kanban/backlog/my-first-feature-plan.md docs/kanban/in-progress/
```

---

## Folder Structure

```
your-project/
├── .windsurf/                          # Cascade AI policies & workflows
│   ├── CASCADE_DOCUMENTATION_POLICY.md # Doc structure enforcement
│   ├── STORYBOOK_DESIGN_SYSTEM_POLICY.md # UI component reuse (adapt for your UI framework)
│   └── workflows/                      # Slash command workflows
│       ├── test.md                     # Testing workflow
│       ├── doc.md                      # Documentation workflow
│       ├── remember.md                 # Progress tracking
│       ├── plan.md                     # Feature planning
│       └── servers.md                  # Dev server management
│
├── docs/                               # All documentation
│   ├── README.md                       # Entry point & navigation
│   ├── getting-started.md              # Installation & tutorials
│   ├── user-guide.md                   # Feature documentation
│   ├── api-reference.md                # API/endpoint docs
│   ├── architecture.md                 # System design
│   ├── deployment.md                   # Production setup
│   ├── troubleshooting.md              # Common issues
│   │
│   ├── kanban/                         # Feature tracking (Kanban)
│   │   ├── README.md                   # Kanban workflow guide
│   │   ├── TEMPLATE-feature-plan.md    # Feature plan template
│   │   ├── backlog/                    # ⏳ Planned features
│   │   ├── in-progress/                # 🔄 Active work
│   │   └── completed/                  # ✅ Done (archive quickly)
│   │
│   ├── instructions/                   # Guides, rules, playbooks
│   │   ├── DEVELOPMENT_RULES.md        # Core dev principles
│   │   ├── testing-guide.md            # Testing checklist
│   │   └── DEPLOYMENT.md               # Deployment playbook
│   │
│   └── archive/                        # Historical docs
│       └── implementation-notes/       # Completed feature notes
│
└── [your source code]                  # src/, app/, etc. (tech-specific)
```

---

## Core Principles

### 1. Documentation Policy (6 Core Docs Only)

**NEVER create new top-level docs.** Always update one of the 6 core docs:

| What Changed | Update This Doc |
|--------------|-----------------|
| New feature | `user-guide.md` |
| New API endpoint | `api-reference.md` |
| Architecture change | `architecture.md` |
| Setup step | `getting-started.md` |
| Common issue | `troubleshooting.md` |
| Deployment change | `deployment.md` |

### 2. Kanban Workflow

Every feature follows this flow:

```
1. Plan      → docs/kanban/backlog/[name]-plan.md (⏳)
2. Start     → docs/kanban/in-progress/[name]-plan.md (🔄)
3. Complete  → docs/kanban/completed/[name]-plan.md (✅)
4. Document  → Update core docs (user-guide, api-reference, etc.)
5. Archive   → docs/archive/implementation-notes/[name]/ (📦)
```

### 3. Development Rules

**Before coding:**
- Write a map (what it does, what it must NOT do, edge cases)
- Build simplest version first
- Measure baseline metrics

**During coding:**
- One small step at a time (max 2-3 files)
- Verify after every step
- Stop on drift (unrelated breakage)

**Before merging:**
- Type check passes
- Tests pass
- Build succeeds
- Docs updated
- No metric drop >10% vs baseline

---

## Adapting for Your Tech Stack

### For Next.js / React

Keep as-is:
- `STORYBOOK_DESIGN_SYSTEM_POLICY.md` (if using Storybook)
- Test workflow (adapt commands)

Update:
- `docs/getting-started.md` - Add `npm install`, `npm run dev`
- `docs/architecture.md` - Describe Next.js app structure
- `.windsurf/workflows/test.md` - Use `npm test`, `npm run build`

### For PHP / Laravel

Keep as-is:
- Documentation policy
- Kanban workflow
- Development rules

Update:
- `docs/getting-started.md` - Add `composer install`, `php artisan serve`
- `docs/architecture.md` - Describe MVC structure
- `.windsurf/workflows/test.md` - Use `php artisan test`, `composer test`
- Remove `STORYBOOK_DESIGN_SYSTEM_POLICY.md` (or adapt for Blade components)

### For Python / Django

Keep as-is:
- Documentation policy
- Kanban workflow
- Development rules

Update:
- `docs/getting-started.md` - Add `pip install -r requirements.txt`, `python manage.py runserver`
- `docs/architecture.md` - Describe Django app structure
- `.windsurf/workflows/test.md` - Use `pytest`, `python manage.py test`

---

## Benefits

✅ **Consistent structure** across all your projects  
✅ **Built-in guardrails** prevent common mistakes  
✅ **Kanban workflow** keeps work organized  
✅ **Documentation discipline** from day one  
✅ **AI-friendly** (Cascade workflows included)  
✅ **Platform-agnostic** (works with any tech stack)

---

## Next Steps

1. **Copy this template** to your new project
2. **Customize** for your tech stack (update getting-started, architecture, test commands)
3. **Create your first feature plan** in `docs/kanban/backlog/`
4. **Start coding** with guardrails in place

---

**This template captures proven practices from real projects. Use it. Adapt it. Ship faster.**
