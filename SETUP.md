# Starter Template Setup Guide

This guide explains how to use this starter template for your new project.

---

## What This Template Provides

✅ **Documentation structure** - 6 core docs + Kanban workflow  
✅ **Development guardrails** - Baseline-first, anti-drift, regression gates  
✅ **Workflows** - Testing, documentation, planning, memory tracking  
✅ **Best practices** - Proven patterns from real projects  
✅ **Platform-agnostic** - Works with any tech stack

---

## Quick Setup (5 minutes)

### 1. Copy Template to Your Project

```bash
# Copy the entire starter-template folder
cp -r /path/to/starter-template /path/to/your-new-project

# Or clone if it's a git repo
git clone <template-repo-url> your-new-project

cd your-new-project
```

### 2. Initialize Git

```bash
git init
git add .
git commit -m "Initial commit from starter template"
```

### 3. Customize for Your Tech Stack

**Update these files with your specific commands:**

#### `.windsurf/workflows/test.md`
Replace generic commands with your stack's commands:
- `npm test` → your test command
- `npm run build` → your build command
- `npm run type-check` → your type checker

#### `docs/getting-started.md`
Add your installation steps:
- Dependencies installation
- Environment setup
- Database setup (if applicable)
- First run instructions

#### `docs/architecture.md`
Describe your tech stack:
- Framework/language
- Database
- Key libraries
- Project structure

#### `docs/deployment.md`
Add your deployment instructions:
- Environment variables
- Build process
- Deployment platform
- Scaling considerations

### 4. Remove Template-Specific Files

```bash
# Remove this setup guide (you don't need it anymore)
rm SETUP.md

# Remove the main template README (replace with your project README)
rm README.md
# Create your own README.md with project-specific info
```

### 5. Create Your First Feature Plan

```bash
# Copy the template
cp docs/kanban/TEMPLATE-feature-plan.md docs/kanban/backlog/initial-setup-plan.md

# Edit it with your first feature
# Then start working!
```

---

## Detailed Customization Guide

### For Next.js / React Projects

**Keep as-is:**
- `.windsurf/STORYBOOK_DESIGN_SYSTEM_POLICY.md` (if using Storybook)
- All documentation policies
- Kanban workflow

**Update:**
```bash
# .windsurf/workflows/test.md
npm run type-check  # TypeScript check
npm test            # Jest/Vitest
npm run build       # Next.js build

# docs/getting-started.md
npm install
npm run dev
# Visit http://localhost:3000

# docs/architecture.md
- Framework: Next.js 14
- State: React Context / Zustand
- Styling: Tailwind CSS
- Database: PostgreSQL + Prisma
```

### For PHP / Laravel Projects

**Keep as-is:**
- All documentation policies
- Kanban workflow
- Development rules

**Update:**
```bash
# .windsurf/workflows/test.md
composer test       # PHPUnit
php artisan test    # Laravel tests
composer phpstan    # Static analysis

# docs/getting-started.md
composer install
php artisan migrate
php artisan serve
# Visit http://localhost:8000

# docs/architecture.md
- Framework: Laravel 10
- Database: MySQL
- Queue: Redis
- Cache: Redis
```

**Remove:**
- `.windsurf/STORYBOOK_DESIGN_SYSTEM_POLICY.md` (or adapt for Blade components)

### For Python / Django Projects

**Keep as-is:**
- All documentation policies
- Kanban workflow
- Development rules

**Update:**
```bash
# .windsurf/workflows/test.md
pytest              # Run tests
mypy .              # Type checking
python manage.py test

# docs/getting-started.md
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver
# Visit http://localhost:8000

# docs/architecture.md
- Framework: Django 4.2
- Database: PostgreSQL
- Cache: Redis
- Task Queue: Celery
```

**Remove:**
- `.windsurf/STORYBOOK_DESIGN_SYSTEM_POLICY.md`

### For Go Projects

**Keep as-is:**
- All documentation policies
- Kanban workflow
- Development rules

**Update:**
```bash
# .windsurf/workflows/test.md
go test ./...       # Run tests
go build            # Build binary
golangci-lint run   # Linting

# docs/getting-started.md
go mod download
go run main.go
# Visit http://localhost:8080

# docs/architecture.md
- Language: Go 1.21
- Framework: Gin / Echo
- Database: PostgreSQL + sqlx
- Cache: Redis
```

