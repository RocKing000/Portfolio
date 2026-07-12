





## COMPONENT 4
## Testing Automation
## Formal Architecture Document
SDLC Automation Suite
Built on USGE v1.0 Meta-Architecture






## Version Status Date
## 1.0 Draft 2024

SDLC Automation Suite  |  Component 4: Testing Automation
Confidential  |  Architecture Document 2 of 30
## 1. Overview
This document defines the complete formal architecture for Component 4 of the SDLC
Automation Suite: the Testing Automation module. It covers the research layer, five testing
tracks (Unit, Integration, System, Performance, Security), the autonomous random scenario and
fix engine, the iteration loop, and the complete test report produced for handoff to Component 5.

Component 4 is a self-healing code analysis and repair system. It operates entirely at file and
folder level, no server, no deployment environment. Agents generate random scenarios,
execute them against code logic, identify failures, diagnose root causes, apply fixes directly to
files, verify performance impact, and check for regressions. The only human decision in the
entire component is whether to run another iteration.

## Property Value
Underlying Framework USGE v1.0 Meta-Architecture
SDLC Position Component 4 of 5
## Receives From Component 3: Development Automation
Primary Input Complete codebase (all files and folders from Component 3)
Primary Output Tested, repaired codebase + complete test report
## Handoff Target Component 5: Deployment Module
Execution Environment File and folder level only, no server, no deployment
Testing Tracks 5 serial tracks: Unit, Integration, System, Performance, Security
UAT Excluded, handled separately, client-facing
Fix Authority Full, agents fix across all layers: DB, backend, frontend, AI/ML,
integration
Autonomy Fully autonomous, no human required for testing, fixing, or
regression checks
Human Decision Points 2 only: Approval Gate 1 (strategy) and per-iteration Yes/No decision
Iteration Model Random scenarios per iteration, new batch each time, client decides
continuity
Performance Constraint Fixes rejected if they degrade code performance beyond configured
threshold
Security Exception Security fixes exempt from performance threshold, security always
takes priority



SDLC Automation Suite  |  Component 4: Testing Automation
Confidential  |  Architecture Document 3 of 30
## 2. Architectural Principles
Component 4 inherits all principles from Components 1, 2, and 3 and introduces four new
principles specific to autonomous testing.

Principle Source Application in Component 4
Research before
implementation
Component 1 Codebase fully analyzed and baseline established
before any test runs
Data first Component 1 Complete codebase understood before scenario
generation begins
Serial sequencing Component 2 Unit → Integration → System → Performance →
Security, strict order
Client approval gates Component 1 Gate 1 for strategy/thresholds, per-iteration
Yes/No decision
Full audit trail Component 1 Every scenario, fix, performance impact, and
regression logged
Anonymization before LLM Component 1 All code context anonymized before external LLM
calls
Session-scoped memory Component 1 No state persists beyond session end
File-level operation NEW,
## Component 4
Everything at file and folder level, no server, no
deployment
Autonomous fix engine NEW,
## Component 4
No human required for testing or fixing, fully agent-
driven
Random scenario
generation
## NEW,
## Component 4
Random, unexpected scenarios every iteration,
finds what specs miss
Performance-aware fixing NEW,
## Component 4
Every fix measured against baseline, rejected if
threshold exceeded
Iteration continuity decision NEW,
## Component 4
Only human decision: run another iteration Yes/No
after each round



SDLC Automation Suite  |  Component 4: Testing Automation
Confidential  |  Architecture Document 4 of 30
## 3. Core Testing Model

3.1 File-Level Operation
Component 4 operates entirely at the file and folder level. This is the fundamental architectural
constraint that shapes every agent design.

Testing Type File-Level Approach
Unit testing Read function/method code → analyze logic → generate test inputs
→ verify outputs match spec
Integration testing Read multiple module files → trace interface contracts → verify data
shapes match across boundaries
System testing Read complete codebase → trace end-to-end flows through files →
verify journey logic is sound
Performance testing Analyze code complexity, algorithm patterns, query structures →
identify anti-patterns in files
Security testing Scan code files for OWASP vulnerability patterns → identify and fix
in files directly

## 3.2 Autonomous Fix Engine

##  AUTONOMOUS FIX ENGINE
■ Agents fix code directly in files, no human required at any fix step
■ Minimal change principle: smallest possible change to fix the identified issue
■ Fix applied only after passing performance impact check
■ Regression check run after every fix, if regression found, fix is rolled back
■ Up to 3 alternative fix approaches attempted before flagging as unfixed
■ Unfixed issues logged with full detail for human attention, only escalation point









## 3.3 Random Scenario Generation

SDLC Automation Suite  |  Component 4: Testing Automation
Confidential  |  Architecture Document 5 of 30
Random scenarios are the core innovation of Component 4. Every iteration produces a new
batch of scenarios that was not tested in any previous iteration.

