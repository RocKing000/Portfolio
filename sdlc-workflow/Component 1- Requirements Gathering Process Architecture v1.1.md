





## COMPONENT 1
## Requirements Gathering
## Formal Architecture Document
SDLC Automation Suite
Built on USGE v1.0 Meta-Architecture






## Version Status Date
## 1.0 Draft 2024

SDLC Automation Suite  |  Component 1: Requirements Gathering
Confidential  |  Architecture Document 2 of 23
## 1. Overview
This document defines the complete formal architecture for Component 1 of the SDLC
Automation Suite: the Requirements Gathering module. It covers agent hierarchy, data flows,
client involvement points, technical stack, operating modes, and all supporting services.

The Requirements Gathering module is the first and foundational component of the SDLC
Automation Suite. Its purpose is to take raw client data and an expected outcome and produce
a fully validated, structured requirements package ready for handoff to the Design module.

## Property Value
Underlying Framework USGE v1.0 Meta-Architecture
SDLC Position Component 1 of 5
Input Sources Excel files, External Database
Primary Input Raw client data + Expected outcome
Primary Output Validated requirements package
## Handoff Target Component 2: Design Module
Operating Model Iterative (client-approved cycles)
Data Priority Data-first: data understood before structure mapping
LLM Approach Online only (provider chosen by client)



SDLC Automation Suite  |  Component 1: Requirements Gathering
Confidential  |  Architecture Document 3 of 23
## 2. Architectural Principles
Every design decision in this module is governed by the following core principles:

## Principle What It Means Where It Applies
Data First Fully understand data before
mapping to structure
Research layer always precedes
implementation
Research Before Action Every agent studies and plans
before executing
Universal, no exceptions
Loose Coupling Modules communicate only via
API contracts and message
queues
All inter-agent and inter-module
communication
Centralized Management Single management plane for all
modules
Config, auth, health, audit
Session-Scoped Memory No data persists beyond session
end
Translation layer, mapping
registry
Data Anonymization Client data never sent raw to
external LLM APIs
Every LLM call
Client Governs Data Any decision touching client data
requires client approval
All critical decision points
Standalone Product Module functions independently of
other SDLC components
Architecture and deployment
Modular Design Every sub-component replaceable
without system disruption
Agent implementations, services



SDLC Automation Suite  |  Component 1: Requirements Gathering
Confidential  |  Architecture Document 4 of 23
## 3. Operating Modes
The system supports two operating modes, configured at client onboarding and adjustable per
project or per SDLC component.

Human in the Loop (HITL) Full Automation
- Plan available for download before
every agent action
- Client can upload modified plan
before approval
- Explicit client approval required
before execution
- Reject option triggers iteration with
feedback
- Standing approvals can be granted
for routine decisions
- Agents execute without waiting for
approval
- Plans still generated and stored
internally
- All outputs available for review after
execution
- Client can pause and switch to HITL
at any point
- Full audit trail maintained regardless

## ⚠ CLIENT INVOLVEMENT REQUIRED
● Operating mode selection is required at client onboarding
● Mode can be changed per project or per SDLC component, requires explicit client
instruction
● Even in Full Automation, critical data decisions always require client approval



SDLC Automation Suite  |  Component 1: Requirements Gathering
Confidential  |  Architecture Document 5 of 23
## 4. Client Involvement Map
The following defines every point in the Requirements Gathering process where client
involvement is mandatory, regardless of operating mode.

4.1 One-Time Setup (Onboarding)
## ⚠ CLIENT INVOLVEMENT REQUIRED
● Operating mode selection: Human in the Loop OR Full Automation
● LLM provider selection: OpenAI, Anthropic, Google, Mistral, or other
● LLM model tier selection: Economy, Standard, or Premium
● API key provision: client-owned key OR managed key through platform
● Data sensitivity level: Standard (PII only), Enhanced (PII + business terms),
Maximum (all sensitive)
● Custom sensitive terms definition: client specifies what is sensitive for their domain
● Compliance mode selection: GDPR, HIPAA, or custom
● Role assignment: who on client team handles which tasks

