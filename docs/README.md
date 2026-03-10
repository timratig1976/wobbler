# Project Documentation

Welcome to the project documentation. This guide will help you get started and find the information you need.

---

## 📚 Documentation Structure

### Core Documentation
- **[Getting Started](getting-started.md)** - Installation, setup, and first steps
- **[User Guide](user-guide.md)** - Complete feature documentation
- **[API Reference](api-reference.md)** - API endpoints and usage
- **[Architecture](architecture.md)** - System design and technical details
- **[Deployment](deployment.md)** - Production deployment guide
- **[Troubleshooting](troubleshooting.md)** - Common issues and solutions

### Development
- **[Development Rules](instructions/DEVELOPMENT_RULES.md)** - Core development principles
- **[Testing Guide](instructions/testing-guide.md)** - Testing checklist and commands
- **[Kanban Workflow](kanban/README.md)** - Feature planning and tracking

---

## 🚀 Quick Start

```bash
# 1. Clone and install
git clone <repository-url>
cd <project-name>
# Install dependencies (adapt to your stack)
npm install  # or: composer install, pip install -r requirements.txt

# 2. Configure environment
cp .env.example .env
# Edit .env with your settings

# 3. Run development server
npm run dev  # or: php artisan serve, python manage.py runserver

# 4. Access the application
# Open http://localhost:3000 in your browser
```

For detailed setup instructions, see [Getting Started](getting-started.md).

---

## 📖 Quick Links

### For Users
- [Getting Started Guide](getting-started.md) - First-time setup
- [User Guide](user-guide.md) - How to use features
- [Troubleshooting](troubleshooting.md) - Fix common issues

### For Developers
- [Architecture Overview](architecture.md) - System design
- [API Reference](api-reference.md) - API documentation
- [Development Rules](instructions/DEVELOPMENT_RULES.md) - Coding standards
- [Testing Guide](instructions/testing-guide.md) - How to test

### For DevOps
- [Deployment Guide](deployment.md) - Production setup
- [Environment Configuration](deployment.md#environment-variables) - Config reference

---

## 🔄 Feature Development Workflow

1. **Plan** - Create feature plan in `kanban/backlog/`
2. **Build** - Move to `kanban/in-progress/` and implement
3. **Test** - Run tests and verify functionality
4. **Document** - Update relevant core docs
5. **Archive** - Move plan to `archive/implementation-notes/`

See [Kanban Workflow](kanban/README.md) for details.

---

## 🆘 Need Help?

- **Common Issues:** Check [Troubleshooting](troubleshooting.md)
- **API Questions:** See [API Reference](api-reference.md)
- **Setup Problems:** Review [Getting Started](getting-started.md)

---

## 📝 Contributing

Before making changes:
1. Read [Development Rules](instructions/DEVELOPMENT_RULES.md)
2. Create a feature plan in `kanban/backlog/`
3. Follow the testing checklist
4. Update documentation

---

**Last Updated:** YYYY-MM-DD  
**Version:** 1.0.0
