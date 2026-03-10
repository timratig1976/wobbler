---
description: Update cascade knowledge regarding latest enhancements and steps
---

# Remember Workflow

This workflow updates Cascade's memory system with the latest project progress, completed features, and important context.

## When to Use

- After completing major features or enhancements
- At the end of work sessions
- When switching between different areas of the codebase
- When discovering important architectural decisions
- After significant bug fixes or improvements

## Steps

### 1. Check Current State

Review recent work and changes:
- Check PLAN.md and ENHANCEMENT_PLAN.md files in relevant directories
- Look for *_COMPLETE.md or *_SUMMARY.md files
- Review recent git commits if needed
- Check TEST_CHECKLIST.md or similar tracking files

### 2. Identify What Changed

Ask yourself:
- What features/enhancements were just completed?
- What's currently in progress?
- What's the next priority?
- Any blockers or issues encountered?
- What technical decisions were made?

### 3. Update Memory

Create or update a memory with:

**Latest Completed:**
- Features finished in last session
- Bug fixes and improvements
- Files modified and their purpose

**Current Work:**
- What's being worked on now
- Active branches or features in progress

**Next Steps:**
- Immediate priorities
- Planned features or improvements

**Technical Context:**
- Key decisions and why they were made
- Patterns or conventions established
- Constraints or limitations discovered

**Blockers:**
- Any issues preventing progress
- Dependencies needed
- Questions to resolve

### 4. Update Project Files (if needed)

- Update relevant PLAN.md files with progress
- Mark completed items with ✅
- Add new items discovered during work
- Update status dates and notes

### 5. Create Session Summary

For major work sessions, create a brief summary:
- What was accomplished
- What changed (files, architecture, features)
- What's next
- Any important notes for future sessions

## File Locations to Check

- `/docs/kanban/in-progress/` - Active feature plans
- `/docs/kanban/completed/` - Recently completed features
- Root level: `*_COMPLETE.md`, `*_SUMMARY.md`, `TEST_CHECKLIST.md`
- `/docs/` for documentation updates

## Memory Update Frequency

- **After major features**: Always update
- **End of sessions**: Recommended
- **Context switches**: Helpful for continuity
- **Architectural decisions**: Critical to document

## Tips

- Be concise but specific
- Include file paths for context
- Note "why" decisions were made, not just "what"
- Highlight blockers or dependencies
- Link related memories if applicable
- Use tags for easy retrieval later