4.2 Per Session (Every Process)
## ⚠ CLIENT INVOLVEMENT REQUIRED
● Data source provision: Excel upload OR database connection credentials via GUI
● Expected outcome definition: what the client wants the system to achieve
● Data confirmation (Approval Gate 1): confirm the system correctly identified their data
● Semantic confirmation (Approval Gate 2): confirm the system understood what the
data means
● Plan approval before every agent action (HITL mode): download, review, optionally
modify and upload, then explicitly approve or reject
● Conflict resolution decisions: any conflict the agent cannot auto-resolve requires
client decision
● Requirements approval (Approval Gate 3): confirm extracted requirements are
correct and complete
● Final sign-off (Approval Gate 4): confirm the complete requirements package solves
their problem


4.3 Critical Decisions (Non-Negotiable, Any Mode)

SDLC Automation Suite  |  Component 1: Requirements Gathering
Confidential  |  Architecture Document 6 of 23
## ⚠ CLIENT INVOLVEMENT REQUIRED
● Any decision that directly touches or modifies client data
● Any assumption the agent made about the meaning of data
● Any conflict between two or more requirements
● Any gap identified between available data and expected outcome
● Any ambiguity in the stated expected outcome
● Any proposed change to a previously approved item
● Any data quality anomaly detected during processing
● Any security anomaly detected in data or processing pipeline

4.4 Exception Handling (Escalation Required)
## ⚠ CLIENT INVOLVEMENT REQUIRED
● Agent fails to process or interpret client data
● LLM returns an unusable or incoherent response after retries
● Conflict cannot be resolved even with fallback logic
● Data quality falls below minimum processing threshold
● System enters SafeMode: client must intervene to reset
● Any anomaly in anonymization or de-anonymization pipeline



SDLC Automation Suite  |  Component 1: Requirements Gathering
Confidential  |  Architecture Document 7 of 23
## 5. Agent Hierarchy
The Requirements Master Agent manages two layers of sub-agents. The Research Layer
always executes before the Implementation Layer. No implementation action begins until
research is complete and (in HITL mode) approved.

## Requirements Master Agent
Orchestrates the complete requirements gathering process. Manages research and
implementation layers, enforces approval gates, maintains audit trail, and produces the final
requirements package for handoff to the Design module.

## 5.1 Research Layer
Executes first, always. Produces a complete understanding of client data and expected outcome
before any requirements are extracted or structured. Output feeds all implementation layer
agents.

## Data Discovery Agent
## INPUTS
- Excel files (raw upload)
- Database connection parameters (provided by client via GUI)

## OUTPUTS
- Schema map: all tables/sheets, columns/fields, data types, relationships
- Data quality report: missing values, anomalies, inconsistencies
- Raw data inventory: volume, patterns, distributions

## Semantic Analysis Agent
## INPUTS
- Schema map (from Data Discovery)
- Raw data inventory (from Data Discovery)
- Data quality report (from Data Discovery)

## OUTPUTS
- Entity map: real-world things in data, their relationships and properties
- Business term glossary: what each field likely means, with confidence score per inference
- Semantic uncertainty report: what could not be confidently inferred

## Outcome Analysis Agent
## INPUTS

SDLC Automation Suite  |  Component 1: Requirements Gathering
Confidential  |  Architecture Document 8 of 23
- Expected outcome (raw, as provided by client)

## OUTPUTS
- Goal hierarchy: primary goals, sub-goals, dependencies
- Success criteria: measurable conditions and acceptance thresholds
- Constraint inference: implied constraints from outcome statement, with confidence scores

## Gap Analysis Agent
## INPUTS
- Entity map (from Semantic Analysis)
- Business term glossary (from Semantic Analysis)
- Semantic uncertainty report (from Semantic Analysis)
- Goal hierarchy (from Outcome Analysis)
- Success criteria (from Outcome Analysis)
- Constraint inference (from Outcome Analysis)

## OUTPUTS
- Coverage map: which goals are fully/partially/not supported by available data
- Conflict report: data conflicts with outcome, internal data conflicts
- Assumption log: every assumption made by any research agent and its basis
- Research summary: complete picture prepared for client approval gate

