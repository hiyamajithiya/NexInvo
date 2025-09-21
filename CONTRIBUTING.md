# Contributing to NexInvo

Thank you for your interest in contributing to NexInvo! This document provides guidelines and instructions for contributing to the project.

## Table of Contents
- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Contributions](#making-contributions)
- [Pull Request Process](#pull-request-process)
- [Code Style Guidelines](#code-style-guidelines)
- [Testing Guidelines](#testing-guidelines)
- [Reporting Issues](#reporting-issues)

## Code of Conduct
By participating in this project, you agree to abide by our Code of Conduct. Please treat all community members with respect and create a welcoming environment for everyone.

## Getting Started

### Prerequisites
- Node.js 18+
- React Native development environment
- Git

### Fork and Clone
1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/nexinvo.git
   cd nexinvo
   ```

3. Add the original repository as upstream:
   ```bash
   git remote add upstream https://github.com/nexinvo/nexinvo.git
   ```

## Development Setup

### Mobile App Setup
```bash
cd nexinvo/mobile/NexInvoMobile

# Install dependencies
npm install

# iOS setup (macOS only)
cd ios && pod install && cd ..

# Start Metro bundler
npm start

# Run on iOS
npm run ios

# Run on Android
npm run android
```

### Backend Setup
```bash
cd nexinvo/backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Start development server
python manage.py runserver
```

### Frontend Setup
```bash
cd nexinvo/frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

## Making Contributions

### Branch Strategy
- `main`: Production-ready code
- `develop`: Integration branch for features
- `feature/your-feature-name`: New features
- `bugfix/issue-description`: Bug fixes
- `hotfix/critical-fix`: Critical production fixes

### Creating a Feature Branch
```bash
# Switch to develop branch
git checkout develop

# Pull latest changes
git pull upstream develop

# Create feature branch
git checkout -b feature/your-feature-name

# Make your changes
# ... code ...

# Commit changes
git add .
git commit -m "Add new feature: description"

# Push to your fork
git push origin feature/your-feature-name
```

## Pull Request Process

### Before Creating a PR
1. **Update from upstream**:
   ```bash
   git checkout develop
   git pull upstream develop
   git checkout feature/your-feature-name
   git rebase develop
   ```

2. **Run tests**:
   ```bash
   # Mobile tests
   cd nexinvo/mobile/NexInvoMobile
   npm test
   npm run test:e2e

   # Backend tests
   cd nexinvo/backend
   python manage.py test

   # Frontend tests
   cd nexinvo/frontend
   npm test
   ```

3. **Check code quality**:
   ```bash
   # Linting
   npm run lint

   # Type checking
   npm run typecheck

   # Formatting
   npm run format
   ```

### Creating the PR
1. Push your feature branch to your fork
2. Create a Pull Request on GitHub
3. Fill out the PR template completely
4. Link any related issues
5. Request review from maintainers

### PR Requirements
- [ ] All tests pass
- [ ] Code follows style guidelines
- [ ] Documentation updated if needed
- [ ] No console.log statements in production code
- [ ] Commit messages follow convention
- [ ] PR template filled out completely

## Code Style Guidelines

### TypeScript/JavaScript
- Use TypeScript for all new code
- Follow ESLint configuration
- Use Prettier for formatting
- Prefer functional components with hooks
- Use meaningful variable and function names
- Add JSDoc comments for complex functions

### Example Code Style
```typescript
/**
 * Calculates the total amount for an invoice
 * @param items - Array of invoice items
 * @param taxRate - Tax rate as decimal (e.g., 0.18 for 18%)
 * @returns Total amount including tax
 */
export const calculateInvoiceTotal = (
  items: InvoiceItem[],
  taxRate: number
): number => {
  const subtotal = items.reduce((sum, item) =>
    sum + (item.quantity * item.unitPrice), 0
  );

  return subtotal * (1 + taxRate);
};
```

### Commit Message Convention
Use the conventional commit format:
```
type(scope): description

[optional body]

[optional footer]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

Examples:
```
feat(auth): add biometric authentication support

fix(invoices): resolve PDF generation error for large invoices

docs(api): update authentication endpoints documentation
```

## Testing Guidelines

### Unit Tests
- Write tests for all new functions and components
- Aim for 80%+ code coverage
- Use Jest and React Native Testing Library
- Mock external dependencies

### Integration Tests
- Test API integrations
- Test component interactions
- Use realistic test data

### E2E Tests
- Test critical user flows
- Use Detox for mobile E2E testing
- Test on both iOS and Android

### Test Example
```typescript
import { render, fireEvent } from '@testing-library/react-native';
import { InvoiceForm } from '../InvoiceForm';

describe('InvoiceForm', () => {
  it('should validate required fields', () => {
    const { getByText, getByTestId } = render(<InvoiceForm />);

    fireEvent.press(getByText('Save Invoice'));

    expect(getByTestId('client-error')).toHaveTextContent(
      'Client is required'
    );
  });
});
```

## Reporting Issues

### Bug Reports
Use the bug report template and include:
- Clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Environment details (OS, device, app version)
- Screenshots or error logs

### Feature Requests
Use the feature request template and include:
- Problem statement
- Proposed solution
- Alternatives considered
- Acceptance criteria

### Security Issues
For security vulnerabilities, email security@nexinvo.com instead of creating a public issue.

## Code Review Process

### For Contributors
- Be responsive to feedback
- Make requested changes promptly
- Ask questions if feedback is unclear
- Keep PRs focused and small when possible

### Review Checklist
- [ ] Code follows style guidelines
- [ ] Tests are included and passing
- [ ] Documentation is updated
- [ ] No breaking changes (or properly documented)
- [ ] Performance impact considered
- [ ] Security implications reviewed

## Release Process

1. **Feature Freeze**: Stop adding new features
2. **Testing**: Comprehensive testing phase
3. **Documentation**: Update all documentation
4. **Version Bump**: Update version numbers
5. **Release Notes**: Document all changes
6. **Deploy**: Release to app stores/production

## Getting Help

- **Documentation**: Check the docs/ folder
- **Discussions**: Use GitHub Discussions for questions
- **Issues**: Create an issue for bugs or feature requests
- **Email**: Contact the team at dev@nexinvo.com

## Recognition

Contributors will be recognized in:
- Release notes
- CONTRIBUTORS.md file
- Annual contributor spotlight

Thank you for contributing to NexInvo! 🚀