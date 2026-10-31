# Contributing to SafeToDelete

Thank you for your interest in contributing to SafeToDelete! We are building an evidence-based developer tool designed to make code deletions safe, predictable, and stress-free.

---

## Code of Conduct

All contributors and participants are expected to follow our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before participating in our issues, discussions, or pull requests.

---

## Development Setup

### Prerequisites

- **Node.js**: `>= 22.0.0`
- **npm**: `>= 10.0.0`
- **Git**: `>= 2.30.0`

### Setup Instructions

1. **Fork and clone the repository:**
   ```bash
   git clone https://github.com/your-username/safetodelete.git
   cd safetodelete
   ```

2. **Install all workspace dependencies:**
   ```bash
   npm install
   ```

3. **Build the packages:**
   ```bash
   npm run build
   ```

4. **Run the test suite:**
   ```bash
   npm test
   ```

---

## Monorepo Architecture

SafeToDelete uses an npm workspace monorepo. Please adhere to the established package boundaries:

- `packages/report-schema`: Shared data models, findings types, and report interfaces.
- `packages/shared`: Cross-cutting utilities (path traversal safety, secret redactor, environment sanitization).
- `packages/language-js-ts`: TypeScript AST parsing and resolver.
- `packages/dependency-graph`: Directed graph algorithms (direct and transitive impact queries).
- `packages/analyzer`: High-level file discovery and static analysis coordinator.
- `packages/simulator`: Git worktree creation, non-destructive deletion, and cleanup.
- `packages/runner`: Sandboxed command execution with timeouts and output caps.
- `packages/risk-engine`: Deterministic evidence aggregation and risk category calculation.
- `packages/cli`: The terminal user interface and CLI commands.

> **Architecture Invariant:** Packages must never bypass sandboxing or weaken path traversal checks to make tests pass.

---

## Development Workflow

1. Create a feature branch:
   ```bash
   git checkout -b feat/my-new-feature
   ```

2. Make your changes adhering to strict TypeScript standards.
3. Add unit and fixture tests for new functionality or bug fixes.
4. Verify all tests pass:
   ```bash
   npm test
   ```
5. Ensure packages compile cleanly:
   ```bash
   npm run build
   ```

---

## Commit Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat(analyzer)`: add support for vue script blocks
- `fix(resolver)`: resolve index files when extension is omitted
- `test(runner)`: verify child process tree cleanup on SIGTERM
- `docs(readme)`: improve quickstart instructions

---

## Submitting a Pull Request

When opening a pull request:
- Provide a clear description of the problem solved and technical approach.
- Include automated tests covering standard behavior, edge cases, and failure modes.
- Confirm that `npm test` and `npm run build` pass without warnings.
- Keep pull requests focused on a single topic or feature.

---

## Security Vulnerabilities

If you discover a security vulnerability (such as a sandbox escape, path traversal bug, or secret exposure issue), please do not open a public issue. See our [Security Policy](SECURITY.md) for confidential reporting procedures.
