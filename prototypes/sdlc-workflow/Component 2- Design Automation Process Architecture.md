





## COMPONENT 2
## Design Automation
## Formal Architecture Document
SDLC Automation Suite
Built on USGE v1.0 Meta-Architecture






## Version Status Date
## 1.0 Draft 2024

SDLC Automation Suite  |  Component 2: Design Automation
Confidential  |  Architecture Document 2 of 30
## 1. Overview
This document defines the complete formal architecture for Component 2 of the SDLC
Automation Suite: the Design Automation module. It covers agent hierarchy across three tracks,
data flows, internal and client involvement points, Figma integration, the internal review queue,
and the complete design package produced for handoff to Component 3.

The Design Automation module receives the validated requirements package from Component
1 and produces a complete design package consisting of a formal technical design specification
and a complete Figma design file. All design decisions are traceable back to requirements.

## Property Value
Underlying Framework USGE v1.0 Meta-Architecture
SDLC Position Component 2 of 5
## Receives From Component 1: Requirements Gathering
Primary Input Validated requirements package
Primary Output Technical design specification + Figma design file
## Handoff Target Component 3: Development Module
Operating Model Iterative (client and internal approved cycles)
Sequencing Serial, Research → Technical Design → UI/UX Design
Figma Integration Via Figma MCP, agents create and modify Figma directly
Design Approach Adaptable, from scratch OR from existing client design system
Total Agents 20 agents across 3 tracks
Client Approval Gates 3 gates (post-research, post-technical, post-UI/UX)
Internal Review Gates After every agent in implementation tracks



SDLC Automation Suite  |  Component 2: Design Automation
Confidential  |  Architecture Document 3 of 30
## 2. Architectural Principles
Component 2 inherits all principles established in Component 1 and introduces one new
principle for the internal review queue.

Principle Inherited From Application in Component 2
Research before
implementation
Component 1 7 research agents before any design work begins
Data first Component 1 Requirements package fully understood before
design starts
Serial sequencing Component 2
decision
Research → Technical Design → UI/UX, no
parallelism
Client approval gates Component 1 3 gates: post-research, post-technical, post-
## UI/UX
HITL / Full Automation Component 1 System-wide setting, applies to all design agents
Download/upload at
every action
Component 1 Every agent output downloadable, uploadable,
modifiable
Translation layer Component 1 Technical output translated to business language
for client
Anonymization before
## LLM
Component 1 All design context anonymized before external
LLM calls
Session-scoped memory Component 1 No design state persists beyond session end
Full audit trail Component 1 Every design decision, review, and approval
logged
Loose coupling Component 1 Every agent atomic, single responsibility,
independently replaceable
Standalone product Component 1 Component 2 operable independently of other
SDLC components
Internal review queue NEW, Component 2 Flexible, authorized, claimed review for every
agent output



SDLC Automation Suite  |  Component 2: Design Automation
Confidential  |  Architecture Document 4 of 30
## 3. Internal Review Queue
Component 2 introduces the Internal Review Queue, a flexible, centrally managed review
mechanism that applies after every agent action in the implementation tracks. This is distinct
from client approval gates.

## 3.1 Purpose
- Technical design outputs require expert human review before proceeding
- Client should never review raw technical outputs, internal team validates first
- Quality gate between agent output and next agent input
- Applies to both Technical Design Track and UI/UX Design Track
- Retroactively applies to Component 1 implementation layer as well

## 3.2 How It Works
## Stage Action Detail
Agent completes Output posted to review
queue
Type, priority, context summary, download link
Queue visible Authorized team
members see item
In GUI review queue panel
Claim Team member claims
item
Locked to that reviewer, visible to others as in-
review
Review Reviewer examines
output
Download, view inline, upload modified version
Decision Approve or request
changes
Approval triggers next agent; changes re-queue
same agent
Escalate Escalate to senior
reviewer
Available at any point during review
Timeout Unclaimed after
threshold
Auto-escalated to Project Lead
Log All actions recorded Reviewer identity, decision, timestamp,
comments



## 3.3 Authorization Model

SDLC Automation Suite  |  Component 2: Design Automation
Confidential  |  Architecture Document 5 of 30
Roles are configured at project setup. Any authorized team member can claim any review item
within their authorized scope.

