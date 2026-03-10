---
description: Document new features following the strict 6-file documentation policy
---

# Documentation Workflow

**CRITICAL**: This workflow ENFORCES the 6-file documentation policy. NO exceptions.

## Core Principle

**6 documentation files only. Never create new massive documentation files.**

---

## Step 1: Identify What to Document

Determine the type of change:
- ✅ New feature → Update `user-guide.md`
- ✅ New API endpoint → Update `api-reference.md`
- ✅ Architecture change → Update `architecture.md`
- ✅ Deployment change → Update `deployment.md`
- ✅ Common issue/fix → Update `troubleshooting.md`
- ✅ Setup/installation → Update `getting-started.md`

**NEVER create a new documentation file.**

---

## Step 2: Update the Appropriate Core Doc

### For New Features (user-guide.md)

Add a new section with:
```markdown
## [Feature Name]

**Overview:** Brief description of what it does

**How to Use:**
1. Step-by-step instructions
2. Clear, actionable steps
3. Screenshots if helpful

**Examples:**
```code
// Practical examples
```

**Best Practices:**
- Tip 1
- Tip 2

**Common Issues:**
- Issue and solution
```

### For New API Endpoints (api-reference.md)

Add endpoint documentation:
```markdown
### POST /api/[endpoint]

**Description:** What this endpoint does

**Request:**
```json
{
  "param1": "value",
  "param2": 123
}
```

**Response:**
```json
{
  "success": true,
  "data": {}
}
```

**Error Codes:**
- 400: Bad request
- 500: Server error
```

### For Architecture Changes (architecture.md)

Add or update sections:
```markdown
## [Component/System Name]

**Purpose:** Why this exists

**Design:** How it works

**Data Flow:**
1. Step 1
2. Step 2

**Key Files:**
- `/path/to/file` - Purpose
```

### For Deployment Changes (deployment.md)

Update environment variables, setup steps, or configuration:
```markdown
## [Configuration Name]

**Environment Variable:** `VAR_NAME`

**Purpose:** What it controls

**Default:** `default_value`

**Example:**
```bash
export VAR_NAME=value
```
```

### For Troubleshooting (troubleshooting.md)

Add common issues and solutions:
```markdown
## [Issue Title]

**Symptom:** What the user sees

**Cause:** Why it happens

**Solution:**
1. Step 1
2. Step 2

**Prevention:** How to avoid it
```

---

// turbo
## Step 3: Execute Documentation Update

**MANDATORY ACTIONS:**

1. **Read the appropriate core doc** to understand current structure
2. **Add the new section** in the logical place (don't append to end)
3. **Keep it concise** (50-150 lines max per feature)
4. **Use consistent formatting** with existing sections
5. **Update table of contents** if the doc has one

**FORBIDDEN ACTIONS:**
- ❌ Creating new .md files in `/docs/`
- ❌ Creating feature-specific documentation files
- ❌ Writing massive standalone guides
- ❌ Duplicating information across files

---

## Step 4: Archive Implementation Notes (Optional)

If there are detailed implementation notes that don't belong in user docs:

```bash
mkdir -p /docs/archive/implementation-notes/[feature-name]
# Move technical notes there
```

**These are NOT user-facing docs** - they're historical reference.

---

## Step 5: Verify Documentation Quality

Check:
- ✅ Added to correct core doc (not new file)
- ✅ Concise and clear (50-150 lines)
- ✅ Follows existing formatting
- ✅ Includes examples
- ✅ No duplication with other sections
- ✅ Table of contents updated (if applicable)

---

## The 6 Core Documentation Files

Located in `/docs/`:

1. **README.md** - Entry point & navigation (~70 lines)
2. **getting-started.md** - Installation & tutorials (~150 lines)
3. **user-guide.md** - ALL features (~800 lines)
4. **api-reference.md** - Complete API (~900 lines)
5. **architecture.md** - System design & technical (~600 lines)
6. **troubleshooting.md** - Common issues & solutions (~300 lines)

**These are the ONLY user-facing documentation files.**

---

## Quick Reference Table

| What Changed | Update This File | Section Type |
|--------------|------------------|--------------|
| New feature | user-guide.md | Feature section |
| New API | api-reference.md | Endpoint docs |
| Architecture | architecture.md | Component/system |
| Environment var | deployment.md | Configuration |
| Bug fix | troubleshooting.md | Issue + solution |
| Install step | getting-started.md | Setup section |
| Implementation | archive/implementation-notes/ | Historical |

---

## Enforcement Checklist

Before completing this workflow, verify:

- [ ] Did NOT create a new documentation file
- [ ] Updated one of the 6 core docs
- [ ] Section is concise (50-150 lines)
- [ ] Follows existing formatting
- [ ] Includes practical examples
- [ ] No information duplication
- [ ] Table of contents updated (if needed)

---

**This workflow is ENFORCED. Follow it exactly.**
