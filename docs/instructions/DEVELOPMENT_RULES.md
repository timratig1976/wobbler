# Development Rules

**Status:** Active  
**Last Updated:** 2026-03-10  
**Purpose:** All development rules in one place. Applies to every feature, fix, and optimization.

---

## How All Rules Work Together

Every new feature follows this flow — each rule activates at the right step:

```
New Feature Request
       │
       ▼
1. MAP IT              → Anti-Drift Rule
2. CHECK REUSE         → Component Reuse Policy
3. BUILD SIMPLE        → Baseline-First Rule
4. MEASURE             → Baseline Metrics
5. SMALL STEPS         → Anti-Drift Rule
6. VERIFY              → Regression Gate
7. COMPLEXITY CHECK    → Simplicity Metrics
8. ROLLBACK PATH       → Rollback Rule
9. DOCUMENT            → Documentation Policy
```

---

## Rule 1: Baseline-First

Build the simplest working version first, then measure it.

**Baseline metrics to capture:**
- **UI baseline:** FPS, render count, memory snapshot  
- **API baseline:** p95 latency, DB query count  
- **ML baseline:** metric + parameter count

**Process:**
- No optimization until baseline is recorded.
- If baseline works → ship it. If not → enhance with measurement.
- Complexity that does not improve the baseline must be removed.

---

## Rule 2: Anti-Drift (AI Coding Safety)

AI-generated code can silently introduce bugs while appearing to fix others. Prevent this:

- **Write a map before prompting** — what it does, what it must NOT do, edge cases (2 min)
- **One change at a time** — max 2–3 files touched per step
- **Verify after every step** — does it run? did anything unrelated break?
- **Stop on drift** — new errors in unrelated areas → stop, revert, narrow scope
- **Never accept AI security/DB code blindly** — always review SQL, auth, and permissions manually

---

## Rule 3: Simplicity Metrics

Track and log in PRs:

- State complexity: number of hooks/refs added
- Dependency count: new libraries introduced
- Render complexity: new render triggers
- Model complexity: parameter count (ML)

If complexity increases without clear metric gains → refactor or rollback.

---

## Rule 4: Component Reuse

**Platform-specific (adapt to your stack):**

### For React/Next.js
- Use existing design-system components only.
- No new button/card styles — use `<Button variant="...">` and `<Panel>`.
- No new icons — use existing icon library.
- If a component is missing → add to component library first, then use it.
- Always support dark mode (`dark:` Tailwind classes).

### For PHP/Laravel
- Use Blade components from `resources/views/components/`
- No inline styles — use existing component classes
- Reuse form components, buttons, cards

### For Python/Django
- Use template tags from `templatetags/`
- Reuse form widgets and components
- No inline styles — use existing CSS classes

**Universal principle:** Don't duplicate UI code. Build once, reuse everywhere.

---

## Rule 5: Rollback Rule

Every complex change must include:

- A fallback/baseline path
- A rollback plan or feature toggle
- Defined revert steps before starting

---

## Rule 6: Regression Gate

- If a key metric drops >10% vs baseline → block merge.
- Anti-drift check: did any unrelated area break? If yes → stop and revert.

---

## Rule 7: Documentation Policy

- Only 6 core docs in `/docs/` root — never create new ones.
- Never duplicate information across files.
- Keep core docs up to date after every feature is shipped.

**Folder structure:**
```
docs/
├── kanban/          ← feature plans (backlog → in-progress → completed)
├── instructions/    ← guides, rules, deployment playbooks
└── archive/         ← completed implementation notes
```

**Decision tree — where does it go?**
```
New feature plan?       → kanban/backlog/[name]-plan.md
New API endpoint?       → api-reference.md
New UI component/arch?  → architecture.md
New user-facing feature? → user-guide.md
Common issue?           → troubleshooting.md
Dev rule or guide?      → instructions/
Completed feature notes → archive/implementation-notes/
```

## Rule 8: Keep Docs in Sync

After every completed feature, update the relevant core docs **before closing the kanban item**.

| What changed | Update this doc |
|-------------|----------------|
| New API endpoint | `api-reference.md` |
| New UI component or architecture change | `architecture.md` |
| New user-facing feature | `user-guide.md` |
| New setup step or prerequisite | `getting-started.md` |
| New known issue or fix | `troubleshooting.md` |

**Broken link check:** After moving or deleting any doc, search for old references:
```bash
grep -r "old-filename.md" docs/
```
Fix all broken links before committing.

---

## PR Checklist (Required for Every Change)

Before merging any change, confirm:

1. Docs updated? (api-reference, architecture, user-guide as needed)
2. No broken links in docs? (`grep -r "old-filename" docs/`)
3. Baseline measured?
4. Simplicity metrics logged?
5. Performance improvement vs baseline?
6. Component reuse confirmed?
7. Rollback path defined?
8. No metric drop >10% vs baseline?
9. AI-generated SQL/auth/permissions manually reviewed?

---

## Simple Summary

| Step | Rule |
|------|------|
| Before | Write a map (what it does, must NOT do, edge cases) |
| Start | Build simplest version |
| Measure | Record baseline metrics |
| Build | One small step at a time |
| Check | Verify after each step |
| Drift | Stop, revert, narrow |
| Complexity | Only if baseline fails |
| UI | Reuse components |
| Docs | Update existing docs, never create new ones |

**One rule:** Small steps + verify + revert when wrong = stable features.
