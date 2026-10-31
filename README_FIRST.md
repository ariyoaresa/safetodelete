SafeToDelete Agent Pack

Start here --- implementation handoff

Product: SafeToDelete \| Version: 1.0 \| Status: Agent implementation
brief

## What this pack contains

  --------------------------------------------------------------------------------
  File                             Give it to              Purpose
  -------------------------------- ----------------------- -----------------------
  01_Product_Requirements.docx     All agents              Defines the product
                                                           problem, users, MVP,
                                                           workflows and
                                                           acceptance criteria.

  02_Technical_Architecture.docx   Tech lead and           Defines stack,
                                   engineering agents      packages, module
                                                           contracts, APIs, data
                                                           model and simulation
                                                           lifecycle.

  03_Agent_Execution_Plan.docx     Orchestrator / lead     Defines agent
                                   agent                   ownership,
                                                           dependencies, shared
                                                           contracts and task
                                                           cards.

  04_Security_QA_Release.docx      All engineering agents; Defines sandbox
                                   especially simulation   security, Git safety,
                                   agent                   tests and release
                                                           gates.
  --------------------------------------------------------------------------------

## Recommended handoff sequence

1.  Give all four documents to the lead/orchestrator agent first.

2.  Ask the lead agent to create the monorepo, establish shared
    contracts and make an implementation checklist.

3.  Only after shared contracts are committed, delegate the agent task
    cards in document 03.

4.  Require each agent to report changed files, tests run, limitations
    and integration notes.

5.  Do not expose hosted execution to untrusted repositories until the
    sandbox requirements in document 04 are implemented and tested.

## Important product decision

The MVP begins with local-first JavaScript/TypeScript analysis and
isolated file/folder deletion simulations. GitHub-hosted workflows and
richer runtime evidence should follow after the local engine and sandbox
are reliable.

## Suggested first instruction to the lead agent

Read all four documents. Do not start by generating the entire
application in one pass. First propose the monorepo scaffold, shared
TypeScript contracts, threat model implementation plan, and milestone
checklist. Identify contradictions or missing decisions before coding.
Then implement Phase 1 with tests and a working CLI vertical slice.