## ⚠ CLIENT INVOLVEMENT REQUIRED
● APPROVAL GATE 1: Client reviews full research summary before implementation
begins
● Client confirms data was correctly identified and understood
● Client reviews and corrects any assumptions in assumption log
● Client resolves any conflicts flagged in conflict report
● Client may grant standing approvals for routine assumption classes
● Rejection at Gate 1 triggers full research layer re-run with client corrections applied




## 5.2 Implementation Layer
Executes only after research layer is complete and approved. Takes validated research outputs
and produces a structured, conflict-free, client-approved requirements package.

SDLC Automation Suite  |  Component 1: Requirements Gathering
Confidential  |  Architecture Document 9 of 23

## Requirements Extraction Agent
## INPUTS
- Validated research summary
- Client corrections from Gate 1
- Updated assumption log
- Standing approval registry

## OUTPUTS
- Raw requirements list: functional requirements, non-functional requirements, constraints,
assumptions
- Each requirement tagged with: source data, goal it serves, derivation basis
- Extraction log: how each requirement was derived

## Requirements Structuring Agent
## INPUTS
- Raw requirements list (from Extraction)
- Goal hierarchy (from Outcome Analysis)

## OUTPUTS
- Priority-ranked requirements with inter-requirement dependencies
- USGE slot mapping: which requirements map to constraints (K), intent (I), or state space (S)
- Traceability matrix: requirement to source data to goal served

## Conflict Resolution Agent
## INPUTS
- Structured requirements (from Structuring)
- Conflict report (from Gap Analysis)
- Standing approval registry

## OUTPUTS
- Auto-resolved conflicts: resolution logic and authority (agent decision)
- Unresolved conflicts: nature, options, recommendation, escalated to client
- Updated structured requirements with auto-resolutions applied


## ⚠ CLIENT INVOLVEMENT REQUIRED
● All unresolved conflicts from Conflict Resolution Agent require client decision
● Agent only resolves conflicts that fall within basic functionality decisions
● Any conflict touching client data meaning or priority must go to client
● Client decisions are logged in audit trail with timestamp and rationale

SDLC Automation Suite  |  Component 1: Requirements Gathering
Confidential  |  Architecture Document 10 of 23

## Document Ingestion Agent
## INPUTS
- Modified plan document uploaded by client (DOCX or JSON)
- Original plan document (for diff comparison)

## OUTPUTS
- Change diff: what was added, modified, or removed
- Conflict check against previously approved items and USGE constraints
- Validated change set ready for agent consumption

## Translation Agent
## INPUTS
- Updated structured requirements
- Conflict resolution report
- Escalation list
- User role and context (inferred within session)
- Progressive session user model

## OUTPUTS
- Role-appropriate requirements presentation (client sees business language, team sees
domain language)
- Conflict summaries and escalation questions in user's natural language
- Interpreted user feedback: approvals, rejections with reasons, corrections, standing approvals
granted
- Updated session user model reflecting how this person communicates









## Approval Agent
## INPUTS
- Interpreted feedback (from Translation Agent)
- Standing approval registry (current session)
- Audit trail (current session)

## OUTPUTS
- Updated standing approval registry

SDLC Automation Suite  |  Component 1: Requirements Gathering
Confidential  |  Architecture Document 11 of 23
- Approval status per requirement: approved, rejected with reason, or pending
- Iteration instructions: exactly which agents must re-run and with what corrections
- Full session audit trail: every decision, by whom, timestamp, reasoning

## ⚠ CLIENT INVOLVEMENT REQUIRED
● APPROVAL GATE 2 (mid-implementation): Client reviews requirements after
extraction and structuring
● APPROVAL GATE 3: Client approves conflict resolutions before final package
assembly
● APPROVAL GATE 4 (final): Client provides complete sign-off on requirements
package
● Partial approval supported: client can approve some requirements and reject others
in same pass
● Rejection triggers surgical iteration, only affected agents re-run, not full restart



SDLC Automation Suite  |  Component 1: Requirements Gathering
Confidential  |  Architecture Document 12 of 23

## 5.3 Internal Review Queue (Retroactive — Introduced in Component 2)
The Internal Review Queue was formally introduced in Component 2 and retroactively applies to the Implementation Layer of Component 1. Every agent output in the implementation layer enters the review queue before the next agent begins.