## Review Type Authorized Roles Notes
Architecture review Solution Architect, Tech Lead Critical gate, changes affect all
downstream agents
Component design review Tech Lead, Senior Developer Structural decisions reviewed here
Data model review Solution Architect, Tech Lead,
## Senior Developer
Schema decisions finalized here
API design review Tech Lead, Senior Developer Interface contracts locked after
approval
Integration review Tech Lead, Integration Specialist External boundary decisions
Technical documentation Project Lead, Tech Lead Final technical review before client
gate
Figma workspace review Tech Lead, UI/UX Lead Structure established for all design
work
Design system review UI/UX Lead, Tech Lead Critical gate, all components built
on this
Component library review UI/UX Lead, Senior Designer Component quality and
consistency
Screen design review UI/UX Lead, Project Lead Requirements coverage verified
Interaction flow review UI/UX Lead, Tech Lead Technical feasibility of interactions
Design audit review Project Lead, UI/UX Lead Final internal check before client
sees design
Design package review Project Lead, Tech Lead Complete package sign-off before
client gate

## 3.4 Queue Management Rules
- Unclaimed after configured threshold → auto-escalated to Project Lead
- In-review too long → reminder notification sent to reviewer
- Reviewer unavailable → can release item back to queue for others to claim
- Disagreement between reviewers → Project Lead makes final decision
- Request changes → agent receives specific feedback and re-runs targeted section
- All escalations, timeouts, and decisions logged in audit trail

3.5 GUI, Review Queue Panel
- Available items: unclaimed items with type, description, time waiting, claim button
- My active reviews: full output view, download, upload modified, diff viewer,
approve/request changes/escalate

SDLC Automation Suite  |  Component 2: Design Automation
Confidential  |  Architecture Document 6 of 30
- Completed reviews: history of all reviews with decisions and timestamps
- Queue health: overview of pending, in-review, and completed items per project

##  INTERNAL REVIEW REQUIRED
■ Internal review is mandatory after every agent action in implementation tracks
■ No agent proceeds to next step without internal approval
■ Internal reviewers have download/upload/diff capability same as client HITL flow
■ All internal review decisions are logged in audit trail with reviewer identity



SDLC Automation Suite  |  Component 2: Design Automation
Confidential  |  Architecture Document 7 of 30
## 4. Complete Component 2 Flow

## Stage Description
Input Requirements package received from Component 1 via RabbitMQ
Research Layer 7 agents study requirements, assess feasibility, define options
Client Gate 1 Client selects architecture option, UI/UX direction, resolves feasibility
issues
Technical Design Track 6 agents produce complete technical specification serially
Internal Review After every technical agent, authorized team member claims and
reviews
Client Gate 2 Client approves technical design in business language via
## Translation Agent
UI/UX Design Track 7 agents produce complete Figma design serially
Internal Review After every UI/UX agent, authorized team member claims and
reviews
Client Gate 3 Client reviews Figma prototype embedded in GUI, approves or
requests changes
Output Design package dispatched to Component 3 via RabbitMQ



SDLC Automation Suite  |  Component 2: Design Automation
Confidential  |  Architecture Document 8 of 30
## 5. Research Layer
The Research Layer always executes first. No design work begins until research is complete
and approved at Client Gate 1. Seven agents run serially, each building on the output of the
previous.

RESEARCH LAYER, 7 Agents

## 1. Requirements Interpretation Agent
## INPUTS
- Complete requirements package from Component 1
- Functional requirements, non-functional requirements, constraints, assumptions
- USGE slot mappings and traceability matrix

## OUTPUTS
- Design requirement map: what screens/flows and what systems/components need designing
- Design questions log: requirements ambiguous from a design perspective
- Non-negotiables list: requirements that directly constrain design choices
- Design scope boundary: explicit definition of what is and is not in design scope

## 2. Asset Discovery Agent
## INPUTS
- Client confirmation: starting from scratch OR existing design system
- Figma file access if existing (via Figma MCP)
- Existing component libraries, brand guidelines, design tokens if available

## OUTPUTS
- Asset inventory: existing components, design tokens, brand guidelines
- Gap analysis: what exists vs what requirements demand
- Starting point recommendation: full scratch, extend existing, or rebuild on existing
- Figma workspace structure: current state of client Figma environment

## ⚠ CLIENT INVOLVEMENT REQUIRED
● Client must confirm whether starting from scratch or using existing design system,
Asset Discovery Agent cannot proceed without this decision



## 3. Technical Feasibility Agent
## INPUTS

SDLC Automation Suite  |  Component 2: Design Automation
Confidential  |  Architecture Document 9 of 30
- Design requirement map (from Requirements Interpretation)
- Non-negotiables list (from Requirements Interpretation)
- Constraints from requirements package
- Client tech stack from onboarding configuration

## OUTPUTS
- Feasibility assessment per requirement: fully feasible, feasible with constraints, or not feasible
- Technical constraint map: where technical limits directly shape design options
- Performance considerations: what design decisions affect system performance
- Escalation list: infeasible items requiring client decision before design can proceed

