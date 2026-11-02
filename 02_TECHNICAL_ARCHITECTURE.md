SafeToDelete

Technical Architecture & Engineering Specification

Product: SafeToDelete \| Version: 1.0 \| Status: Agent implementation
brief

## 1. Architecture goals

-   Keep the analysis engine framework-independent and reusable by CLI,
    API, IDE and CI integrations.

-   Separate orchestration/API services from untrusted repository
    execution.

-   Make each analysis and simulation reproducible using an immutable
    commit SHA and recorded configuration.

-   Persist structured findings, not only generated prose.

-   Support incremental language adapters without coupling the entire
    product to TypeScript.

## 2. Recommended stack

> **Implementation Status Note:**  
> **Phase 1 (Current):** Delivers the local-first CLI and core modular libraries under `packages/*` (`@safetodelete/cli`, `@safetodelete/analyzer`, `@safetodelete/language-js-ts`, `@safetodelete/dependency-graph`, `@safetodelete/simulator`, `@safetodelete/runner`, `@safetodelete/risk-engine`, `@safetodelete/report-schema`, `@safetodelete/ai`, and `@safetodelete/shared`).  
> **Phase 2 (Roadmap):** Hosted multi-tenant Web dashboard (Next.js), persistent API backend (Fastify/NestJS), database persistence (PostgreSQL + Prisma), and async queue workers (Redis + BullMQ).


  -----------------------------------------------------------------------
  Area                    Recommendation          Notes
  ----------------------- ----------------------- -----------------------
  Web app                 Next.js + TypeScript +  Dashboard and report
                          Tailwind + shadcn/ui    exploration

  API                     Node.js + TypeScript    Choose one framework
                          (Fastify or NestJS)     and standardize

  CLI                     Node.js + TypeScript    Local-first developer
                                                  workflow

  Parser                  TypeScript Compiler     AST extraction for
                          API; Babel where needed JS/TS

  Graph                   Typed adjacency graph   Start simple; avoid
                          in memory; PostgreSQL   graph DB prematurely
                          persistence             

  Database                PostgreSQL + Prisma     Users, repositories,
                                                  runs and findings

  Jobs                    Redis + BullMQ          Asynchronous
                                                  analysis/simulation
                                                  jobs

  Execution               Ephemeral containers /  Never execute untrusted
                          isolated workers        code in API process

  Tests                   Vitest/Jest +           Run repository-defined
                          Playwright for          checks only in sandbox
                          dashboard               

  Packaging               pnpm workspaces +       Monorepo orchestration
                          Turborepo (optional)    
  -----------------------------------------------------------------------

## 3. Proposed monorepo

``` text
safetodelete/
  apps/
    web/                    # Next.js dashboard
    api/                    # Auth, repository and job APIs
    worker/                 # Isolated job orchestration
  packages/
    cli/                    # `safetodelete` command
    analyzer/               # File discovery and AST analysis
    language-js-ts/         # JS/TS parser adapter
    dependency-graph/       # Graph model and queries
    simulator/              # Worktree creation and patch application
    runner/                 # Build/test command execution interface
    risk-engine/            # Evidence aggregation and risk categories
    report-schema/          # Shared report types and validation
    shared/                 # Common utilities
  prisma/
  infra/
    docker/
    scripts/
  docs/
```

## 4. Core module contracts

  -----------------------------------------------------------------------
  Module                  Input                   Output
  ----------------------- ----------------------- -----------------------
  Analyzer                Repository path, commit Inventory, symbols,
                          SHA, config             imports, exports,
                                                  diagnostics

  Dependency graph        Normalized analysis     Nodes, edges,
                          records                 direct/transitive
                                                  impact queries

  Simulator               Git repo, base SHA,     Isolated worktree
                          deletion targets        handle and simulation
                                                  manifest

  Runner                  Sandbox handle,         Command results, logs,
                          allowlisted commands,   exit codes, timings
                          limits                  

  Risk engine             Static findings +       Risk category, evidence
                          simulation results +    list, rationale
                          uncertainty             

  Report schema           Run metadata and all    Versioned JSON report
                          module outputs          
  -----------------------------------------------------------------------

## 5. Analysis model

For the first release, prioritize reliable file-level relationships.
Parse JS/TS source files into ASTs and extract static import
declarations, export declarations, re-exports, dynamic import
expressions where statically resolvable, require calls with literal
paths, package.json dependencies, tsconfig path aliases, and common
configuration entry points.

