# Security Policy

## Scope

Local OCR is a **local-first desktop application**. The Flask backend is intended to run on `127.0.0.1` and process files only on the user's machine. It is not designed as a multi-user internet service.

## Supported versions

| Version | Supported |
| ------- | --------- |
| latest `main` | yes |
| older tags | best effort |

## Reporting a vulnerability

If you discover a security issue, please report it privately:

1. Open a **private security advisory** on GitHub for this repository, or
2. Contact the maintainer through GitHub with minimal reproduction details.

Please do **not** open public issues for exploitable vulnerabilities.

## Threat model

### In scope

- Local privilege escalation via malicious PDF upload
- Command injection through OCR helper arguments
- Path traversal in uploaded or saved filenames
- Electron renderer escape or unsafe navigation
- Information disclosure through verbose backend errors
- Insecure local network exposure if the backend binds beyond localhost

### Out of scope

- Attacks that require physical access to an unlocked machine
- Malware already running on the host with user privileges
- Social engineering of the end user
- Unsigned installer warnings from macOS Gatekeeper or Windows SmartScreen

## Security controls

- Backend binds to localhost by default
- Upload size limits and PDF header validation
- Strict OCR language and recovery-parameter validation
- Subprocess arguments passed as arrays, not shell strings
- Passwords passed to `qpdf` through environment variables instead of argv when possible
- Electron `contextIsolation`, disabled `nodeIntegration`, renderer sandboxing
- Navigation restricted to the local app origin
- Save-dialog filenames sanitized before use
- Security headers on local HTTP responses (CSP, `nosniff`, `frame-ancestors`)

## Dependency hygiene

```bash
npm audit
npm ci
```

Release builds should be produced from tagged commits through GitHub Actions.

## Docker / maintainer mode

The legacy Docker setup may bind more broadly for development. Use it only in trusted environments and never expose it directly to the public internet.