## ⚠ CLIENT INVOLVEMENT REQUIRED
● All infeasible requirements must be resolved by client before design proceeds, agent
cannot make these decisions

## 4. Architecture Options Agent
## INPUTS
- Design requirement map (from Requirements Interpretation)
- Feasibility assessment (from Technical Feasibility)
- Technical constraint map (from Technical Feasibility)
- Asset inventory (from Asset Discovery)

## OUTPUTS
- Architecture options (2-3 viable approaches): pattern, component breakdown, data flow,
pros/cons, fit score per option
- Recommended option with rationale
- Decision points: where client preference should guide architecture choice
- Rejected options log: what was considered and why ruled out

## ⚠ CLIENT INVOLVEMENT REQUIRED
● Client must select preferred architecture option, this drives the entire Technical
## Design Track




- UI/UX Strategy Agent
## INPUTS
- Design requirement map (from Requirements Interpretation)
- Asset inventory and starting point recommendation (from Asset Discovery)
- Architecture options (from Architecture Options Agent)

SDLC Automation Suite  |  Component 2: Design Automation
Confidential  |  Architecture Document 10 of 30
- Non-negotiables list (from Requirements Interpretation)

## OUTPUTS
- UI/UX approach options (2-3 viable directions): design philosophy, component strategy,
navigation pattern, interaction model, fit score
- Recommended direction with rationale
- Screen/flow inventory: complete list of every screen and flow to be designed in Figma
- Design token strategy: colors, typography, spacing approach
- Figma workspace plan: how files, pages, and components will be organized


## ⚠ CLIENT INVOLVEMENT REQUIRED
● Client must select preferred UI/UX direction, this drives the entire UI/UX Design
## Track


- Dependency and Integration Agent
## INPUTS
- Design requirement map (from Requirements Interpretation)
- Architecture options (from Architecture Options Agent)
- Constraints from requirements package

## OUTPUTS
- Internal dependency map: which components depend on which
- External integration map: third-party services, APIs to be consumed, data sources
- Integration constraints: where external systems limit design freedom
- Sequencing recommendation: what must be designed before what










## 7. Risk Analysis Agent
## INPUTS
- All outputs from all preceding research agents
- Requirements package from Component 1

## OUTPUTS

SDLC Automation Suite  |  Component 2: Design Automation
Confidential  |  Architecture Document 11 of 30
- Risk register: description, likelihood, impact, affected area, mitigation per risk
- Unknown log: things research could not determine with confidence
- Assumption log: all assumptions made during research (carries forward Component 1
assumptions)
- Research summary: complete picture compiled for Client Approval Gate 1

## ⚠ CLIENT INVOLVEMENT REQUIRED
● APPROVAL GATE 1: Client reviews complete research summary before any design
begins
● Client selects architecture option from Architecture Options Agent output
● Client selects UI/UX direction from UI/UX Strategy Agent output
● Client resolves all feasibility escalations from Technical Feasibility Agent
● Client confirms or corrects all assumptions in assumption log
● Client reviews full risk register and acknowledges risks
● Rejection at Gate 1 triggers targeted research agent re-runs with client corrections
applied



SDLC Automation Suite  |  Component 2: Design Automation
Confidential  |  Architecture Document 12 of 30
## 6. Technical Design Track
The Technical Design Track executes after Client Gate 1 approval. Six agents run serially. Each
agent output is followed by a mandatory internal review before the next agent begins. The track
produces a complete technical design document.

TECHNICAL DESIGN TRACK, 6 Agents

## 1. System Architecture Agent
## INPUTS
- Approved architecture option (client-selected at Gate 1)
- Full Architecture Options Agent output
- Dependency and Integration map
- Technical constraint map
- Non-negotiables list

## OUTPUTS
- System architecture specification: component inventory, responsibilities, boundaries,
communication patterns, deployment topology
- Architecture decision log: every decision made and why
- Open questions: anything requiring client or team input

##  INTERNAL REVIEW REQUIRED
■ INTERNAL REVIEW, Architecture: Solution Architect or Tech Lead must claim and
approve
■ Critical gate, every subsequent agent builds on this output
■ Changes to architecture here trigger re-run of all downstream technical agents

## 2. Component Design Agent
## INPUTS
- System architecture specification (from System Architecture Agent)
- Component inventory (from System Architecture Agent)
- Functional requirements from requirements package

## OUTPUTS
- Component specifications per component: internal structure, responsibilities, interface
definition, state management, error handling, dependencies
- Component interaction diagram: how components communicate
- Component design decision log


SDLC Automation Suite  |  Component 2: Design Automation
Confidential  |  Architecture Document 13 of 30
##  INTERNAL REVIEW REQUIRED
■ INTERNAL REVIEW, Components: Tech Lead or Senior Developer must claim and
approve