-   Represent each file/module as a graph node with stable
    repository-relative path.

-   Represent imports/re-exports as directed edges from importer to
    imported module.

-   Store unresolved imports and dynamic patterns as diagnostics rather
    than silently ignoring them.

-   Resolve extensions, index files, path aliases and package exports
    using explicit resolver rules.

-   Keep symbol-level analysis behind an adapter so file-level MVP can
    ship first.

-   Do not label a file 'safe to delete' merely because it has zero
    incoming static edges.

## 6. Simulation lifecycle

1.  Validate repository path and resolve the exact base commit.

2.  Check source repository status; if dirty, require explicit policy
    (default: refuse or analyze a committed SHA only).

3.  Create a unique detached Git worktree at the base SHA.

4.  Validate deletion targets are repository-relative paths and remain
    within the worktree.

5.  Apply deletion only inside the worktree.

6.  Start an isolated execution container with read-only base image,
    bounded writable workspace, no host mounts except explicit
    workspace, and no secrets.

7.  Run only configured/approved commands with time, CPU, memory, output
    and process limits.

8.  Collect results and logs, stop the container, remove the worktree
    and temporary artifacts.

9.  Persist report metadata and evidence; ensure cleanup is idempotent
    even after worker crashes.

## 7. API outline

  -----------------------------------------------------------------------
  Method / route                      Purpose
  ----------------------------------- -----------------------------------
  POST /api/repositories              Register a local/remote repository
                                      reference

  POST /api/repositories/:id/analyses Queue baseline static analysis

  GET /api/analyses/:id               Fetch analysis status and results

  POST /api/simulations               Create a deletion simulation from a
                                      base SHA and targets

  GET /api/simulations/:id            Fetch simulation status and report

  GET /api/simulations/:id/logs       Fetch bounded command logs

  POST /api/simulations/:id/cancel    Request cancellation
  -----------------------------------------------------------------------

The CLI should use the same package-level contracts and report schema.
Avoid making the CLI dependent on the hosted API for core local
analysis.

## 8. Initial data entities

  -----------------------------------------------------------------------
  Entity                              Important fields
  ----------------------------------- -----------------------------------
  User                                id, email, createdAt

  Repository                          id, ownerId, displayName, provider,
                                      remoteUrl, defaultBranch

  Analysis                            id, repositoryId, commitSha,
                                      status, config, startedAt,
                                      completedAt

  AnalysisNode                        id, analysisId, path, nodeType,
                                      metadata

  AnalysisEdge                        id, analysisId, sourceNodeId,
                                      targetNodeId, edgeType

  Simulation                          id, analysisId, baseSha, targets,
                                      status, riskCategory, startedAt,
                                      completedAt

  CommandResult                       id, simulationId, commandLabel,
                                      exitCode, durationMs, logRef

  Finding                             id, analysisId/simulationId,
                                      severity, category, message,
                                      evidence, confidenceLabel
  -----------------------------------------------------------------------

## 9. Risk assessment rules

Use explainable categories, not a single opaque AI score. Example
policy:

  -----------------------------------------------------------------------
  Category                            Example evidence
  ----------------------------------- -----------------------------------
  High                                A known dependant remains; build or
                                      test fails after deletion; an
                                      explicit route/config reference is
                                      broken.

  Medium                              Unresolved dynamic import; test
                                      coverage is incomplete; framework
                                      convention may reference the
                                      target.

  Low                                 No known static dependants and
                                      configured checks pass, with
                                      documented analysis coverage.

  Inconclusive                        Analysis failed, sandbox could not
                                      run, repository unsupported, or
                                      required checks were skipped.
  -----------------------------------------------------------------------

A Low result means 'no issue found by the checks performed', not 'proven
safe'. Always show the checks performed and limitations.

## 10. Engineering conventions

-   Use strict TypeScript, runtime validation at external boundaries,
    and versioned shared schemas.

-   Use structured logs with correlation IDs for analysis and simulation
    jobs.

-   Make jobs idempotent and cancellation-aware.

-   Avoid storing full source code unless required and explicitly
    disclosed.

-   Redact secrets from logs and reports.

-   Pin toolchain versions and record them in each report for
    reproducibility.

-   Add unit tests for resolver edge cases and integration tests using
    fixture repositories.