## Scenario Category What It Tests
Boundary values Inputs at exact edges of valid ranges, one below, one above
Null and empty inputs Missing data, empty strings, null references, undefined values
Maximum values Largest possible inputs, volume, size, length, depth
Invalid types Wrong data types passed where correct types expected
Unexpected sequences Operations in unexpected order, skipped steps, repeated steps
Concurrent operations Same resource accessed simultaneously from multiple paths
Malformed data Structurally incorrect data, missing fields, wrong nesting, corrupted
values
Cross-module interference Actions in one module affecting state in another unexpectedly
Injection patterns Malicious input patterns, SQL, command, script injection attempts
Resource exhaustion Scenarios designed to stress memory, recursion depth, loop counts

## 3.4 Performance Constraint
## ⚡ PERFORMANCE CONSTRAINT
◆ Before any fix is applied, baseline complexity metrics are measured on the original
file
◆ After fix generation, metrics are measured on the modified file
◆ If degradation exceeds configured threshold: fix rejected, alternative approach
attempted
◆ Up to 3 alternative approaches per issue before flagging as unfixed
◆ Performance track fixes held to stricter threshold, improvement required, not just
neutrality
◆ Security track fixes exempt from performance threshold, security always takes priority
◆ All performance impact data logged in iteration report regardless of accept/reject
decision



## 3.5 Iteration Model
##  ITERATION LOOP
▶ Each iteration generates a completely new batch of random scenarios, no repetition
from previous iterations

SDLC Automation Suite  |  Component 4: Testing Automation
Confidential  |  Architecture Document 6 of 30
▶ Higher iteration numbers produce more complex scenarios, difficulty scales with
iteration count
▶ After each iteration: system displays complete iteration report in GUI
▶ System asks: "Run another iteration for this track? Yes / No", client decides
▶ Yes: new scenario batch generated, different scenarios, same track
▶ No: track complete, next track begins
▶ Client can run as many iterations as desired per track, no maximum enforced



SDLC Automation Suite  |  Component 4: Testing Automation
Confidential  |  Architecture Document 7 of 30
## 4. Research Layer
The Research Layer executes before any testing begins. Four agents run serially to fully
understand the codebase, establish what can be tested, set the baseline, and define the
strategy. No test scenario is generated until research is approved.

RESEARCH LAYER, 4 Agents

## 1. Codebase Analysis Agent
## INPUTS
- All code files from Component 3 package
- All specification documents from Component 3
- Traceability matrix from Component 3
- Folder structure of complete codebase
- Client tech stack from onboarding

## OUTPUTS
- Codebase map: complete file inventory, folder structure, module-to-file mapping, entry points,
exit points
- Code dependency graph: file-level dependencies, function/method call chains, data flow
through files
- Technology inventory: frameworks, libraries, patterns used per layer
- Test surface map: everything testable at file level across all layers

## 2. Testability Analysis Agent
## INPUTS
- Codebase map (from Codebase Analysis)
- Code dependency graph (from Codebase Analysis)
- Technology inventory (from Codebase Analysis)
- Specification documents from Component 3

## OUTPUTS
- Testability map per testing type: unit testable functions/methods, integration testable
interfaces, system testable flows, performance analyzable patterns, security scannable
surfaces
- Test constraints: what cannot be tested at file level and why
- Mock requirements: what needs to be mocked for file-level testing
- Testing priority map: highest risk areas per testing type


## 3. Baseline Metrics Agent
## INPUTS

SDLC Automation Suite  |  Component 4: Testing Automation
Confidential  |  Architecture Document 8 of 30
- Codebase map (from Codebase Analysis)
- All code files
- Client tech stack from onboarding

## OUTPUTS
- Code complexity baseline: cyclomatic and cognitive complexity per function, lines of code per
module
- Algorithm complexity baseline: time and space complexity per significant algorithm
- Query complexity baseline: database query complexity scores per query in codebase
- Code quality baseline: duplication percentage, coupling metrics, cohesion metrics
- Security surface baseline: known vulnerability patterns present before any fixes

## 4. Test Strategy Agent
## INPUTS
- Testability map (from Testability Analysis)
- Baseline metrics (from Baseline Metrics)
- Testing priority map (from Testability Analysis)
- Traceability matrix from Component 3
- Requirements package from Component 1

## OUTPUTS
- Per track strategy: which functions/interfaces/flows/hotspots/surfaces to prioritize per testing
type
- Random scenario parameters per track: scenario types, edge case categories, boundary
conditions, complexity ranges
- Performance thresholds: maximum acceptable degradation per fix type, complexity, query,
code quality
- Research summary: complete picture for Approval Gate 1

## ⚠ CLIENT INVOLVEMENT REQUIRED
● APPROVAL GATE 1: Client reviews complete testing strategy before any test runs
● Client confirms performance thresholds: maximum acceptable degradation per fix
(e.g. max 5% complexity increase)
● Client confirms iteration approach: system will ask after each iteration per track
● Client approves testing priority map: what gets tested first in each track
● Rejection at Gate 1 triggers targeted research agent re-runs with corrections applied



