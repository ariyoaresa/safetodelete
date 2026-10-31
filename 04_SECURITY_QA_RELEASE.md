SafeToDelete

Security, Testing & Release Requirements

Product: SafeToDelete \| Version: 1.0 \| Status: Agent implementation
brief

## 1. Security posture

SafeToDelete processes source repositories that may contain malicious
code. Any build, test, package-manager lifecycle script, compiler plugin
or test runner can execute arbitrary commands. Treat every repository as
hostile input.

## 2. Threat model

  -----------------------------------------------------------------------
  Threat                              Required mitigation
  ----------------------------------- -----------------------------------
  Malicious install/test script       Execute only inside ephemeral
                                      isolated container/VM; never in API
                                      process.

  Secret exfiltration                 Do not mount host credentials;
                                      scrub environment; default deny
                                      outbound network; no production
                                      secrets.

  Filesystem escape                   No privileged containers; no host
                                      root mount; path canonicalization;
                                      symlink and traversal checks.

  Resource exhaustion                 CPU, memory, disk, process,
                                      wall-clock and output limits.

  Log leakage                         Redact token/password/key patterns;
                                      bounded logs; access control and
                                      retention policy.

  Cross-tenant access                 Authorize every repository,
                                      analysis, simulation and log
                                      request by owner/team.

  Malicious archive/repository        Safe extraction, size/file-count
                                      limits, symlink policy and path
                                      validation.

  Worker compromise                   Ephemeral workers, least privilege,
                                      patched base images and destruction
                                      after job.
  -----------------------------------------------------------------------

## 3. Sandbox minimum requirements

-   Run untrusted commands in a disposable container or stronger
    isolation boundary; consider microVMs for hosted multi-tenant
    workloads.

-   Run as non-root with read-only root filesystem where practical.

-   Mount only the simulation workspace, not the host filesystem or
    Docker socket.

-   Disable outbound network by default; allow narrowly scoped access
    only when explicitly required.

-   Use strict CPU, memory, process-count, disk and execution-time
    quotas.

-   Use a clean environment allowlist; never inherit API keys, cloud
    credentials, SSH agent sockets or developer home directories.

-   Capture stdout/stderr with output caps and redact secrets before
    persistence.

-   Terminate the entire process group/container on timeout or
    cancellation.

## 4. Git and filesystem safety

-   Analyze a pinned commit SHA; do not rely on a moving branch name
    during a run.

-   Do not overwrite or reset the user's original working tree.

-   Default to refusing ambiguous dirty-working-tree simulations; offer
    an explicit committed-SHA-only mode.

-   Use detached worktrees with unique paths and reliable cleanup.

-   Reject absolute paths, parent traversal, paths outside repository
    root and symlink escapes.

-   Never accept shell command strings from an untrusted client;
    commands must come from validated project configuration and policy.

## 5. Test strategy

  -----------------------------------------------------------------------
  Test layer                          What to verify
  ----------------------------------- -----------------------------------
  Unit                                AST extraction, resolver, graph
                                      traversal, risk rules, path
                                      validation

  Fixture integration                 Known JS/TS repositories with
                                      aliases, barrels, dynamic imports
                                      and config entry points

  Simulation integration              Worktree isolation, deletion
                                      application, original checkout
                                      unchanged

  Runner integration                  Success, failure, timeout,
                                      cancellation, output truncation and
                                      cleanup

  Security tests                      Path traversal, symlink escape,
                                      malicious lifecycle script,
                                      environment secret absence, network
                                      restrictions

  API tests                           AuthZ, schema validation, job state
                                      transitions, log access

  E2E                                 Connect/register repo, analyze,
                                      select target, simulate, inspect
                                      report
  -----------------------------------------------------------------------

## 6. Required edge-case fixtures

-   A file imported through a barrel/re-export.

-   A file loaded through a literal dynamic import.

-   A file loaded through a non-literal dynamic import.

-   A framework route discovered by filesystem convention.

-   A file referenced from package.json or build configuration.

-   A TypeScript path alias.

-   A generated file and a source file that generates it.

-   A symlink inside the repository pointing outside the repository.

-   A dirty Git working tree.

-   A test command that hangs or spawns child processes.

-   A test command that prints a fake secret to verify redaction.

-   A repository with no tests and no build script.

## 7. Report integrity

-   Record exact base commit, tool version, analyzer version, runtime
    version and commands.

-   Distinguish FAILED from SKIPPED, TIMED_OUT and ERROR.

-   Do not convert a missing test suite into a passing test result.

-   Do not describe static non-reference as proof of no runtime usage.

-   Keep the evidence supporting each finding and provide source
    path/line where available.

-   Make risk category derivation deterministic and versioned.

## 8. Release gates

-   No known path traversal or sandbox escape vulnerabilities.

-   Original working tree remains unchanged across successful and failed
    simulations.

-   All worker jobs have enforced limits and reliable cleanup.

-   No secrets are passed into untrusted repository processes.

-   Reports clearly disclose skipped checks and analysis limitations.

-   CI passes lint, typecheck, unit, integration and security regression
    tests.

-   Documentation explains supported project types, sandbox behaviour
    and limitations.

## 9. Known limitations to disclose

-   Static analysis cannot discover every runtime dependency, reflection
    path or external consumer.

-   Tests only verify behaviour covered by those tests and their
    fixtures.

-   A passing build/test suite is evidence, not proof of safety.

-   Runtime usage monitoring is a future optional capability and
    requires explicit instrumentation and privacy controls.

-   Initial JS/TS support will not understand every framework convention
    or custom build system.
