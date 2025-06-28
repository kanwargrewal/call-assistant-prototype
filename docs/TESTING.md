# Testing Guide

This document describes basic sanity checks for the Call Assistant prototype. These tests ensure that the backend Python modules compile and that the project can perform TypeScript type checking if Node dependencies are installed.

## Backend

Run `py_compile` on all Python modules:

```bash
python3 -m py_compile backend/*.py
```

If there are no errors, the command exits silently.

## Frontend

The web app includes a TypeScript configuration. After installing Node dependencies (`npm install`), run the following from the `web/` directory:

```bash
npm run type-check
```

This performs type checking using `tsc`. If the command finishes without errors, the TypeScript codebase is consistent.

Linting is also available via:

```bash
npm run lint
```

These commands require `node_modules` to be present.

## Continuous Integration

For a full test suite, create automated tests using `pytest` for the backend and your preferred testing tool for the frontend. Future work can integrate these commands into CI to catch issues early.