## Purpose
- Implementation layer outputs require expert human review before proceeding
- Quality gate between agent output and next agent input
- Applies to all implementation layer agents: Extraction, Structuring, Conflict Resolution, Translation, Approval

## How It Works

Stage | Action | Detail
Agent completes | Output posted to review queue | Type, priority, context summary, download link
Queue visible | Authorized team members see item | In GUI review queue panel
Claim | Team member claims item | Locked to that reviewer, visible to others as in-review
Review | Reviewer examines output | Download, view inline, upload modified version
Decision | Approve or request changes | Approval triggers next agent; changes re-queue same agent
Escalate | Escalate to senior reviewer | Available at any point during review
Timeout | Unclaimed after threshold | Auto-escalated to Project Lead
Log | All actions recorded | Reviewer identity, decision, timestamp, comments

## Authorization Model
Roles are configured at project setup. Any authorized team member can claim any review item within their authorized scope. Review is flexible — no fixed assignment per agent output.

Review Type | Authorized Roles | Notes
Requirements Extraction review | Business Analyst, Project Lead | Requirements completeness and accuracy
Requirements Structuring review | Business Analyst, Tech Lead | Priority and dependency correctness
Conflict Resolution review | Project Lead, Business Analyst | Resolution logic and authority correctness
Translation review | Project Lead | Correct language and framing per user role
Final package review | Project Lead | Complete package sign-off before client gate

## Queue Management Rules
- Unclaimed after configured threshold → auto-escalated to Project Lead
- In-review too long → reminder notification sent to reviewer
- Reviewer unavailable → can release item back to queue for others to claim
- Disagreement between reviewers → Project Lead makes final decision
- Request changes → agent receives specific feedback and re-runs targeted section
- All escalations, timeouts, and decisions logged in audit trail

##  INTERNAL REVIEW REQUIRED
■ Internal review is mandatory after every agent action in the implementation layer
■ No agent proceeds to next step without internal approval
■ Internal reviewers have download/upload/diff capability same as client HITL flow
■ All internal review decisions are logged in audit trail with reviewer identity
■ Review is flexible — any authorized team member can claim any item from the queue



## 6. Complete Data Flow
The following defines the complete data flow through the Requirements Gathering module from
raw client input to final handoff.

## Stage From To
Raw data ingestion Client (Excel/Database via GUI) Data Discovery Agent
Schema and quality Data Discovery Agent Semantic Analysis Agent
Entity and meaning Semantic Analysis Agent Gap Analysis Agent
Raw outcome statement Client (via GUI) Outcome Analysis Agent
Goal hierarchy Outcome Analysis Agent Gap Analysis Agent
Research summary Gap Analysis Agent Translation Agent (for Gate 1)
Gate 1 approval Client (via GUI) Approval Agent
Validated research Approval Agent Requirements Extraction Agent
Raw requirements Extraction Agent Requirements Structuring Agent
Structured requirements Structuring Agent Conflict Resolution Agent
Conflict escalations Conflict Resolution Agent Translation Agent (client escalation)
Client decisions Client (via GUI) Conflict Resolution Agent
Resolved requirements Conflict Resolution Agent Translation Agent (Gate 4)
Final approval Client (via GUI) Approval Agent
Requirements package Approval Agent Design Master Agent (handoff)



SDLC Automation Suite  |  Component 1: Requirements Gathering
Confidential  |  Architecture Document 13 of 23
- Plan Download and Upload
At every agent action point, the system provides the complete plan for client review. This
applies in HITL mode as a mandatory gate and in Full Automation mode as an available-on-
demand feature.

## 7.1 Download
- Available at every agent action point before execution
- Two formats provided simultaneously: DOCX (human-readable) and JSON (machine-
readable)
- DOCX is translated into the user's domain language by the Translation Agent
- JSON preserves full internal structure for technical review
- Both formats version-stamped and stored in MinIO for audit purposes

7.2 Upload (Modified Plan)
- Client downloads plan, modifies it (DOCX or JSON), and uploads via GUI
- Document Ingestion Agent parses the uploaded file
- Diff engine compares modified plan against original
- Changes categorized: additions, modifications, removals
- Validation run against USGE constraints and previously approved items
- Diff presented to client in GUI for confirmation before changes are applied
- Confirmed changes fed back into the appropriate agent for re-processing