## 3. Data Model Agent
## INPUTS
- Component specifications (from Component Design Agent)
- System architecture specification
- Data-related functional requirements
- Non-functional requirements: performance, scale

## OUTPUTS
- Entity definitions per entity: attributes, types, constraints, relationships, ownership
- Database schema: tables, columns, types, keys, indexes, constraints
- Data flow map: how data moves through the system
- Data lifecycle definition: creation, transformation, deletion/archival rules
- Data model decision log

##  INTERNAL REVIEW REQUIRED
■ INTERNAL REVIEW, Data Model: Solution Architect, Tech Lead, or Senior
Developer must claim and approve

- API Design Agent
## INPUTS
- Component specifications (from Component Design Agent)
- Data model (from Data Model Agent)
- External integration map (from Dependency Agent)
- Non-functional requirements: performance, security

## OUTPUTS
- Internal API specifications per API: endpoint, request schema, response schema, error
responses, auth requirement, rate limiting, versioning
- External API specifications: same structure for third-party integrations
- API communication matrix: which component calls which API
- API security model: authentication, authorization, data exposure rules per endpoint
- API design decision log

##  INTERNAL REVIEW REQUIRED
■ INTERNAL REVIEW, API Design: Tech Lead or Senior Developer must claim and
approve

SDLC Automation Suite  |  Component 2: Design Automation
Confidential  |  Architecture Document 14 of 30

## 5. Integration Design Agent
## INPUTS
- External integration map (from Dependency Agent)
- API specifications (from API Design Agent)
- Data model (from Data Model Agent)
- Technical constraint map

## OUTPUTS
- Integration specifications per integration: type, data mapping, authentication, error handling,
retry strategy, failure behavior, monitoring approach
- Integration sequence flows: step-by-step data flow per integration
- Integration risk assessment: what happens if each integration fails
- Integration decision log

##  INTERNAL REVIEW REQUIRED
■ INTERNAL REVIEW, Integration: Tech Lead or Integration Specialist must claim and
approve

## 6. Technical Documentation Agent
## INPUTS
- System architecture specification
- Component specifications
- Data model
- API specifications
- Integration specifications
- All decision logs from all preceding technical agents

## OUTPUTS
- Technical design document: executive summary, architecture, components, data model, APIs,
integrations, decision log appendix
- Design assumption log: all assumptions made during technical design
- Open items log: anything unresolved needing client or team decision
- Handoff summary for UI/UX track: what UI/UX agents need to know about technical decisions


##  INTERNAL REVIEW REQUIRED
■ INTERNAL REVIEW, Final Technical: Project Lead and Tech Lead must claim and
approve
■ This is the last internal gate before client sees technical output
■ Open items must be resolved before Client Gate 2

SDLC Automation Suite  |  Component 2: Design Automation
Confidential  |  Architecture Document 15 of 30

## ⚠ CLIENT INVOLVEMENT REQUIRED
● APPROVAL GATE 2: Client reviews technical design in business language via
## Translation Agent
● Client approves system architecture direction at a conceptual level
● Client resolves all open items from Technical Documentation Agent
● Client confirms all technical assumptions are acceptable
● Rejection triggers surgical re-run of affected agents only, not full track restart
● Approval at Gate 2 triggers UI/UX Design Track



SDLC Automation Suite  |  Component 2: Design Automation
Confidential  |  Architecture Document 16 of 30
- UI/UX Design Track
The UI/UX Design Track executes after Client Gate 2 approval. Seven agents run serially. All
design work happens directly in Figma via Figma MCP. Each agent output is followed by a
mandatory internal review. The track produces a complete, navigable Figma design file.

UI/UX DESIGN TRACK, 7 Agents (Figma via MCP)

## 1. Figma Workspace Agent
## INPUTS
- Figma workspace plan (from UI/UX Strategy Agent)
- Asset inventory and starting point (from Asset Discovery Agent)
- Handoff summary from Technical Design Track

## OUTPUTS
- Workspace configuration document: what was created, where, and why
- Figma file URL for team access

FIGMA OUTPUTS (via MCP)
- Project structure created in Figma: cover page, design system page, component library page,
screen design pages per feature area, interaction flows page
- Naming conventions established
- Grid and layout frames set up

##  INTERNAL REVIEW REQUIRED
■ INTERNAL REVIEW, Workspace Structure: Tech Lead or UI/UX Lead must claim
and approve before any design work begins

## 2. Design System Agent
## INPUTS
- Approved UI/UX direction (client-selected at Gate 1)
- Asset inventory (from Asset Discovery Agent)
- Brand guidelines if existing
- Technical constraints from technical design
- Figma workspace (from Figma Workspace Agent)