SDLC Automation Suite  |  Component 4: Testing Automation
Confidential  |  Architecture Document 9 of 30
## 5. Core Loop Agents
Seven agents form the core testing loop. They are reused across all five testing tracks with
different parameters per track. Every iteration of every track runs through all seven agents in
sequence.

CORE LOOP, 7 Agents (Reused Across All Tracks)

## 1. Random Scenario Generator Agent
## INPUTS
- Track type: unit/integration/system/performance/security
- Test strategy for this track (from Test Strategy Agent)
- Testability map for this track
- Codebase map (relevant sections)
- Previous iteration scenarios (to avoid repetition)
- Iteration number (higher = more complex scenarios)

## OUTPUTS
- Scenario batch for this iteration: per scenario, ID, type, description, target file/function, input
conditions, edge case category, expected behavior from spec, risk level
- Scenario batch summary: total scenarios, areas covered, estimated complexity
- Scenarios ranked by risk level: highest risk executed first

## 2. Test Execution Agent
## INPUTS
- Scenario batch (from Random Scenario Generator)
- Target code files (from codebase map)
- Specification documents (expected behavior)
- Mock definitions (from testability map)
- Track type

## OUTPUTS
- Execution results per scenario: scenario ID, result Pass/Fail, if Pass, behavior matches spec,
if Fail, actual vs expected deviation, affected files, failure category
(logic/data/interface/missing case/performance/security)
- Execution summary: total run, passed, failed
- Failed scenarios ranked by severity



## 3. Failure Analysis Agent
## INPUTS

SDLC Automation Suite  |  Component 4: Testing Automation
Confidential  |  Architecture Document 10 of 30
- Failed scenarios (from Test Execution)
- Affected files (from Test Execution)
- Code dependency graph (from Codebase Analysis)
- Specification documents
- Codebase map

## OUTPUTS
- Root cause analysis per failure: root cause file, root cause location, root cause type (null
check/boundary/type/error handling/logic/interface/security/performance), cascading effects,
fix complexity, fix approach recommendation
- Cross-module failure map: failures spanning multiple layers grouped together
- Fix priority order: which fixes to attempt first based on dependency and severity


## 4. Fix Generation Agent
## INPUTS
- Root cause analysis (from Failure Analysis)
- Fix priority order (from Failure Analysis)
- Target code files (exact files to modify)
- Specification documents (correct behavior)
- Baseline metrics (performance reference)
- Client tech stack from onboarding

## OUTPUTS
- Fix specification per fix: target file, location, what changes, why, minimal change principle
applied
- Modified code file: file with fix applied
- Fix diff: exactly what changed line by line
- Fix log entry: scenario ID, file, change, timestamp











## 5. Performance Impact Agent

## INPUTS
- Modified code file (from Fix Generation)

SDLC Automation Suite  |  Component 4: Testing Automation
Confidential  |  Architecture Document 11 of 30
- Original code file (pre-fix)
- Baseline metrics (from Baseline Metrics Agent)
- Performance thresholds (from Test Strategy)
- Fix specification (from Fix Generation)

## OUTPUTS
- Performance comparison per fix: complexity before/after, change percentage, within threshold
Yes/No, decision Apply/Reject
- If rejected: rejection reason, degradation amount, signal to Fix Generation for alternative
approach (up to 3 alternatives)
- If applied: fix permanently written to file
- Performance impact log: every fix with performance delta recorded

## ⚡ PERFORMANCE CONSTRAINT
◆ Security track fixes are exempt from performance threshold rejection, security always
takes priority
◆ Performance track fixes held to stricter threshold, improvement required, not just
neutrality
◆ All other tracks: fix rejected if degradation exceeds client-configured threshold
◆ After rejection, Fix Generation Agent tries alternative approach, up to 3 attempts
◆ If all 3 alternatives rejected: issue flagged as UNFIXED in iteration report

## 6. Regression Check Agent
## INPUTS
- Modified file (after fix applied)
- Fix diff (from Fix Generation)
- Code dependency graph (from Codebase Analysis)
- All dependent files (from dependency graph)
- Previous passing scenarios from this iteration

## OUTPUTS
- Regression scan results: dependent files checked, regressions found Yes/No, if Yes, affected
file, nature, severity
- If regression found: fix rolled back, regression added to failure list, Fix Generation retries with
regression-aware constraints
- Regression log: every regression check result recorded

## 7. Iteration Report Agent
## INPUTS
- Scenario batch (from Random Scenario Generator)
- Execution results (from Test Execution)
- Root cause analyses (from Failure Analysis)

