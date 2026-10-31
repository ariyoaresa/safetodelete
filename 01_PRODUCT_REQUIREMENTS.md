SafeToDelete

Product Requirements Document (PRD)

Product: SafeToDelete \| Version: 1.0 \| Status: Agent implementation
brief

## 1. Product summary

SafeToDelete is a developer tool that helps engineers evaluate the
consequences of removing code before merging a deletion. It combines
static code analysis, dependency and reference mapping, isolated
deletion simulations, and automated verification to produce an
evidence-based risk report.

Core promise: Know what breaks before you delete it.

## 2. Problem statement

Developers regularly inherit or maintain codebases containing apparently
unused files, functions, components, routes, packages, and
configuration. Simple text search or dead-code detection cannot reliably
prove that removal is safe. Dynamic imports, framework conventions,
reflection, runtime-only paths, external consumers, generated code, and
incomplete tests can hide dependencies.

## 3. Product principles

-   Evidence over confidence theatre: never claim a deletion is safe
    merely because no references were found.

-   Simulation is non-destructive: the original working tree and branch
    must remain unchanged.

-   Explain uncertainty: distinguish confirmed breakage, observed usage,
    static references, and unverified possibilities.

-   AI explains evidence; deterministic tooling gathers it and decides
    test outcomes.

-   Secure by default: repository code is untrusted and must execute in
    a constrained sandbox.

-   Incremental value: a developer should get useful results from a
    local CLI before connecting a hosted dashboard.

## 4. Target users

  -----------------------------------------------------------------------
  Persona                 Need                    Primary value
  ----------------------- ----------------------- -----------------------
  Maintainer of a mature  Remove legacy code      Impact map and deletion
  codebase                without regressions     simulation

  Frontend/full-stack     Understand component,   JS/TS-aware analysis
  developer               route and package       
                          dependencies            

  Engineering team lead   Review risky cleanup    Shareable evidence
                          PRs                     report

  Developer joining an    Understand what depends Dependency and usage
  unfamiliar project      on a module             exploration
  -----------------------------------------------------------------------

## 5. MVP scope

  -----------------------------------------------------------------------
  Capability              MVP behaviour           Priority
  ----------------------- ----------------------- -----------------------
  Repository intake       Analyze a local Git     P0
                          repository; support a   
                          GitHub repository       
                          integration later in    
                          MVP                     

  Language support        JavaScript and          P0
                          TypeScript, including   
                          common TS/JS module     
                          patterns                

  Static analysis         Discover files,         P0
                          imports, exports,       
                          references, package     
                          dependencies and basic  
                          route/component         
                          references              

  Candidate selection     Select files or folders P0/P1
                          for proposed removal;   
                          function-level deletion 
                          is a later increment    

  Isolated simulation     Create a temporary Git  P0
                          worktree, apply         
                          deletion there, never   
                          modify the source       
                          checkout                

  Verification            Run configured          P0
                          install/build/test      
                          commands with timeouts  
                          and resource limits     

  Risk report             Show findings, test     P0
                          outcomes, affected      
                          dependants and unknowns 

  AI explanation          Optional plain-language P1
                          summary based only on   
                          collected evidence      

  Hosted teams/billing    Not part of initial MVP Later
  -----------------------------------------------------------------------

## 6. Explicit non-goals for MVP

-   Do not promise formal proof that deletion cannot break any runtime
    behaviour.

-   Do not automatically merge, commit, push, or deploy a deletion.

-   Do not execute repository scripts on the API server.

-   Do not support every programming language in the first release.

-   Do not automatically delete code based solely on AI recommendations.

-   Do not attempt complete production traffic tracing in the first MVP.

## 7. Primary user journey

1.  Developer runs the CLI in a Git repository or opens a repository in
    the dashboard.

2.  SafeToDelete detects the project type, package manager, scripts and
    supported source files.

3.  The analyzer creates a baseline inventory and dependency graph.

4.  Developer selects one or more files/folders as a deletion proposal.

5.  SafeToDelete creates an isolated worktree from the selected base
    commit and removes the selected paths only in that worktree.

6.  The verification runner executes configured checks in a sandbox.

7.  The risk engine combines static impact and observed verification
    outcomes.

8.  Developer reviews the report and decides whether to make the change
    manually.

## 8. Report requirements

-   Show the exact commit SHA and repository state analyzed.

-   List deletion targets and their detected dependants/references.

-   Separate static findings from test/build outcomes.

-   Show commands executed, exit codes, durations and truncated logs.

-   Flag skipped checks, unsupported patterns and incomplete analysis.

-   Provide a risk category (Low / Medium / High / Inconclusive) with an
    explanation; avoid false precision.

-   Include a clear disclaimer that passing checks do not prove absence
    of all runtime dependencies.

## 9. MVP acceptance criteria

-   A user can run a documented CLI command against a supported JS/TS
    repository.

-   The scanner inventories supported files and extracts static
    import/export relationships.

-   The user can request a simulation for one or more files.

-   The simulation runs in a separate worktree and leaves the original
    branch, index and working files unchanged.

-   The runner executes configured build/test commands with hard
    timeouts and captures results.

-   The report identifies direct static dependants and failed checks.

-   The report marks missing tests, unsupported patterns and unobserved
    runtime behaviour as uncertainty.

-   Automated tests cover path traversal, cleanup on failure, dirty
    working trees, timeout handling and sandbox boundaries.

## 10. Product success metrics

-   Time from selecting a deletion target to receiving a report.

-   Percentage of simulations that complete successfully.

-   Percentage of reports containing actionable dependency or test
    evidence.

-   False reassurance incidents (target: zero known cases).

-   Repeat usage by developers and repositories analyzed.

## 11. Product terminology

  -----------------------------------------------------------------------
  Term                                Definition
  ----------------------------------- -----------------------------------
  Deletion proposal                   A set of files or code elements the
                                      developer wants to evaluate for
                                      removal.

  Baseline                            The original commit/worktree used
                                      as the comparison point.

  Simulation                          An isolated copy with the proposed
                                      deletion applied.

  Static dependency                   A relationship found by source
                                      parsing or project metadata.

  Observed usage                      Usage recorded by a separately
                                      configured runtime instrumentation
                                      source; not assumed in MVP.

  Unknown                             A possible dependency or behaviour
                                      the tool cannot reliably verify.
  -----------------------------------------------------------------------