## OUTPUTS
- Design system documentation: every token defined with usage guidelines
- Design system decision log

FIGMA OUTPUTS (via MCP)

SDLC Automation Suite  |  Component 2: Design Automation
Confidential  |  Architecture Document 17 of 30
- Design tokens defined in Figma: color palette (primary, secondary, accent, semantic, neutral
scale), typography system (font families, scale, line heights), spacing system, border radius
system, shadow system, icon set definition

##  INTERNAL REVIEW REQUIRED
■ INTERNAL REVIEW, Design System: UI/UX Lead and Tech Lead must claim and
approve
■ Critical gate, every component and screen is built on this foundation
■ Changes to design system here require re-run of all downstream UI/UX agents

## 3. Component Library Agent
## INPUTS
- Screen/flow inventory (from UI/UX Strategy Agent)
- Design system (from Design System Agent)
- Component interaction model
- Technical component specs (from Component Design Agent)
- Figma workspace (from Figma Workspace Agent)

## OUTPUTS
- Component documentation per component: usage guidelines, props and variants, do and
dont examples, accessibility notes
- Component decision log

FIGMA OUTPUTS (via MCP)
- Base components in Figma: buttons (all variants/states), inputs (all types/states), dropdowns,
checkboxes, radio buttons, toggles, labels, badges, icons, avatars
- Composite components: cards, tables, data grids, navigation, modals, notifications, alerts,
forms, loading states, skeletons
- Feature-specific components unique to system requirements

##  INTERNAL REVIEW REQUIRED
■ INTERNAL REVIEW, Component Library: UI/UX Lead or Senior Designer must claim
and approve





## 4. Screen Design Agent
## INPUTS
- Screen/flow inventory (from UI/UX Strategy Agent)

SDLC Automation Suite  |  Component 2: Design Automation
Confidential  |  Architecture Document 18 of 30
- Component library (from Component Library Agent)
- Design system (from Design System Agent)
- API specifications (from API Design Agent), knows what data each screen can display
- Data model (from Data Model Agent), knows what data structures exist
- Functional requirements, what each screen must do

## OUTPUTS
- Screen inventory map: every screen with Figma frame reference
- Screen design decision log

FIGMA OUTPUTS (via MCP)
- All screens designed in Figma per screen: desktop layout, responsive breakpoints if required,
all states (empty, loading, error, populated, edge cases), annotations (what each element
does, data source, interaction notes)

##  INTERNAL REVIEW REQUIRED
■ INTERNAL REVIEW, Screen Designs: UI/UX Lead or Project Lead must claim and
approve

## 5. Interaction Flow Agent
## INPUTS
- All screen designs (from Screen Design Agent)
- Navigation pattern (from UI/UX Strategy Agent)
- Interaction model (from UI/UX Strategy Agent)
- Functional requirements: user journeys

## OUTPUTS
- User flow diagrams per major journey: entry point, decision points, success paths, error paths,
exit points
- Navigation map: complete navigation structure
- Interaction specifications: micro-interactions, animation guidelines, gesture support if
applicable
- Flow decision log

FIGMA OUTPUTS (via MCP)
- Prototype connections in Figma: every screen connected via Figma prototyping, transition
types defined, interaction triggers defined

##  INTERNAL REVIEW REQUIRED
■ INTERNAL REVIEW, Interaction Flows: UI/UX Lead and Tech Lead must claim and
approve


SDLC Automation Suite  |  Component 2: Design Automation
Confidential  |  Architecture Document 19 of 30
## 6. Design Review Agent
## INPUTS
- Complete Figma file (all pages)
- Requirements package from Component 1
- Technical design document
- Screen inventory (every screen must be present)
- Component library (every screen must use it)
- Design system (every screen must follow it)

## OUTPUTS
- Consistency report: components used correctly, design tokens applied consistently, naming
conventions followed
- Completeness report: every screen present, every state designed, every flow connected
- Requirements coverage report: every functional requirement reflected in design
- Technical alignment report: design aligns with API and data model
- Issues log: critical issues (must fix), major issues (should fix), minor issues (nice to fix)
- Review summary: overall design quality assessment

##  INTERNAL REVIEW REQUIRED
■ INTERNAL REVIEW, Design Audit: Project Lead and UI/UX Lead must claim and
approve
■ Critical issues must be resolved before proceeding, targeted agents re-run per issue
■ This is the last quality gate before Design Package Agent runs

## 7. Design Package Agent
## INPUTS
- Complete reviewed Figma file
- Issues log (from Design Review Agent, all critical issues resolved)
- All decision logs from all UI/UX agents
- Technical design document
- Requirements package