SDLC Automation Suite  |  Component 4: Testing Automation
Confidential  |  Architecture Document 12 of 30
- Fix specifications and diffs (from Fix Generation)
- Performance impact log (from Performance Impact)
- Regression scan results (from Regression Check)
- Track type and iteration number

## OUTPUTS
- Iteration Report: header (track, iteration number, timestamp, duration), summary (scenarios
generated/passed/failed, fixes attempted/applied/rejected/regressions caught, net code
quality change), full scenario breakdown per scenario (ID, target, result, root cause if failed, fix
applied, file modified, performance impact, regression result), files modified this iteration with
diffs available, performance impact summary, unfixed issues log with full detail for human
attention, recommendation (another iteration Yes/No with rationale)
- System presents report in GUI then asks: "Run another iteration for this track? Yes / No"

## ⚠ CLIENT INVOLVEMENT REQUIRED
● ONLY HUMAN DECISION IN TESTING LOOP: "Run another iteration for this track?
## Yes / No"
● System displays complete iteration report before asking, client sees everything that
happened
● Yes: Random Scenario Generator runs new batch, no scenarios repeated from
previous iterations
● No: this track is complete, next track begins automatically
● Unfixed issues flagged in report require human attention, client notified prominently



SDLC Automation Suite  |  Component 4: Testing Automation
Confidential  |  Architecture Document 13 of 30
## 6. Unit Testing Track
First testing track. Tests individual functions, methods, and classes in isolation. Smallest and
most numerous tests, highest coverage of individual code units.

## UNIT TESTING TRACK

## Unit Track Property Definition
Scope Individual functions, methods, and classes tested in isolation
Target files Backend service/repository files, frontend component logic, AI/ML
pipeline functions, integration adapters
Scenario focus Boundary values, null/empty inputs, maximum values, invalid types,
exception paths, state mutation edges
Fix scope Function/method logic errors, missing input validation, incorrect
return values, unhandled exceptions, wrong boundary conditions
Mocking All dependencies mocked, unit tests test one unit only, nothing else
Pass criteria Function returns expected output per specification for given input
Fail criteria Unexpected output, unhandled exception, wrong return type, missing
validation
## 6.1 Unit Track, Random Scenario Examples
## Scenario Type Example What It Tests
Boundary value Call function with value exactly at
maximum allowed input
Off-by-one errors at boundaries
Null input Pass null where object expected Null reference handling
Empty collection Pass empty array where items
expected
Empty state handling
Maximum depth Nested object at maximum allowed
depth
Recursion and depth limits
Wrong type Pass string where integer expected Type validation and coercion
Duplicate call Call same function twice with same
input
Idempotency and state mutation
Concurrent call Simulate same function called
simultaneously
Thread safety in code logic
Missing required field Object with required field absent Validation completeness

## 6.2 Unit Track Flow

SDLC Automation Suite  |  Component 4: Testing Automation
Confidential  |  Architecture Document 14 of 30
- Research output (strategy + baseline) feeds Unit Track initialization
- Random Scenario Generator produces unit-focused batch, boundary, null, type,
exception scenarios
- Test Execution Agent analyzes each function/method against scenario inputs
- Failure Analysis Agent traces failures to exact function and line area
- Fix Generation Agent modifies specific function, minimal change principle
- Performance Impact Agent checks function complexity before and after
- Regression Check Agent verifies dependent functions still pass
- Iteration Report compiled and presented, client decides next iteration



SDLC Automation Suite  |  Component 4: Testing Automation
Confidential  |  Architecture Document 15 of 30
## 7. Integration Testing Track
Second testing track. Tests interfaces between modules. Verifies that data contracts defined in
specifications are honored in actual code. Finds mismatches that unit tests cannot see.

## INTEGRATION TESTING TRACK

## Integration Track Property Definition
Scope Interfaces between modules, data flows across module boundaries
Target interfaces Backend-to-database, frontend-to-backend API, backend-to-AI/ML,
backend-to-integration layer
Scenario focus Data contract violations, unexpected data shapes, missing fields,
type mismatches, error propagation, sequence violations
Fix scope Interface contract mismatches in code, data mapping errors, missing
error handling at boundaries, incorrect data transformation, missing
field handling
Mocking One side of each interface mocked to isolate the boundary being
tested
Pass criteria Data passes correctly across boundary matching contract
specification
Fail criteria Data shape mismatch, missing field propagation, error not correctly
surfaced across boundary

## 7.1 Integration Track, Random Scenario Examples
## Scenario Type Example What It Tests
Missing field Backend returns object missing field
frontend expects
Data contract completeness
Type mismatch Backend returns integer where
frontend expects string
Type contract at boundary
Null propagation Null field propagated across
boundary without handling
Null contract at interface
Error format Backend error response in
unexpected format
Error contract compliance
Extra fields Response with unexpected
additional fields
Tolerance to extra data
Wrong sequence Frontend calls endpoint before
prerequisite endpoint
Sequence dependency handling
Large payload Payload at maximum size across
boundary
Size handling at interface