## ⚠ CLIENT INVOLVEMENT REQUIRED
● Client must confirm the diff is correct before modified plan is applied
● Any change that conflicts with a previously approved item requires explicit client re-
approval
● Upload and confirmation are entirely within the GUI, no external tools required



SDLC Automation Suite  |  Component 1: Requirements Gathering
Confidential  |  Architecture Document 14 of 23
## 8. Supporting Services
The following services support the Requirements Gathering module. Each is a standalone
product that can be used independently or as part of the integrated suite.

## 8.1 Data Anonymization Service
Ensures client data never reaches external LLM APIs in readable form. Operates entirely on-
premise.


## Component Function Scope
PII Detector Identifies personally identifiable
information
Names, emails, phones,
addresses, IDs
Sensitive Term Detector Identifies business-sensitive data Company names, products,
financials, projects
Tokenizer Replaces real values with session-
scoped tokens
All identified sensitive data
Mapping Registry Stores token-to-real-value mappings Redis, session-scoped, cleared on
session end
De-anonymizer Restores real values in LLM
responses
Applied to every LLM response
before agent use


Anonymization properties:
- Consistent within session: same entity always gets same token so LLM can reason
about relationships
- Inconsistent across sessions: tokens regenerated each session, no cross-session
correlation possible
- Irreversible externally: token format gives no hint of real value to external systems










8.2 LLM Gateway Service
Manages all interactions with online LLM providers. Provides a unified interface regardless of
provider.

SDLC Automation Suite  |  Component 1: Requirements Gathering
Confidential  |  Architecture Document 15 of 23

## Capability Detail
Provider routing Routes to OpenAI, Anthropic, Google, Mistral based on client config
Model selection Economy (fast/cheap), Standard (balanced), Premium (most
capable)
API key management Client-owned key OR platform-managed key
Usage tracking Per client, per session, per agent, per model, every token counted
Cost calculation Real-time cost per request, accumulated per session and project
Retry logic Automatic retry with backoff on transient failures
Response validation Validates LLM response structure before returning to agent
Future scope On-premise LLM via Ollama (not client-facing in current version)

## 8.3 Translation Service
Provides adaptive, role-aware communication between the system and any user. Session-
scoped, no persistence across sessions.

- User model built from first interaction and refined continuously within session
- Outbound: translates internal USGE/agent output into domain-appropriate language for
the specific user
- Inbound: interprets user input back into normalized internal representation
- Never assumes, adapts based on how the user responds
- Never exposes internal USGE structure, agent names, or system internals to user
- Cleared completely at session end, every new session starts with a blank user model

## 8.4 Session Manager
Manages all session-scoped state in Redis. Cleared completely when session ends or user
exits by choice.

- Session state: current stage, active agents, pending approvals
- Anonymization mapping registry: token-to-real-value mappings for this session
- User model: how this user communicates and what they have approved
- Standing approval registry: what classes of decisions client has pre-approved
- Approval history: all decisions made within this session

## 8.5 Audit Service
Maintains a complete, immutable record of every action, decision, and approval within the
system.

SDLC Automation Suite  |  Component 1: Requirements Gathering
Confidential  |  Architecture Document 16 of 23

## Event Type What Is Logged Purpose
Agent action Agent name, action taken, input/output
summary, timestamp
Process traceability
Plan version Every plan generated and every uploaded
modification
Change history
Client approval Who approved, what was approved,
timestamp, mode active
## Accountability
LLM call Anonymized prompt sent, response
received, tokens used, cost
Usage and billing
Conflict decision Conflict description, resolution, authority
(agent or client)
Decision audit
System event Mode changes, SafeMode entries,
session start/end
Operations audit

## 8.6 Document Service
Generates, stores, and manages all plan documents produced during the requirements
gathering process.

- Plan generator: produces DOCX (human-friendly) and JSON (machine-readable)
simultaneously
- Document ingestion: parses uploaded DOCX or JSON modifications from client
- Diff engine: compares original and modified plans, produces structured change report
- Storage: all documents stored in MinIO with version history