## OUTPUTS
- Design specification document: design system reference, component usage guide, screen
inventory with Figma links, interaction specification, design decision log
- Developer handoff notes: implementation priorities, complex interaction explanations, asset
export specifications, what needs custom development vs library
- Complete design package: Figma file URL + design specification document + developer
handoff notes

FIGMA OUTPUTS (via MCP)
- Final Figma file organized: all pages clean and named, all components published, prototype
connections complete, developer handoff annotations complete

SDLC Automation Suite  |  Component 2: Design Automation
Confidential  |  Architecture Document 20 of 30

##  INTERNAL REVIEW REQUIRED
■ INTERNAL REVIEW, Final Package: Project Lead and Tech Lead must claim and
approve before client sees the complete design

## ⚠ CLIENT INVOLVEMENT REQUIRED
● APPROVAL GATE 3: Client reviews complete design via Figma prototype embedded
in GUI
● Client navigates full prototype without leaving the system
● Client can annotate feedback directly on screens in GUI
● Client can request changes to specific screens or flows, targeted agents re-run
● Client approves design specification document in business language
● Approval at Gate 3 triggers dispatch of complete design package to Component 3



SDLC Automation Suite  |  Component 2: Design Automation
Confidential  |  Architecture Document 21 of 30
## 8. Complete Data Flow

## Stage From To
Requirements package
received
Component 1 via RabbitMQ Requirements Interpretation Agent
Design requirement map Requirements Interpretation Asset Discovery, Technical
## Feasibility, Architecture Options,
UI/UX Strategy
Asset inventory Asset Discovery Agent Architecture Options, UI/UX
## Strategy, Figma Workspace,
## Design System, Component
## Library
Feasibility assessment Technical Feasibility Agent Architecture Options Agent
Architecture options Architecture Options Agent UI/UX Strategy Agent, Client (Gate
1 selection)
UI/UX approach options UI/UX Strategy Agent Client (Gate 1 selection)
Dependency and integration
map
Dependency Agent System Architecture, API Design,
## Integration Design
Risk and research summary Risk Analysis Agent Translation Agent (Gate 1
presentation)
Gate 1 approval + selections Client via GUI System Architecture Agent, Figma
## Workspace Agent
System architecture spec System Architecture Agent Component Design Agent
Component specifications Component Design Agent Data Model Agent, Component
## Library Agent
Data model Data Model Agent API Design Agent, Screen Design
## Agent
API specifications API Design Agent Integration Design Agent, Screen
## Design Agent
Integration specifications Integration Design Agent Technical Documentation Agent
Technical design document Technical Documentation
## Agent
Translation Agent (Gate 2), UI/UX
track agents
Gate 2 approval Client via GUI Figma Workspace Agent
Figma workspace Figma Workspace Agent Design System Agent
Design system Design System Agent Component Library Agent
Component library Component Library Agent Screen Design Agent
Screen designs Screen Design Agent Interaction Flow Agent
Interaction flows + prototype Interaction Flow Agent Design Review Agent

SDLC Automation Suite  |  Component 2: Design Automation
Confidential  |  Architecture Document 22 of 30
Design audit report Design Review Agent Design Package Agent
Complete design package Design Package Agent Translation Agent (Gate 3), then
## Component 3
Gate 3 approval Client via GUI RabbitMQ dispatch to Component
## 3



SDLC Automation Suite  |  Component 2: Design Automation
Confidential  |  Architecture Document 23 of 30
## 9. Figma Integration
Figma is integrated via the Figma MCP server. Agents interact with Figma directly, creating,
modifying, and organizing design artifacts programmatically. The client never needs to open
Figma directly; the prototype is embedded in the GUI.

9.1 What Agents Do in Figma
Agent Figma Actions Figma Objects Created/Modified
Figma Workspace Agent Create project, define pages, set
up frames
Project, pages, layout frames, grids
Design System Agent Define tokens, create styles Color styles, text styles, effect styles,
spacing tokens
## Component Library
## Agent
Create components with variants
and states
Base components, composite
components, feature components
Screen Design Agent Design screens using component
library
Screen frames, instances, auto-layout,
annotations
Interaction Flow Agent Connect screens, define
transitions
Prototype connections, transitions,
interaction triggers
Design Review Agent Audit existing Figma content Issues flagged as Figma comments
Design Package Agent Finalize, organize, publish Published components, developer
handoff annotations, cleaned file