SDLC Automation Suite  |  Component 4: Testing Automation
Confidential  |  Architecture Document 16 of 30
Empty response Empty array or null body where data
expected
Empty state at boundary



SDLC Automation Suite  |  Component 4: Testing Automation
Confidential  |  Architecture Document 17 of 30
## 8. System Testing Track
Third testing track. Tests complete end-to-end flows through the codebase. Traces entire user
journeys from entry point through all layers to output. Finds issues that unit and integration tests
cannot see because they test parts, system testing tests the whole.

## SYSTEM TESTING TRACK

## System Track Property Definition
Scope Complete end-to-end flows spanning all layers simultaneously
Target flows Full user journeys traced through frontend files → backend files →
database files → integration files
Scenario focus Unexpected journey sequences, concurrent operation scenarios,
partial completion (flow interrupted midway), invalid state transitions,
cross-feature interference, data consistency
Fix scope Flow logic errors spanning multiple files, state management across
layers, data consistency violations, missing flow control, cross-
module coordination errors
Mocking Minimal mocking, system tests trace real code paths across all files
Pass criteria Complete journey produces correct output per specification across
all layers
Fail criteria Journey breaks at any point, incorrect final state, inconsistent data
across layers

## 8.1 System Track, Random Scenario Examples
## Scenario Type Example What It Tests
Interrupted flow User journey that stops halfway
through multi-step process
Partial completion state handling
Repeated action Same action performed twice in
same journey
Idempotency across full flow
Concurrent journeys Two journeys accessing same
resource simultaneously
Cross-journey state isolation
Invalid transition Jump to step 3 without completing
step 2
State transition enforcement
Cross-feature action Action in feature A that affects state
in feature B
Feature isolation
Maximum journey length Longest possible sequence of valid
steps
Flow depth and state management

SDLC Automation Suite  |  Component 4: Testing Automation
Confidential  |  Architecture Document 18 of 30
Reverse journey Steps performed in reverse of
normal order
Order dependency handling
Data consistency check Verify same data readable
consistently across all layers after
journey
Cross-layer consistency



SDLC Automation Suite  |  Component 4: Testing Automation
Confidential  |  Architecture Document 19 of 30
## 9. Performance Testing Track
Fourth testing track. Identifies and fixes performance issues at code level. No live execution, all
analysis done on code structure, algorithm complexity, and query patterns in files.

## PERFORMANCE TESTING TRACK

## Performance Track Property Definition
Scope Algorithm complexity, data structure efficiency, query optimization,
code anti-patterns
Target patterns Nested loops, N+1 query patterns, unnecessary computation,
missing pagination, inefficient algorithms, memory allocation anti-
patterns
Scenario focus Large data volume scenarios, nested loop detection, N+1 queries,
recursion depth, memory patterns, algorithm hotspots
Fix scope Algorithm optimization, query optimization in SQL files, data structure
replacement, unnecessary computation removal, caching
implementation, pagination addition
Threshold rule Performance track fixes must improve or maintain complexity,
degradation never acceptable here
Pass criteria Code complexity within acceptable bounds for expected data
volumes
Fail criteria Algorithm with excessive complexity for data volume, N+1 query
pattern, missing optimization for identified hotspot


## ⚡ PERFORMANCE CONSTRAINT
◆ Performance track is the only track where every fix must demonstrably improve
complexity metrics
◆ Fixes that maintain current complexity but do not improve it are flagged as sub-
optimal but accepted
◆ Fixes that degrade complexity are always rejected regardless of iteration count
◆ This track has the strictest performance threshold of all five tracks






## 9.1 Performance Track, Random Scenario Examples

SDLC Automation Suite  |  Component 4: Testing Automation
Confidential  |  Architecture Document 20 of 30
## Scenario Type Example What It Checks
Large volume Function processing 1 million
records, complexity check
Algorithm scalability
Nested loops O(n²) or worse loop detected in code Algorithm efficiency
N+1 query Query inside loop pattern in
repository code
Database access efficiency
Missing index use Query on non-indexed column in
large table
Query optimization
Missing pagination Query returning all records without
limit
Resource consumption
Deep recursion Recursive function without depth
limit
Stack overflow risk
Repeated computation Same calculation performed multiple
times in loop
Computation efficiency
Large object creation Object instantiation inside loop that
could be outside
Memory allocation pattern



SDLC Automation Suite  |  Component 4: Testing Automation
Confidential  |  Architecture Document 21 of 30
## 10. Security Testing Track
Fifth and final testing track. Scans code files for security vulnerabilities based on OWASP
patterns and common vulnerability categories. Fixes applied directly in files. Security fixes are
exempt from performance threshold, security always takes priority.

## SECURITY TESTING TRACK