SDLC Automation Suite  |  Component 1: Requirements Gathering
Confidential  |  Architecture Document 17 of 23
## 9. Technical Stack

Layer Technology Role in This Module
Frontend Angular GUI, all user interactions, approvals,
uploads, downloads
Visualization Power BI Report Server / Apache
## Superset
Requirements dashboards, coverage
maps, audit reports
API Gateway Ocelot (.NET) Single entry point, auth enforcement,
routing
Backend .NET Orchestration, session management,
approval workflow
Database Access ADO.NET / Dapper (no Entity
## Framework)
Raw SQL, full control, no abstraction
overhead
Database SQL Server (via SSMS) Application data, audit trail, billing records
DB Management GUI-driven (via Angular frontend) Schema, migrations, connections, no
manual setup for end user
AI / Agents Python + LangGraph All agent logic, orchestration, LLM
integration
LLM Providers OpenAI / Anthropic / Google /
## Mistral
Online only, client selects provider and
model
Message Queue RabbitMQ Async agent-to-agent communication
Agent-Backend
## Comms
gRPC (sync) + RabbitMQ
## (async)
Reliable .NET to Python bridge
Session / Cache Redis Session state, anonymization registry,
user model
Document Storage MinIO Plan documents, uploaded modifications,
outputs
Authentication Active Directory + Identity Server Enterprise auth, role-based access
Logging / Audit ELK Stack All agent activity, decisions, LLM calls
Monitoring Prometheus + Grafana System health, agent performance, LLM
usage



SDLC Automation Suite  |  Component 1: Requirements Gathering
Confidential  |  Architecture Document 18 of 23
- GUI Requirements
The GUI is the complete operating environment. No user action requires any tool or interface
outside the system GUI.

## 10.1 Data Input
- Excel file upload (drag-and-drop or file picker)
- Database connection setup via form (server, credentials, database name, type)
- Connection test and validation before saving
- Expected outcome entry (free text with guided prompts)

## 10.2 Process Visibility
- Current stage indicator: which layer and which agent is active
- Agent status per agent: waiting, running, complete, failed
- Pending client input indicator: clear signal when system is waiting for approval
- Overall progress tracker: how far through the requirements process
- Iteration counter: which iteration is currently running

10.3 Plan Review and Approval
- Inline plan viewer: translated into user's language, expandable per section
- Download button: produces DOCX and JSON simultaneously
- Upload button: accepts modified DOCX or JSON
- Diff viewer: side-by-side original vs modified with highlighted changes
- Approval action bar: Approve / Reject / Request Changes
- Feedback input: inline text field for rejection reason or change request
- Standing approval grants: checkbox options for routine decision classes

## 10.4 Conflict Management
- Conflict panel: displays each unresolved conflict with clear description
- Resolution options presented per conflict
- Client selects resolution or provides custom decision
- Decision logged immediately to audit trail



10.5 Audit and Reporting
- Full audit trail viewer: every event, filterable by type, agent, timestamp

SDLC Automation Suite  |  Component 1: Requirements Gathering
Confidential  |  Architecture Document 19 of 23
- Plan version history: all generated and uploaded plan versions
- Decision log: every approval and rejection with context
- Power BI / Superset embedded dashboards: requirements coverage, conflict summary,
approval status

## 10.6 Session Management
- Clear session start: explicit process initiation by user
- Session status always visible
- Exit by choice: user can end session at any time, triggers full state clear
- No session data persists after exit, confirmed to user before exit completes



SDLC Automation Suite  |  Component 1: Requirements Gathering
Confidential  |  Architecture Document 20 of 23
- USGE v1.0 Framework Mapping
The Requirements Gathering module is a valid USGE instance. The following maps every
USGE formal component to its implementation in this module.

USGE Component Requirements Gathering Implementation
State Space (Sigma) Current understanding of requirements, evolves with each iteration
Valid States (V_Sigma) Requirement states that satisfy all constraints and are client-
approved
SafeMode Escalation state: process frozen, client must intervene to resume
Input Space (R) Raw client data (Excel/Database) + expected outcome statement
Output Space (O) Requirements package actions: extract, structure, present, approve
Context Space (C) Session state, client role, current iteration, approval history
Intent (I) Client's expected outcome, goal hierarchy produced by Outcome
## Analysis Agent
Constraints (K) Data quality thresholds, USGE structural rules, compliance
requirements, client-defined limits
Policy (Pi) Agent decision logic: how to extract, structure, resolve, and present
requirements
Measurement (M) Client approval signal, quality of current requirements state vs
expected outcome
Represent function Data Discovery + Semantic Analysis: maps raw input to structured
state representation
Layer 1 Safety Constraint filtering: admissible decisions only (no constraint-violating
requirements)
Layer 2 Safety Policy Consistency: agents always produce valid state transitions
Layer 3 Safety Post-execution validation: every agent output validated before next
step
Layer 4 Safety SafeMode fallback: if validation fails and recovery fails, escalate to
client



SDLC Automation Suite  |  Component 1: Requirements Gathering
Confidential  |  Architecture Document 21 of 23
## 12. Iteration Model
The Requirements Gathering module follows the iterative SDLC model. Each iteration produces
a refined, more complete requirements state. Iteration continues until the client provides final
sign-off.

- Each iteration produces a working, valid partial requirements state, not just a document
- Client feedback from each iteration feeds directly into the next
- Iteration is surgical: only the affected agents re-run, not the full pipeline
- The measurement function M(t) in USGE terms is the client approval signal
- Progress is non-monotonic: a rejected iteration is not a failure, it is useful signal
- SafeMode suspends iteration: process frozen until client intervenes
- Iteration terminates when client provides final sign-off at Approval Gate 4

## ⚠ CLIENT INVOLVEMENT REQUIRED
● Client feedback at every approval gate is the primary signal for iteration direction
● Client can request a full restart only at their explicit instruction, never auto-triggered
● Client approval at Gate 4 is the sole termination condition for the requirements
gathering process



SDLC Automation Suite  |  Component 1: Requirements Gathering
Confidential  |  Architecture Document 22 of 23
- Handoff to Design Module
Upon final client approval, the Requirements Master Agent produces a complete requirements
package and passes it to the Design Master Agent (Component 2).

## 13.1 Requirements Package Contents
- Complete structured requirements: functional, non-functional, constraints, assumptions
- Priority ranking and inter-requirement dependency map
- USGE slot mapping: which requirements map to K, I, and S
- Traceability matrix: every requirement traced to source data and goal served
- Assumption log: all assumptions made with basis and client confirmation status
- Conflict resolution log: all conflicts, resolutions, and authority
- Audit trail: complete session record of all decisions and approvals
- Client approval confirmations: timestamped sign-offs at all four gates
- Plan version history: all iterations with client feedback per iteration

## 13.2 Handoff Properties
- Handoff is via message queue (RabbitMQ), no direct coupling between modules
- Requirements package is schema-validated before dispatch
- Design Master Agent acknowledges receipt, handoff confirmed before session closes
- Requirements package stored in MinIO for future reference by any authorized module

## ⚠ CLIENT INVOLVEMENT REQUIRED
● Client must provide explicit final sign-off (Gate 4) before handoff to Design module is
initiated
● Client is notified when handoff is complete and Design module has acknowledged
receipt
● Client can request access to requirements package at any time after handoff



SDLC Automation Suite  |  Component 1: Requirements Gathering
Confidential  |  Architecture Document 23 of 23
## Appendix: Client Involvement Summary
Complete reference of all client involvement points in the Requirements Gathering module.

When What Client Must Do Consequence if Skipped
Onboarding Configure mode, LLM, sensitivity,
roles
System cannot start
Session start Provide data source and expected
outcome
No data to process
Approval Gate 1 Confirm research summary is
correct
Implementation does not begin
During implementation Resolve escalated conflicts Affected requirements blocked
Approval Gate 2 Review mid-implementation
requirements
Structuring does not complete
Approval Gate 3 Confirm conflict resolutions Final package not assembled
Approval Gate 4 Final sign-off on requirements
package
Handoff to Design blocked
Any critical decision Approve data-touching decisions Agent halts and waits
Any anomaly Respond to escalation System enters SafeMode
Plan review (HITL) Download, optionally modify,
approve plan
Agent does not execute

## Next: Component 2, Design Automation Architecture.