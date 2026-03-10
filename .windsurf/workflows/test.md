---
description: Run build tests and verification checks across the project
---

# Test & Verification Workflow

Use this workflow to run comprehensive tests and checks before committing or deploying.

**⚠️ ADAPT THESE COMMANDS TO YOUR TECH STACK**

---

## Quick Test (Fastest - 30 seconds)

Run basic health checks:

```bash
# Check if everything compiles
# ADAPT: Use your language's type checker or linter
npm run type-check        # Node.js/TypeScript
# composer check          # PHP
# python -m mypy .        # Python
# cargo check             # Rust
```

---

## Standard Test (Recommended - 2-3 minutes)

Run all tests and build verification:

// turbo
```bash
# Run all tests across workspace
# ADAPT: Use your test runner
npm test                  # Node.js
# composer test           # PHP
# pytest                  # Python
# cargo test              # Rust
# go test ./...           # Go
```

// turbo
```bash
# Build all packages to verify no errors
# ADAPT: Use your build command
npm run build             # Node.js
# composer install        # PHP
# python setup.py build   # Python
# cargo build             # Rust
# go build ./...          # Go
```

---

## Full Verification (Complete - 5 minutes)

Run everything including linting and coverage:

// turbo
```bash
# 1. Type checking
# ADAPT: Use your type checker
npm run type-check
# composer phpstan
# mypy .
```

// turbo
```bash
# 2. Linting
# ADAPT: Use your linter
npm run lint
# composer phpcs
# pylint src/
# cargo clippy
```

// turbo
```bash
# 3. Tests with coverage
# ADAPT: Use your test runner with coverage
npm run test:coverage
# composer test -- --coverage
# pytest --cov
# cargo tarpaulin
```

// turbo
```bash
# 4. Build all packages
npm run build
```

---

## Database Tests

Verify database integrity and connectivity:

// turbo
```bash
# Quick database connection check
# ADAPT: Use your database check command
npm run test:db
# php artisan db:check
# python manage.py check --database default
```

```bash
# Check database content
# ADAPT: Use your database inspection tool
node scripts/check-database-content.js
# php artisan db:show
# python manage.py dbshell
```

---

## Pre-Commit Checklist

Before committing, run:

1. **Type Check** (fast)
   ```bash
   # ADAPT: Your type checker
   npm run type-check
   ```

2. **Tests** (medium)
   ```bash
   # ADAPT: Your test command
   npm test
   ```

3. **Build** (medium)
   ```bash
   # ADAPT: Your build command
   npm run build
   ```

If all pass: ✅ Safe to commit

---

## Pre-Deploy Checklist

Before deploying to production:

1. **Full verification**
   ```bash
   # ADAPT: Chain your verification commands
   npm run type-check && npm run lint && npm test && npm run build
   ```

2. **Integration tests**
   ```bash
   # ADAPT: Start your dev server
   npm run dev
   # Test in browser or with integration test suite
   ```

3. **Database check**
   ```bash
   # ADAPT: Your database verification
   npm run test:db
   ```

If all pass: ✅ Safe to deploy

---

## Troubleshooting

### Tests Failing?

1. **Clean and reinstall**
   ```bash
   # ADAPT: Your dependency cleanup
   rm -rf node_modules && npm install
   # rm -rf vendor && composer install
   # rm -rf venv && python -m venv venv && pip install -r requirements.txt
   ```

2. **Rebuild packages**
   ```bash
   # ADAPT: Your build command
   npm run build
   ```

3. **Check for errors**
   ```bash
   # ADAPT: Your type checker
   npm run type-check
   ```

### Build Failing?

1. **Clean build artifacts**
   ```bash
   # ADAPT: Your build output folders
   rm -rf dist build .next
   # rm -rf vendor
   # rm -rf __pycache__ *.pyc
   ```

2. **Rebuild from scratch**
   ```bash
   # ADAPT: Your build command
   npm run build
   ```

---

## Quick Reference

| Command | Speed | Use Case |
|---------|-------|----------|
| Type check | ⚡ Fast | Quick compile check |
| Test | 🏃 Medium | Run all tests |
| Database check | ⚡ Fast | Database connection check |
| Build | 🏃 Medium | Verify builds |
| Test coverage | 🐢 Slow | Full test coverage |
| Lint | 🏃 Medium | Code quality |

---

## Success Criteria

**Minimum for commit:**
- ✅ Type check passes
- ✅ Tests pass
- ✅ Build succeeds

**Minimum for deploy:**
- ✅ All of the above
- ✅ Lint passes
- ✅ Integration tests work
- ✅ Database checks pass

---

**Pro Tip:** Set up watch mode during development to catch issues early!

```bash
# ADAPT: Your watch command
npm run test:watch
# composer test -- --watch
# pytest-watch
```