**Remove:**
- `.windsurf/STORYBOOK_DESIGN_SYSTEM_POLICY.md`

---

## Folder Structure After Setup

```
your-project/
├── .windsurf/                    # Cascade AI policies & workflows
│   ├── CASCADE_DOCUMENTATION_POLICY.md
│   └── workflows/
│       ├── test.md               # ← Customize for your stack
│       ├── doc.md
│       ├── plan.md
│       └── remember.md
│
├── docs/                         # All documentation
│   ├── README.md                 # Entry point
│   ├── getting-started.md        # ← Customize for your stack
│   ├── user-guide.md             # ← Add your features here
│   ├── api-reference.md          # ← Add your APIs here
│   ├── architecture.md           # ← Describe your architecture
│   ├── deployment.md             # ← Add deployment steps
│   ├── troubleshooting.md        # ← Add common issues
│   │
│   ├── kanban/
│   │   ├── README.md
│   │   ├── TEMPLATE-feature-plan.md
│   │   ├── backlog/              # Your feature plans go here
│   │   ├── in-progress/
│   │   └── completed/
│   │
│   ├── instructions/
│   │   ├── DEVELOPMENT_RULES.md  # Keep as-is
│   │   └── testing-guide.md      # ← Customize for your stack
│   │
│   └── archive/
│       └── implementation-notes/
│
├── src/                          # Your source code
├── tests/                        # Your tests
├── .env.example                  # Environment template
├── package.json                  # Or composer.json, requirements.txt, etc.
└── README.md                     # Your project README
```

---

## Using the Template

### 1. Planning a New Feature

```bash
# Use the /plan workflow in Cascade
/plan

# Or manually:
cp docs/kanban/TEMPLATE-feature-plan.md docs/kanban/backlog/my-feature-plan.md
# Edit the plan
```

### 2. Starting Work

```bash
# Move to in-progress
mv docs/kanban/backlog/my-feature-plan.md docs/kanban/in-progress/

# Update status in the file
# Status: Planning → Status: In Progress
```

### 3. Testing Your Work

```bash
# Use the /test workflow in Cascade
/test

# Or manually run your tests
npm test && npm run build
```

### 4. Documenting Your Feature

```bash
# Use the /doc workflow in Cascade
/doc

# Update the appropriate core doc:
# - New feature → user-guide.md
# - New API → api-reference.md
# - Architecture change → architecture.md
```

### 5. Completing the Feature

```bash
# Move to completed
mv docs/kanban/in-progress/my-feature-plan.md docs/kanban/completed/

# Update docs (see step 4)

# Archive the plan
mkdir -p docs/archive/implementation-notes/my-feature
mv docs/kanban/completed/my-feature-plan.md docs/archive/implementation-notes/my-feature/plan.md
```

---

## Cascade AI Workflows

This template includes Cascade-specific workflows (slash commands):

- `/test` - Run verification checks
- `/doc` - Update documentation
- `/plan` - Create feature plan
- `/remember` - Update project memory

These work out of the box with Cascade AI. If you're not using Cascade, you can still follow the workflows manually.

---

## Benefits of This Structure

✅ **Consistent** - Same structure across all your projects  
✅ **Documented** - Documentation discipline from day one  
✅ **Organized** - Kanban workflow keeps work visible  
✅ **Safe** - Guardrails prevent common mistakes  
✅ **Scalable** - Grows with your project  
✅ **AI-friendly** - Works great with AI coding assistants

---

## Next Steps

1. ✅ Copy template to your project
2. ✅ Customize for your tech stack
3. ✅ Create your first feature plan
4. ✅ Start coding with guardrails in place
5. ✅ Ship faster and safer

---

## Questions?

- **Documentation Policy:** See `.windsurf/CASCADE_DOCUMENTATION_POLICY.md`
- **Development Rules:** See `docs/instructions/DEVELOPMENT_RULES.md`
- **Kanban Workflow:** See `docs/kanban/README.md`

---

**This template is ready to use. Customize it for your stack and start building!**
