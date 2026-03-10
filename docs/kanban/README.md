# Kanban-Style Task Management

This directory manages work items in a **Kanban-style** folder structure.

## Structure

```
kanban/
├── backlog/          # Ideas and planned features (not started)
├── in-progress/      # Currently being worked on
└── completed/        # Finished and documented
```

## Workflow

### 1. New Feature Idea
Create a plan in `backlog/`:
```bash
cp TEMPLATE-feature-plan.md backlog/[feature-name]-plan.md
```

**Status:** ⏳ Backlog

### 2. Start Working
Move to `in-progress/`:
```bash
mv backlog/[feature-name]-plan.md in-progress/
```

Update plan:
- Set status to "🔄 In Progress"
- Track progress in phases
- Update progress log

**Status:** 🔄 In Progress

### 3. Complete Feature
Move to `completed/`:
```bash
mv in-progress/[feature-name]-plan.md completed/
```

**Then immediately:**
1. ✅ Update core documentation:
   - `user-guide.md` - Add feature section
   - `api-reference.md` - Add API endpoints (if applicable)
   - `architecture.md` - Add technical details (if significant)
   - `troubleshooting.md` - Add common issues (if needed)

2. ✅ Archive to implementation notes:
   ```bash
   mv completed/[feature-name]-plan.md ../archive/implementation-notes/[feature-name]/plan.md
   ```

**Status:** ✅ Complete & Archived

## Kanban Board View

### Backlog (⏳)
Features waiting to be started:
- Ideas
- Planned features
- Future enhancements

### In Progress (🔄)
Currently being worked on:
- Active development
- Should be limited to 1-3 items
- Track progress in plan file

### Completed (✅)
Recently finished:
- Temporary holding area
- Should be archived quickly
- Empty this folder regularly

## Rules

### Keep It Clean
- **Backlog:** Can grow (ideas are cheap)
- **In Progress:** Limit to 1-3 items (focus!)
- **Completed:** Should be empty (archive immediately)

### File Naming
Use descriptive kebab-case names:
- ✅ `user-authentication-plan.md`
- ✅ `api-rate-limiting-plan.md`
- ❌ `feature1.md`
- ❌ `NEW_FEATURE.md`

### Plan Template
Always use the template: `TEMPLATE-feature-plan.md`

## Example Workflow

```bash
# 1. Create new feature idea
cp TEMPLATE-feature-plan.md backlog/advanced-caching-plan.md
# Edit and fill out the plan

# 2. Start working on it
mv backlog/advanced-caching-plan.md in-progress/
# Update status to "In Progress"

# 3. Complete the feature
mv in-progress/advanced-caching-plan.md completed/

# 4. Update documentation
# - Add section to user-guide.md
# - Add to api-reference.md
# - Update architecture.md

# 5. Archive the plan
mkdir -p ../archive/implementation-notes/advanced-caching
mv completed/advanced-caching-plan.md ../archive/implementation-notes/advanced-caching/plan.md
```

## Quick Commands

### View Current Work
```bash
# What's in backlog?
ls -1 backlog/

# What's in progress?
ls -1 in-progress/

# What needs archiving?
ls -1 completed/
```

### Move Between States
```bash
# Start working on something
mv backlog/[name].md in-progress/

# Mark as complete
mv in-progress/[name].md completed/

# Archive completed work
mkdir -p ../archive/implementation-notes/[feature-name]
mv completed/[name].md ../archive/implementation-notes/[feature-name]/plan.md
```

## Integration with Documentation

This Kanban structure is **separate from** but **integrated with** the core documentation:

- **Kanban** (here) = Planning & tracking
- **Core Docs** (`/docs/*.md`) = User-facing documentation
- **Archive** (`/docs/archive/`) = Historical reference

**Flow:**
```
Backlog → In Progress → Completed → Core Docs Updated → Archived
```

## Best Practices

### 1. One Feature at a Time
Focus on 1-3 items in `in-progress/` maximum.

### 2. Update Progress Regularly
Keep the plan file updated with:
- Completed phases (✅)
- Current blockers
- Progress log entries

### 3. Archive Quickly
Don't let `completed/` pile up. Archive within 1-2 days of completion.

### 4. Review Backlog
Periodically review `backlog/` to:
- Remove outdated ideas
- Prioritize important features
- Merge similar ideas

---

**Remember:** Plans are temporary. Documentation is permanent.
