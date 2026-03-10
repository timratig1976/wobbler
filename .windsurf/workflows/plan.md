---
description: Create a new feature plan with detailed implementation steps
---

# Feature Planning Workflow

Use this workflow to create a well-structured plan before starting any new feature.

## When to Use

- Before starting any new feature
- When planning a significant refactor
- When adding new major functionality
- Before making architectural changes

## Steps

### 1. Copy the Template

```bash
cp docs/kanban/TEMPLATE-feature-plan.md docs/kanban/backlog/[feature-name]-plan.md
```

**Naming convention:** Use kebab-case, be descriptive
- ✅ `user-authentication-plan.md`
- ✅ `api-rate-limiting-plan.md`
- ❌ `feature1.md`
- ❌ `NEW_FEATURE.md`

### 2. Fill Out the Plan

Open the plan file and complete all sections:

**Required Sections:**
- [ ] Overview & Goals
- [ ] Success Criteria
- [ ] Technical Approach
- [ ] Data Model Changes (if applicable)
- [ ] API Changes (if applicable)
- [ ] Implementation Phases
- [ ] Testing Strategy
- [ ] Documentation Updates
- [ ] Dependencies
- [ ] Risks & Considerations

**Tips:**
- Be specific about what you're building
- Break work into small phases (1-3 hours each)
- List all files you'll modify
- Think about edge cases
- Plan for rollback if needed

### 3. Review the Plan

Before starting implementation, verify:

- [ ] Goals are clear and measurable
- [ ] Success criteria are defined
- [ ] Phases are small and manageable
- [ ] Testing strategy is defined
- [ ] Documentation updates are planned
- [ ] Risks are identified
- [ ] Dependencies are listed

### 4. Get Feedback (Optional)

For major features:
- Share the plan with team members
- Get architectural review
- Validate approach before coding

### 5. Start Implementation

When ready to start:

```bash
# Move plan to in-progress
mv docs/kanban/backlog/[feature-name]-plan.md docs/kanban/in-progress/

# Update status in the file
# Change: Status: Planning
# To:     Status: In Progress
```

## Plan Template Sections Explained

### Overview & Goals
**What:** Brief description of the feature  
**Why:** Problem it solves  
**Who:** Target users

### Success Criteria
Measurable outcomes that define "done":
- [ ] Specific, testable criteria
- [ ] Performance benchmarks
- [ ] User acceptance criteria

### Technical Approach
High-level design:
- Architecture overview
- Components involved
- Data flow
- Integration points

### Implementation Phases
Break work into small chunks:
- **Phase 1:** Foundation (data models, basic structure)
- **Phase 2:** Core logic (business rules, algorithms)
- **Phase 3:** UI/API (user-facing parts)
- **Phase 4:** Testing & polish

Each phase should be 1-3 hours of work.

### Testing Strategy
How you'll verify it works:
- Unit tests (what to test)
- Integration tests (end-to-end scenarios)
- Manual testing (checklist)

### Documentation Updates
Which docs to update after completion:
- user-guide.md (always for new features)
- api-reference.md (if adding APIs)
- architecture.md (if significant changes)
- troubleshooting.md (if needed)

## Best Practices

### Keep Phases Small
- ✅ Phase 1: Add database table (1 hour)
- ✅ Phase 2: Create API endpoint (2 hours)
- ❌ Phase 1: Build entire authentication system (20 hours)

### Be Specific About Files
- ✅ `src/models/User.php` - Add password hashing
- ✅ `src/api/auth.ts` - Create login endpoint
- ❌ "Update some files in the auth folder"

### Plan for Testing
- ✅ "Test login with valid/invalid credentials"
- ✅ "Test password reset flow end-to-end"
- ❌ "Test everything"

### Identify Risks Early
- ✅ "Risk: Password hashing may be slow. Mitigation: Use bcrypt with cost factor 10"
- ✅ "Risk: Session storage may not scale. Mitigation: Use Redis if needed"

## After Planning

Once your plan is complete and in `docs/kanban/backlog/`:

1. **Review it** - Make sure it's clear and complete
2. **Prioritize it** - Decide when to work on it
3. **Start when ready** - Move to in-progress and begin coding

## Example: Good vs Bad Plans

### ❌ BAD PLAN
```markdown
# Add Login

We need login.

## Steps
1. Make login page
2. Add database stuff
3. Test it
```

### ✅ GOOD PLAN
```markdown
# User Authentication System

## Overview
Implement secure user authentication with email/password login, session management, and password reset functionality.

## Goals
- Allow users to create accounts and log in
- Secure password storage with bcrypt
- Session-based authentication
- Password reset via email

## Success Criteria
- [ ] Users can register with email/password
- [ ] Users can log in and log out
- [ ] Passwords are hashed with bcrypt (cost 10)
- [ ] Sessions expire after 24 hours
- [ ] Password reset emails are sent within 30 seconds

## Technical Approach
- Use bcrypt for password hashing
- Store sessions in Redis (or database if small scale)
- Email via SMTP (SendGrid in production)
- Rate limiting: 5 login attempts per 15 minutes

## Implementation Phases

### Phase 1: Database & Models (2 hours)
- [ ] Create users table (email, password_hash, created_at)
- [ ] Create sessions table (user_id, token, expires_at)
- [ ] Add User model with password hashing

**Files:**
- `database/migrations/001_create_users.sql`
- `src/models/User.php`

### Phase 2: Registration API (2 hours)
- [ ] POST /api/auth/register endpoint
- [ ] Validate email format
- [ ] Check for duplicate emails
- [ ] Hash password and create user

**Files:**
- `src/api/auth.php`
- `src/validators/UserValidator.php`

### Phase 3: Login API (2 hours)
- [ ] POST /api/auth/login endpoint
- [ ] Verify email/password
- [ ] Create session token
- [ ] Return token to client

**Files:**
- `src/api/auth.php`
- `src/services/AuthService.php`

## Testing Strategy

### Unit Tests
- [ ] User model password hashing
- [ ] Email validation
- [ ] Session token generation

### Integration Tests
- [ ] Register → Login → Access protected route
- [ ] Invalid credentials return 401
- [ ] Expired sessions are rejected

### Manual Testing
- [ ] Register new user in browser
- [ ] Log in and verify session cookie
- [ ] Log out and verify session cleared
```

---

**Remember:** A good plan saves time. A bad plan wastes time. Take 30 minutes to plan, save hours of rework.