## Security Track Property Definition
Scope OWASP vulnerability patterns, injection risks, authentication gaps,
authorization issues, data exposure
Target patterns SQL injection, command injection, XSS, CSRF, insecure
deserialization, missing auth checks, hardcoded secrets, insecure
direct object references, security misconfigurations
Scenario focus Injection patterns, auth bypass, authorization gaps, sensitive data
exposure, missing sanitization, hardcoded credentials, IDOR
patterns
Fix scope Input sanitization, parameterized queries, auth check addition,
sensitive data masking, secret removal and config reference, output
encoding, security headers
Performance rule Security fixes EXEMPT from performance threshold, security takes
absolute priority
Pass criteria No known vulnerability patterns present in code for this scenario type
Fail criteria Known vulnerability pattern detected in code, any severity level
triggers fix attempt

##  SECURITY PRIORITY
★ Security fixes are never rejected due to performance threshold, security takes
absolute priority
★ Performance impact is still measured and logged for every security fix
★ If a security fix causes significant performance degradation it is flagged in report but
still applied
★ Security track runs last, benefits from all performance optimizations made in Track 4



## 10.1 Security Track, Random Scenario Examples
## Scenario Type Example Vulnerability Checked

SDLC Automation Suite  |  Component 4: Testing Automation
Confidential  |  Architecture Document 22 of 30
SQL injection User input directly concatenated into
SQL query string
SQL injection vulnerability
Missing parameterization Dynamic query built with string
interpolation
Query injection risk
Missing auth check Endpoint accessible without
authentication verification
Authentication bypass
Missing authorization Resource accessible without
role/permission check
Authorization gap
Hardcoded secret API key or password literal in code
file
Credential exposure
Sensitive data logging Password or token logged in log
statement
Sensitive data exposure
Missing input sanitization User input used in output without
encoding
XSS vulnerability
Insecure direct reference Object accessed by user-provided
ID without ownership check
IDOR vulnerability
Missing CSRF protection State-changing endpoint without
CSRF token verification
CSRF vulnerability
Insecure deserialization Untrusted data deserialized without
validation
Deserialization vulnerability



SDLC Automation Suite  |  Component 4: Testing Automation
Confidential  |  Architecture Document 23 of 30
## 11. Final Report Agent
After all five tracks complete, the Final Report Agent consolidates everything into a single
comprehensive test report for client approval before handoff to Component 5.

## FINAL REPORT AGENT

## Final Report Agent
## INPUTS
- All iteration reports from all tracks (Unit, Integration, System, Performance, Security)
- Baseline metrics (from Baseline Metrics Agent)
- All fixed files (current state of complete codebase)
- All unfixed issues logs from all tracks
- Traceability matrix from Component 3

## OUTPUTS
- Consolidated test report: executive summary, per-track summary (iterations run, scenarios
total, pass/fail/fixed rates, net quality improvement), complete scenario index across all tracks,
all files modified with diffs, performance baseline vs final comparison, unfixed issues register
(all issues that could not be fixed, with full detail for human resolution), security posture
assessment (vulnerabilities found and fixed, remaining if any), requirements coverage
(traceability matrix confirming which requirements were tested and passed), overall system
quality assessment
- Tested and repaired codebase: all files in final state after all fixes applied
- Test evidence package: all iteration reports, all diffs, all logs

## ⚠ CLIENT INVOLVEMENT REQUIRED
● APPROVAL GATE 2: Client reviews complete final test report before handoff to
## Component 5
● Client reviews unfixed issues register, decides whether to resolve manually before
deployment
● Client reviews security posture assessment, confirms acceptable security level
● Client reviews requirements coverage, confirms testing adequately covered all
requirements
● Approval triggers dispatch of tested codebase and test report to Component 5
● Rejection: client requests additional iterations on specific tracks before re-approval



SDLC Automation Suite  |  Component 4: Testing Automation
Confidential  |  Architecture Document 24 of 30
## 12. Unfixed Issues Handling
When an agent cannot fix an issue without exceeding the performance threshold or causing a
regression, the issue is flagged as UNFIXED. These are the only issues that require human
attention.

## Unfixed Issue Property Detail
Trigger condition 1 Fix rejected by performance threshold AND all 3 alternative
approaches also rejected
Trigger condition 2 Fix causes regression that cannot be resolved by any alternative
approach
What is recorded Root cause file and location, failure scenario description, all 3 fix
attempts with why each failed, performance impact of each attempt,
regression details if applicable
Where it appears Prominently flagged in iteration report and in final consolidated report
Human action required Developer manually reviews and fixes the issue in the file
Re-entry into testing After manual fix: issue re-enters testing in next iteration if client runs
one
Deployment decision Client decides at Gate 2 whether unfixed issues are acceptable for
deployment



SDLC Automation Suite  |  Component 4: Testing Automation
Confidential  |  Architecture Document 25 of 30
## 13. Complete Component 4 Flow

