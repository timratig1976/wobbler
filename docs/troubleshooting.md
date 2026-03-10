# Troubleshooting

Common issues and solutions.

**⚠️ ADD YOUR ACTUAL COMMON ISSUES AS YOU DISCOVER THEM**

---

## Installation Issues

### Dependencies Won't Install

**Symptom:** Package installation fails with errors

**Cause:** Corrupted cache or incompatible versions

**Solution:**
```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install

# Or for other package managers:
rm -rf vendor && composer install
rm -rf venv && pip install -r requirements.txt
```

**Prevention:** Keep dependencies up to date regularly

---

### Database Connection Failed

**Symptom:** Can't connect to database

**Cause:** Incorrect credentials or database not running

**Solution:**
1. Check database is running
2. Verify credentials in `.env`
3. Ensure database exists
4. Check firewall/network settings

```bash
# Test database connection
# ⚠️ CUSTOMIZE FOR YOUR DATABASE
psql -h localhost -U user -d dbname
```

**Prevention:** Use connection pooling and health checks

---

## Runtime Issues

### Port Already in Use

**Symptom:** `EADDRINUSE` or port conflict error

**Cause:** Another process is using the port

**Solution:**
```bash
# Find process using the port
lsof -ti:3000

# Kill the process
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 npm run dev
```

**Prevention:** Use unique ports for each project

---

### Environment Variables Not Loading

**Symptom:** Application can't find environment variables

**Cause:** `.env` file not loaded or incorrect format

**Solution:**
1. Check `.env` file exists
2. Verify variable names (no spaces around `=`)
3. Restart application after changes
4. Check for `.env.local` or `.env.production`

```bash
# Verify .env is being loaded
# ⚠️ CUSTOMIZE FOR YOUR STACK
node -e "require('dotenv').config(); console.log(process.env.YOUR_VAR)"
```

**Prevention:** Use `.env.example` as template

---

## Performance Issues

### Slow Response Times

**Symptom:** API responses take too long

**Cause:** Unoptimized queries or missing indexes

**Solution:**
1. Enable query logging
2. Identify slow queries
3. Add database indexes
4. Implement caching

```bash
# ⚠️ CUSTOMIZE FOR YOUR DATABASE
# Example: PostgreSQL slow query log
ALTER DATABASE dbname SET log_min_duration_statement = 1000;
```

**Prevention:** Monitor query performance regularly

---

### High Memory Usage

**Symptom:** Application uses excessive memory

**Cause:** Memory leaks or inefficient code

**Solution:**
1. Profile memory usage
2. Check for circular references
3. Implement pagination
4. Use streaming for large data

```bash
# ⚠️ CUSTOMIZE FOR YOUR RUNTIME
# Example: Node.js memory profiling
node --inspect app.js
```

**Prevention:** Regular performance testing

---

## Build Issues

### Build Fails

**Symptom:** Build process exits with errors

**Cause:** TypeScript errors, missing dependencies, or configuration issues

**Solution:**
```bash
# Clean build artifacts
rm -rf dist build .next

# Reinstall dependencies
rm -rf node_modules
npm install

# Rebuild
npm run build
```

**Prevention:** Run builds locally before pushing

---

### Type Errors

**Symptom:** TypeScript compilation fails

**Cause:** Type mismatches or missing type definitions

**Solution:**
1. Check error messages carefully
2. Install missing type definitions
3. Fix type mismatches
4. Use `any` as last resort (not recommended)

```bash
# Install type definitions
npm install --save-dev @types/package-name
```

**Prevention:** Use strict TypeScript settings

---

## Deployment Issues

### Deployment Fails

**Symptom:** Deployment process fails

**Cause:** Build errors, missing environment variables, or configuration issues

**Solution:**
1. Check deployment logs
2. Verify environment variables
3. Test build locally
4. Check platform-specific requirements

**Prevention:** Use staging environment for testing

---

### Application Won't Start in Production

**Symptom:** Application crashes on startup

**Cause:** Missing dependencies, incorrect configuration, or database issues

**Solution:**
1. Check application logs
2. Verify all environment variables
3. Test database connection
4. Check file permissions

```bash
# View logs
# ⚠️ CUSTOMIZE FOR YOUR PLATFORM
pm2 logs
docker logs container-name
```

**Prevention:** Test production build locally

---

## Security Issues

### API Key Exposed

**Symptom:** API key leaked in code or logs

**Cause:** Hardcoded credentials or improper logging

**Solution:**
1. **Immediately** rotate the API key
2. Remove from code/logs
3. Use environment variables
4. Add to `.gitignore`

**Prevention:** Never commit secrets to git

---

### CORS Errors

**Symptom:** Browser blocks API requests

**Cause:** Missing or incorrect CORS headers

**Solution:**
```javascript
// ⚠️ CUSTOMIZE FOR YOUR FRAMEWORK
// Example: Express.js
app.use(cors({
  origin: 'https://your-domain.com',
  credentials: true
}));
```

**Prevention:** Configure CORS properly from start

---

## Database Issues

### Migration Fails

**Symptom:** Database migration errors

**Cause:** Schema conflicts or missing dependencies

**Solution:**
1. Check migration order
2. Verify database state
3. Rollback if needed
4. Fix migration script

```bash
# ⚠️ CUSTOMIZE FOR YOUR ORM
# Rollback migration
npm run migrate:rollback

# Re-run migration
npm run migrate
```

**Prevention:** Test migrations in development first

---

## Getting Help

If you can't find a solution here:

1. **Check logs** - Application and server logs often contain clues
2. **Search documentation** - Review [Architecture](architecture.md) and [API Reference](api-reference.md)
3. **Test in isolation** - Reproduce issue in minimal environment
4. **Ask for help** - Provide error messages and steps to reproduce

---

## Reporting Issues

When reporting an issue, include:
- Error message (full stack trace)
- Steps to reproduce
- Environment (OS, versions, etc.)
- What you've tried
- Expected vs actual behavior

---

**Remember:** Add new issues to this file as you discover them. This helps everyone.