## 9.2 Design Approach, Adaptable
## Scenario Agent Behavior
Starting from scratch Agents create complete design system, components, and screens
from requirements and approved direction
Existing design system Asset Discovery Agent catalogues existing assets. Subsequent
agents extend, adapt, or rebuild on existing foundation as
recommended
Partial existing assets Asset Discovery identifies what to reuse vs what to create. Each
component classified individually
Client provides brand
guidelines
Design System Agent incorporates brand colors, typography, and
guidelines into Figma design tokens



9.3 Figma in GUI
- Figma prototype embedded in GUI via Figma MCP, client never leaves the system

SDLC Automation Suite  |  Component 2: Design Automation
Confidential  |  Architecture Document 24 of 30
- Screen inventory panel: jump to any screen directly from GUI
- Inline feedback: client annotates screens, agents receive structured feedback
- Download option: full Figma file exportable at any point
- Version history: every Figma state saved per iteration



SDLC Automation Suite  |  Component 2: Design Automation
Confidential  |  Architecture Document 25 of 30
## 10. Involvement Map

## 10.1 Client Involvement
When What Client Must Do Consequence if Not Done
Asset Discovery Confirm scratch vs existing design
system
Agent cannot proceed
Technical Feasibility Resolve infeasible requirement
decisions
Affected design areas blocked
Approval Gate 1 Select architecture option, UI/UX
direction, resolve feasibility, confirm
assumptions, acknowledge risks
No design work begins
During Technical Track Resolve critical open items if
escalated
Affected agents pause
Approval Gate 2 Approve technical design in
business language, resolve open
items
UI/UX track does not begin
Approval Gate 3 Review Figma prototype in GUI,
approve or request changes
Design package not dispatched to
## Component 3
Any data decision Approve any decision touching
requirements data meaning
Agent halts and waits
Any anomaly Respond to escalation System enters SafeMode

## 10.2 Internal Team Involvement
## When Who What They Must Do
## After System Architecture
## Agent
Solution Architect or
## Tech Lead
Claim, review, approve or request changes
## After Component Design
## Agent
Tech Lead or Senior
## Developer
Claim, review, approve or request changes
After Data Model Agent Architect, Tech Lead, or
## Senior Dev
Claim, review, approve or request changes
After API Design Agent Tech Lead or Senior
## Developer
Claim, review, approve or request changes
## After Integration Design
## Agent
Tech Lead or Integration
## Specialist
Claim, review, approve or request changes
## After Technical
## Documentation Agent
Project Lead and Tech
## Lead
Claim, review, final technical sign-off
## After Figma Workspace
## Agent
Tech Lead or UI/UX
## Lead
Claim, review, approve workspace
structure

SDLC Automation Suite  |  Component 2: Design Automation
Confidential  |  Architecture Document 26 of 30
After Design System Agent UI/UX Lead and Tech
## Lead
Claim, review, approve design system
## After Component Library
## Agent
UI/UX Lead or Senior
## Designer
Claim, review, approve component quality
After Screen Design Agent UI/UX Lead or Project
## Lead
Claim, review, verify requirements
coverage
After Interaction Flow Agent UI/UX Lead and Tech
## Lead
Claim, review, verify technical feasibility of
flows
After Design Review Agent Project Lead and UI/UX
## Lead
Claim, review, ensure all critical issues
resolved
After Design Package Agent Project Lead and Tech
## Lead
Claim, review, final sign-off before client
sees package



SDLC Automation Suite  |  Component 2: Design Automation
Confidential  |  Architecture Document 27 of 30
- USGE v1.0 Framework Mapping

USGE Component Component 2 Implementation
State Space (Sigma) Current design understanding, evolves from requirements through to
complete design package
Valid States (V_Sigma) Design states that satisfy all technical constraints and are internally
and client-approved
SafeMode Design process frozen, client or escalation path must intervene to
resume
Input Space (R) Requirements package from Component 1 + client design
preferences at gates
Output Space (O) Design artifacts: architecture specs, data models, APIs, Figma
components, screens, flows
Context Space (C) Session state, current track, internal review status, approval history,
Figma workspace state
Intent (I) Client-selected architecture option and UI/UX direction from Gate 1
Constraints (K) Technical feasibility limits, non-functional requirements, brand
guidelines, USGE structural rules
Policy (Pi) Agent decision logic: how to design, structure, create in Figma,
review, and package
Measurement (M) Internal review approval + client gate approval signal, quality of
current design vs requirements
Represent function Requirements Interpretation Agent: maps requirements package to
design-relevant representation
Layer 1 Safety Constraint filtering: only design decisions that satisfy technical and
requirements constraints
Layer 2 Safety Policy Consistency: agents always produce valid design state
transitions
Layer 3 Safety Post-execution validation: internal review validates every agent
output before next step
Layer 4 Safety SafeMode fallback: if validation and recovery fail, process frozen
pending intervention