## Stage Agents Human Decision Output
## Research Codebase Analysis → Testability
## Analysis → Baseline Metrics → Test
## Strategy
Gate 1: approve
strategy and
thresholds
Codebase map,
baseline, test
strategy
## Unit Track Iter
## 1
## Random Generator → Execution →
## Failure Analysis → Fix Generation →
## Performance Impact → Regression
## Check → Iteration Report
Yes/No: another
unit iteration?
Fixed code files +
iteration report
## Unit Track Iter
## N
Same loop, new random scenarios Yes/No: another
unit iteration?
Cumulative fixes +
reports
## Integration
## Track
Same 7-agent loop, integration
parameters
Yes/No per
iteration
Interface fixes +
reports
System Track Same 7-agent loop, system
parameters
Yes/No per
iteration
Flow fixes + reports
## Performance
## Track
Same 7-agent loop, performance
parameters
Yes/No per
iteration
Optimized code +
reports
Security Track Same 7-agent loop, security
parameters
Yes/No per
iteration
Secured code +
reports
Final Report Final Report Agent consolidates all
tracks
Gate 2: approve
final report
Complete test report
+ tested codebase
Handoff Dispatch via RabbitMQ Triggered by Gate
2 approval
Tested codebase →
## Component 5



SDLC Automation Suite  |  Component 4: Testing Automation
Confidential  |  Architecture Document 26 of 30
## 14. Data Flow

## From To What
Component 3 via RabbitMQ Codebase Analysis Agent Complete codebase: all code files,
spec documents, traceability matrix
## Codebase Analysis Testability Analysis + Baseline
## Metrics
Codebase map, dependency graph,
technology inventory
## Testability Analysis +
## Baseline
Test Strategy Agent Testability map, baseline metrics,
test constraints
Test Strategy Agent Translation Agent (Gate 1) Research summary, performance
thresholds, testing priority map
Client (Gate 1) All track initializations Approved strategy, confirmed
thresholds, approved priorities
Random Scenario Generator Test Execution Agent Scenario batch ranked by risk level
Test Execution Agent Failure Analysis Agent Failed scenarios with affected files
and failure categories
Failure Analysis Agent Fix Generation Agent Root cause analysis, fix priority order
Fix Generation Agent Performance Impact Agent Modified file, fix diff, fix specification
Performance Impact Agent File system OR Fix Generation
## (retry)
Fix applied to file OR rejection signal
for alternative
Performance Impact Agent Regression Check Agent Applied fix details, modified file
Regression Check Agent File system OR Fix Generation
## (rollback)
Fix confirmed OR fix rolled back with
regression details
All loop agents Iteration Report Agent All scenario results, fix details,
performance deltas, regression
results
Iteration Report Agent GUI (client) Complete iteration report displayed
before Yes/No decision
All track iteration reports Final Report Agent Complete test history across all
tracks and iterations
Final Report Agent Translation Agent (Gate 2) Consolidated report in client-
appropriate language
Client (Gate 2) RabbitMQ dispatch Approval triggers handoff to
## Component 5
RabbitMQ Component 5 Tested codebase + complete test
evidence package

SDLC Automation Suite  |  Component 4: Testing Automation
Confidential  |  Architecture Document 27 of 30
- USGE v1.0 Framework Mapping

USGE Component Component 4 Implementation
State Space (Sigma) Current codebase quality state, evolves from initial untested state to
tested and repaired state
Valid States (V_Sigma) Codebase states where all applied fixes pass performance threshold
and regression checks
SafeMode Fix rolled back, codebase returned to last known valid state before
problematic fix
Input Space (R) Complete codebase from Component 3 + random scenario batches
per iteration
Output Space (O) Fix actions: modify file, rollback file, flag unfixed, approve fix
Context Space (C) Current track, current iteration, baseline metrics, dependency graph,
previous scenarios
Intent (I) Fully tested, secure, performant codebase with all discoverable
issues resolved
Constraints (K) Performance thresholds, regression prohibition, minimal change
principle, no repetition of scenarios
Policy (Pi) Agent decision logic: how to generate scenarios, analyze failures,
generate fixes, assess impact
Measurement (M) Net code quality change per iteration: scenarios fixed vs unfixed,
complexity delta, security posture
Represent function Codebase Analysis Agent: maps complete codebase to structured,
analyzable representation
Layer 1 Safety Performance Impact Agent: rejects fixes that violate threshold,
constraint filtering
Layer 2 Safety Policy Consistency: fix agents always produce valid code transitions
Layer 3 Safety Regression Check Agent: validates every fix before it is permanently
applied
Layer 4 Safety SafeMode = rollback: fix reverted, codebase stays in last valid state



SDLC Automation Suite  |  Component 4: Testing Automation
Confidential  |  Architecture Document 28 of 30
## 16. Technical Stack

