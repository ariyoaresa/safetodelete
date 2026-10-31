# Security Policy

## Threat Model Overview

SafeToDelete processes source code repositories that may contain untrusted, third-party, or malicious code. Build scripts, test runners, package lifecycle scripts, and compiler plugins can execute arbitrary code. Therefore, SafeToDelete treats all analyzed repositories as potentially hostile input.

### Core Sandbox Guarantees

1. **Non-Destructive Git Isolation:**
   - Simulations execute strictly inside detached Git worktrees (`git worktree add --detach`) created in isolated temporary locations.
   - The user's original working checkout, uncommitted modifications, and index are never modified.

2. **Filesystem Escape & Path Traversal Protections:**
   - All deletion targets are normalized and validated against path traversal (`..`), symlink escapes, and internal Git directories (`.git`).
   - Any attempt to delete or access files outside the temporary simulation worktree raises a fatal `Security Violation` error.

3. **Environment & Secret Scrubbing:**
   - Subprocesses are spawned in a strictly allowlisted environment, stripping API tokens, cloud credentials (`AWS_*`, `GITHUB_*`, `NPM_TOKEN`), and private user directories.
   - Captured logs pass through automated regular expression filters that redact private keys, tokens, and authorization headers prior to persistence or display.

4. **Resource Constraints:**
   - Execution commands are bound by strict wall-clock timeouts (default 60 seconds) and output buffer limits (1 MB) to prevent denial of service and runaway processes.

---

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |

---

## Reporting a Vulnerability

If you discover a security vulnerability or sandbox escape in SafeToDelete, please **do not open a public issue**.

Please report security vulnerabilities by emailing the maintainers directly or opening a GitHub Private Security Advisory:

- **Email**: `security@safetodelete.local` (or maintainer contact)
- **Response Time**: We acknowledge receipt of vulnerability reports within 48 hours and aim to provide a resolution timeline within 5 business days.

Please provide:
- A description of the vulnerability and its potential impact.
- Step-by-step reproduction instructions or a minimal proof-of-concept repository.
- Proposed mitigations, if known.
