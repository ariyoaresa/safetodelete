SafeToDelete

Multi-Agent Execution Plan & Work Allocation

Product: SafeToDelete \| Version: 1.0 \| Status: Agent implementation
brief

## 1. How agents should collaborate

Agents must work against shared contracts and explicit ownership
boundaries. One agent owns integration and architecture decisions. Other
agents should not independently rename packages, change shared schemas,
or introduce overlapping infrastructure.

## 2. Recommended agent roles

  ---------------------------------------------------------------------------
  Agent                   Ownership                   Deliverables
  ----------------------- --------------------------- -----------------------
  Agent 0 --- Tech Lead / Architecture, shared types, Repo scaffold,
  Integrator              integration, code review    decisions, integration
                                                      branch, end-to-end
                                                      acceptance

  Agent 1 --- Analyzer    packages/analyzer and       File inventory, AST
                          packages/language-js-ts     extraction, resolver,
                                                      diagnostics, fixtures

  Agent 2 --- Graph &     packages/dependency-graph   Graph model, impact
  Risk                    and packages/risk-engine    queries, evidence
                                                      aggregation and
                                                      categories

  Agent 3 --- Simulator & packages/simulator and      Safe worktree
  Runner                  packages/runner             lifecycle, sandbox
                                                      contract, command
                                                      execution, cleanup

  Agent 4 --- API & Data  apps/api and prisma         Persistence, job
                                                      orchestration, API
                                                      endpoints, validation

  Agent 5 --- Dashboard   apps/web                    Repository view,
                                                      analysis explorer,
                                                      deletion proposal flow,
                                                      reports
  ---------------------------------------------------------------------------

## 3. Execution order and dependencies

1.  Agent 0 creates the monorepo, lint/test/build conventions, shared
    report schema and package interfaces.

2.  Agents 1 and 2 implement analyzer and graph against agreed fixture
    data and types.

3.  Agent 3 implements simulation and runner using a fake runner first,
    then container-backed execution.

4.  Agent 4 implements persistence and job orchestration using mocked
    worker interfaces.

5.  Agent 5 builds the UI against API contracts and seeded fixtures; do
    not wait for all backend features.

6.  Agent 0 integrates the real modules, runs the acceptance suite,
    resolves contract mismatches and documents release readiness.

## 4. Shared contracts to agree before parallel work

Define these types in packages/report-schema or packages/shared before
agents begin independent implementation:

``` text
type RiskCategory = "LOW" | "MEDIUM" | "HIGH" | "INCONCLUSIVE";

interface RepositorySnapshot {
  rootPath: string;
  commitSha: string;
  detectedLanguages: string[];
  packageManager?: string;
}

interface AnalysisNode {
  id: string;
  path: string;
  kind: "file" | "package" | "symbol" | "route" | "config";
}

interface AnalysisEdge {
  from: string;
  to: string;
  kind: "imports" | "reexports" | "dynamic-import" | "config-reference" | "package-dependency";
  evidence: { file: string; line?: number; column?: number };
}

interface CheckResult {
  label: string;
  status: "PASSED" | "FAILED" | "SKIPPED" | "TIMED_OUT" | "ERROR";
  exitCode?: number;
  durationMs: number;
  logReference?: string;
}

interface SimulationReport {
  id: string;
  repository: RepositorySnapshot;
  targets: string[];
  riskCategory: RiskCategory;
  findings: Array<{
    severity: "INFO" | "WARNING" | "ERROR";
    category: string;
    message: string;
    evidence: unknown[];
  }>;
  checks: CheckResult[];
  limitations: string[];
}
```

## 5. Agent task cards

### Agent 0 --- Foundation

-   Create workspace, TypeScript config, formatter, lint and test setup.

-   Create shared schemas and package boundaries.

-   Create a fixture repository with known imports, aliases, dynamic
    imports and tests.

-   Set CI to run lint, typecheck, unit tests and package builds.

-   Publish architecture decision records for sandboxing, dirty-tree
    policy and report semantics.

### Agent 1 --- Analyzer

-   Implement safe file discovery with ignore rules and symlink
    handling.

-   Parse JS/TS using the TypeScript Compiler API.

-   Extract imports, exports, re-exports, literal require and dynamic
    import references.

-   Resolve relative paths, index files, extensions, tsconfig aliases
    and package exports.

-   Emit unresolved/dynamic reference diagnostics and fixture-based
    tests.

### Agent 2 --- Graph & Risk

-   Implement directed graph nodes and edges with stable IDs.

-   Provide direct and transitive dependants queries for deletion
    targets.

-   Detect unresolved edges and potential entry-point/config references.

-   Implement transparent Low/Medium/High/Inconclusive rules.

-   Add tests proving a missing test suite cannot produce an unqualified
    Low result.

### Agent 3 --- Simulation & Runner

-   Implement detached worktree creation at immutable base SHA.

-   Validate target paths against traversal and symlink escape.

-   Apply deletion only in temporary worktree and preserve original
    checkout.

-   Implement runner interface, timeouts, cancellation, output caps and
    cleanup.

-   Implement container execution with no host secrets, restricted
    network and resource limits.

-   Test dirty checkout handling, worker interruption and cleanup
    failures.

### Agent 4 --- API & Data

-   Create Prisma models and migrations for repositories, analyses,
    simulations, findings and command results.

-   Implement authenticated API routes and request validation.

-   Queue jobs and expose status transitions.

-   Persist versioned reports and bounded logs.

-   Implement cancellation and authorization checks for every
    repository/run resource.

### Agent 5 --- Dashboard

-   Build repository list and repository detail pages.

-   Show analysis inventory and dependency impact for a selected target.

-   Build deletion proposal review and simulation progress UI.

-   Build report page with risk category, findings, checks, logs and
    limitations.

-   Use loading, empty, error and unsupported-project states.

-   Ensure keyboard navigation, accessible labels and responsive
    layouts.

## 6. Definition of done for every agent

-   Code is committed in the agreed package/app ownership area.

-   Public interfaces and assumptions are documented.

-   Unit tests cover normal cases, edge cases and failure cases.

-   No secrets, credentials or real user data are committed.

-   Lint, typecheck and relevant tests pass.

-   The agent reports changed files, commands run, known limitations and
    integration notes.

## 7. Coordination rules

-   Agent 0 owns shared schema changes; all other agents propose changes
    rather than silently diverging.

-   Agents must not edit another agent's owned directories without
    coordination.

-   Use fixture data and mocks to unblock parallel UI/API work.

-   No agent may weaken sandbox restrictions to make a test pass.

-   Record unresolved questions as explicit decisions; do not invent
    product behaviour.
