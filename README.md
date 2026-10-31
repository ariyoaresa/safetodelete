# SafeToDelete

> **Know what breaks before you delete it.**  
> Evidence-based dependency impact mapping and non-destructive deletion simulation for modern codebases.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D22.0.0-green)](https://nodejs.org/)
[![Tests](https://img.shields.io/badge/Tests-Passing-brightgreen)](#testing)

---

## The Problem

Developers regularly inherit or maintain codebases cluttered with apparently unused files, dead utilities, obsolete components, routes, and legacy configuration.

Simple text search (`grep`), linters, and dead-code elimination algorithms cannot reliably prove that removing a file is safe:
- **Barrels and Re-exports** obscure who truly consumes a module.
- **Dynamic imports and lazy-loading** hide dependencies from basic static analysis.
- **Path aliases (`@/...`)** defeat standard directory inspection.
- **Framework conventions & reflection** load files implicitly at runtime.
- **Untested paths** give developers false confidence.

**SafeToDelete solves this with non-destructive simulation.** It checks what depends on the target statically, spins up an isolated temporary Git worktree, removes the files *only in that isolated environment*, runs your project's build and test suites, and generates a structured, evidence-based risk assessment.

---

## Core Principles

- **Evidence over Confidence Theatre:** We never claim a deletion is "safe" merely because no incoming static imports were found.
- **Simulation is Non-Destructive:** Your working directory, current Git branch, uncommitted edits, and repository index are never touched.
- **Explain Uncertainty:** Clearly distinguish confirmed breakage, static references, observed test passes, and unverified possibilities.
- **Deterministic Risk Rules:** No opaque AI scoring. Risk categories (`LOW`, `MEDIUM`, `HIGH`, `INCONCLUSIVE`) are derived deterministically from verifiable evidence.
- **Secure by Default:** Untrusted repository scripts run in sanitized environments with strict timeouts, output buffer caps, and secret redaction.

---

## Architecture & Monorepo Overview

SafeToDelete is architected as an extensible monorepo:

```text
safetodelete/
├── packages/
│   ├── cli/               # The `safetodelete` CLI application
│   ├── analyzer/          # Repository inventory, AST parsing, and diagnostics
│   ├── language-js-ts/    # TypeScript Compiler API AST adapter and path alias resolver
│   ├── dependency-graph/  # Directed graph model with direct & transitive impact queries
│   ├── simulator/         # Git worktree lifecycle manager and path validator
│   ├── runner/            # Sandboxed command execution, timeouts, process tree termination
│   ├── risk-engine/       # Deterministic risk classification and findings aggregation
│   ├── report-schema/     # Versioned TypeScript schemas and validation types
│   └── shared/            # Path sanitization, security assertions, and log secret redactor
├── fixtures/
│   └── sample-project/    # Test fixture with barrels, aliases, dynamic imports, and tests
└── docs/                  # Architecture Decision Records (ADRs) and specifications
```

---

## Quickstart & Installation

### Requirements
- **Node.js**: `>= 22.0.0`
- **Git**: `>= 2.30.0`

### Installation

Clone the repository and install dependencies:

```bash
git clone https://github.com/your-org/safetodelete.git
cd safetodelete
npm install
npm run build
```

To link the CLI globally:

```bash
npm link --workspace=@safetodelete/cli
```

---

## CLI Usage

### 1. Identify Deletion Candidates

Analyze a repository to extract module relationships and find "orphans" (files with 0 incoming static references):

```bash
safetodelete analyze -r ./path-to-your-repo
```

Output:
```text
Repository: /path-to-your-repo
Commit SHA: c7b729e... (CLEAN)
Discovered Files: 42
Direct Dependencies/Edges: 118
Diagnostics: 1

Deletion Candidates (Files with 0 incoming static references) [2]:
  * src/legacy/old-util.ts
  * src/unused-widget.tsx
```

### 2. Simulate Isolated Deletion

Test deleting one or more target files before merging your pull request:

```bash
safetodelete simulate src/legacy/old-util.ts
```

With custom verification checks and dirty-tree bypass:

```bash
safetodelete simulate src/legacy/old-util.ts --allow-dirty --check "npm test" "npm run build"
```

Save report as JSON:

```bash
safetodelete simulate src/legacy/old-util.ts --json --out report.json
```

---

## Sample Reports

### Breaking Deletion (HIGH Risk)
```text
============================================================
  SAFETODELETE REPORT — PRE-MERGE RISK ASSESSMENT
============================================================
Report ID   : report-1793456253416
Repository  : /workspace/project
Commit SHA  : 765d7e6... (CLEAN)
Languages   : TypeScript, JavaScript
Pkg Manager : npm
Targets     : src/utils/math.ts
------------------------------------------------------------
RISK CATEGORY: [ HIGH ]
RATIONALE    : High risk of regression: 2 active static dependant(s) remain and verification test/build failed after removal.
------------------------------------------------------------
STATIC IMPACT:
  Direct dependants    : 2
    -> src/consumer.ts
    -> test/math.test.ts
  Transitive dependants: 1
    -> src/index.ts
------------------------------------------------------------
VERIFICATION CHECKS:
  [FAILED] npm test (code: 1, 1161ms)
    Summary: Cannot find module './utils/math.js' imported from test/math.test.ts
------------------------------------------------------------
FINDINGS (2):
  [ERROR] [CONFIRMED] Deletion candidate has 2 active static dependant(s) in the codebase.
  [ERROR] [OBSERVED] Check "npm test" failed after deletion simulation with exit code 1.
------------------------------------------------------------
DISCLAIMERS & LIMITATIONS:
  * Static analysis cannot prove absence of unobserved runtime dependencies, reflection, or dynamic path resolution.
  * Verification checks only validate the assertions implemented in your project test/build scripts.
============================================================
```

---

## Security & Sandboxing

SafeToDelete is built under the assumption that repository code may be untrusted:

1. **Path Traversal Escape Prevention:** All target paths are strictly validated to ensure they cannot escape the isolated worktree directory or target internal Git folders (`.git`).
2. **Environment Sanitization:** Child execution processes only inherit a minimal allowlist of environment variables (`PATH`, `NODE_ENV`, `TEMP`, `SYSTEMROOT`), preventing host secret exposure (e.g., `AWS_*`, `GITHUB_*`, `NPM_TOKEN`).
3. **Secret Redaction:** Command logs and output summaries pass through automated pattern scrubbers redacting private keys, tokens, and bearer authorizations.
4. **Execution Quotas:** Hard timeouts and output buffer caps prevent denial-of-service from infinite loops or memory-exhausting processes.

---

## Testing

Run the monorepo test suite using Vitest:

```bash
npm test
```

Build all packages:

```bash
npm run build
```

---

## Contributing

We welcome contributions! Please read our [CONTRIBUTING.md](CONTRIBUTING.md) and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before submitting pull requests.

---

## License

SafeToDelete is released under the [MIT License](LICENSE).