SDLC Automation Suite  |  Component 2: Design Automation
Confidential  |  Architecture Document 28 of 30
## 12. Technical Stack
Component 2 uses the same on-premise stack as Component 1 with the addition of the Figma
MCP integration.

Layer Technology Role in Component 2
Frontend Angular GUI, review queue, approval flows, Figma
prototype embedding, download/upload
Figma Integration Figma MCP Server Agents create, modify, and read Figma files
programmatically
API Gateway Ocelot (.NET) Single entry point, auth enforcement,
routing
Backend .NET Orchestration, review queue management,
session management, approval workflows
Database Access ADO.NET / Dapper (no Entity
## Framework)
Raw SQL, full control
Database SQL Server Application data, review queue state, audit
trail, billing
AI / Agents Python + LangGraph All 20 agent logic implementations
LLM Providers OpenAI / Anthropic / Google /
## Mistral
Online only, same provider as Component 1
session
Message Queue RabbitMQ Component 1 → 2 handoff, agent-to-agent
communication, review queue events
Agent-Backend
## Comms
gRPC (sync) + RabbitMQ
## (async)
.NET orchestration to Python agents
Session / Cache Redis Session state, anonymization registry,
review queue cache, user model
Document Storage MinIO Technical design documents, Figma
exports, downloaded plans, audit
attachments
## Authentication Active Directory + Identity
## Server
Role-based access, reviewer authorization
per review type
Logging / Audit ELK Stack All agent actions, review decisions, Figma
operations, LLM calls
Monitoring Prometheus + Grafana System health, review queue health, agent
performance



SDLC Automation Suite  |  Component 2: Design Automation
Confidential  |  Architecture Document 29 of 30
- Handoff to Component 3

## 13.1 Design Package Contents
- Technical design document: architecture, components, data model, APIs, integrations,
decision logs
- Figma design file URL: complete, organized, published, with developer handoff
annotations
- Design specification document: design system reference, component guide, screen
inventory, interaction specs
- Developer handoff notes: implementation priorities, complex interactions, asset exports,
custom vs library
- Design assumption log: all assumptions with basis and approval status
- Traceability matrix: every design decision traced back to requirement
- Audit trail: complete session record of all decisions, reviews, and approvals
- Client approval confirmations: timestamped sign-offs at all three gates
- Internal review trail: every review decision with reviewer identity and timestamp

## 13.2 Handoff Properties
- Handoff via RabbitMQ message queue, no direct coupling between Component 2 and
## Component 3
- Design package schema-validated before dispatch
- Component 3 acknowledges receipt before Component 2 session closes
- Design package stored in MinIO for future reference by any authorized module
- Figma file remains accessible to development team throughout Component 3

## ⚠ CLIENT INVOLVEMENT REQUIRED
● Client must provide explicit final sign-off at Approval Gate 3 before handoff to
Component 3 is initiated
● Client notified when handoff is complete and Component 3 has acknowledged receipt
● Client can access design package and Figma file at any time after handoff



SDLC Automation Suite  |  Component 2: Design Automation
Confidential  |  Architecture Document 30 of 30
## Appendix: Complete Agent Summary
All 20 agents in Component 2 across 3 tracks.

## Track Agent Primary Output
Research 1. Requirements Interpretation Design requirement map, scope boundary
Research 2. Asset Discovery Asset inventory, starting point
recommendation
Research 3. Technical Feasibility Feasibility assessment, escalation list
Research 4. Architecture Options 2-3 architecture options with trade-offs
Research 5. UI/UX Strategy UI/UX direction options, screen/flow inventory
Research 6. Dependency and Integration Internal and external dependency maps
Research 7. Risk Analysis Risk register, assumption log, research
summary
Technical Design 8. System Architecture System architecture specification
Technical Design 9. Component Design Component specifications and interaction
diagram
Technical Design 10. Data Model Entity definitions, database schema, data flow
map
Technical Design 11. API Design API specifications, security model,
communication matrix
Technical Design 12. Integration Design Integration specifications, sequence flows
Technical Design 13. Technical Documentation Complete technical design document
UI/UX Design 14. Figma Workspace Figma project structure, pages, layout frames
UI/UX Design 15. Design System Design tokens, color/type/spacing in Figma
UI/UX Design 16. Component Library Complete component library in Figma
UI/UX Design 17. Screen Design All screens designed in Figma with all states
UI/UX Design 18. Interaction Flow Prototype connections, user flow diagrams
UI/UX Design 19. Design Review Audit report: consistency, completeness,
coverage
UI/UX Design 20. Design Package Complete design package ready for
## Component 3

## Next: Component 3, Development Automation Architecture.