Layer Technology Role in Component 4
Frontend Angular GUI: iteration reports, scenario breakdowns,
fix diffs, Yes/No iteration decision, unfixed
issues view, final report
API Gateway Ocelot (.NET) Single entry point, auth, routing
Backend .NET Orchestration, track sequencing, iteration
management, report assembly, approval
workflows
Database Access ADO.NET / Dapper Raw SQL, iteration records, scenario logs,
fix logs, audit trail
Database SQL Server Iteration history, scenario results, fix
records, performance deltas, regression
logs
AI / Agents Python + LangGraph All 7 core loop agents + 4 research agents
+ final report agent
Code Analysis Python (AST, static analysis
libraries)
Codebase parsing, complexity analysis,
vulnerability pattern scanning
LLM Providers OpenAI / Anthropic / Google /
## Mistral
Scenario generation, failure analysis, fix
generation, online only
Message Queue RabbitMQ Component 3 → 4 handoff, agent
communication, Component 4 → 5 handoff
Agent-Backend
## Comms
gRPC + RabbitMQ Synchronous and asynchronous .NET to
Python bridge
Session / Cache Redis Session state, iteration context, scenario
history (prevents repetition), current
codebase state
File System Access Python (direct file I/O) Agents read and write code files directly, no
server intermediary
Document Storage MinIO Iteration reports, fix diffs, final test report,
test evidence package
## Authentication Active Directory + Identity
## Server
Client authentication for approval gates and
iteration decisions
Logging / Audit ELK Stack Every scenario, fix, performance
measurement, regression check logged
Monitoring Prometheus + Grafana System health, agent performance, iteration
progress, track completion status


SDLC Automation Suite  |  Component 4: Testing Automation
Confidential  |  Architecture Document 29 of 30
- Handoff to Component 5

## 17.1 Component 4 Package Contents
- Tested and repaired codebase: all code files in final state after all fixes applied across all
tracks
- Final consolidated test report: executive summary, per-track results, all iterations, net
quality improvement
- Complete iteration history: every iteration report from every track with full scenario
breakdowns
- Fix evidence: every fix applied with before/after diff, performance impact, regression
check result
- Unfixed issues register: all issues that could not be fixed with full detail for human
resolution
- Security posture assessment: all vulnerabilities found, fixed, and remaining
- Performance baseline vs final comparison: net complexity improvement across all
optimizations
- Requirements coverage report: traceability matrix confirming what was tested and
passed
- Audit trail: complete record of every scenario, fix, decision, and approval across all
iterations

## 17.2 Handoff Properties
- Handoff via RabbitMQ, no direct coupling between Component 4 and Component 5
- Component 4 package schema-validated before dispatch
- Component 5 acknowledges receipt before Component 4 session closes
- All test evidence stored in MinIO, accessible to deployment team throughout Component
## 5
- Unfixed issues register passed to Component 5 with prominence, deployment team
aware of outstanding issues

## ⚠ CLIENT INVOLVEMENT REQUIRED
● Client must provide explicit final sign-off at Approval Gate 2 before handoff to
## Component 5
● Client reviews unfixed issues register and decides whether to resolve before
deployment
● Client reviews security posture, must be acceptable before deployment proceeds
● Client notified when handoff complete and Component 5 has acknowledged receipt


SDLC Automation Suite  |  Component 4: Testing Automation
Confidential  |  Architecture Document 30 of 30
## Appendix: Complete Agent Summary

## Layer / Track Agent Primary Output
Research Codebase Analysis Agent Codebase map, dependency graph, test
surface map
Research Testability Analysis Agent Testability map per track, test
constraints, mock requirements
Research Baseline Metrics Agent Complexity, algorithm, query, quality,
and security baselines
Research Test Strategy Agent Per-track strategy, scenario parameters,
performance thresholds
## Core Loop Random Scenario Generator
## Agent
Scenario batch ranked by risk, new
unique scenarios per iteration
Core Loop Test Execution Agent Pass/fail results per scenario with failure
categories
Core Loop Failure Analysis Agent Root cause per failure, fix priority order,
cross-module map
Core Loop Fix Generation Agent Fixed code file, fix diff, fix log entry
Core Loop Performance Impact Agent Apply/reject decision with performance
delta per fix
Core Loop Regression Check Agent Regression confirmation or rollback with
details
Core Loop Iteration Report Agent Complete iteration report, everything
that happened this iteration
Unit Track Core loop with unit parameters Unit-level fixes across backend,
frontend, AI/ML, integration files
Integration Track Core loop with integration
parameters
Interface contract fixes across all
module boundaries
System Track Core loop with system
parameters
End-to-end flow fixes spanning all layers
Performance Track Core loop with performance
parameters
Algorithm and query optimizations
across all code files
Security Track Core loop with security
parameters
Vulnerability fixes across all code files,
security priority
Final Final Report Agent Consolidated test report + tested
codebase package for Component 5

## End of Suite. Component 4 is the final component in the current scope of the SDLC Automation Suite. Component 5 (Deployment Automation) is defined as future scope.