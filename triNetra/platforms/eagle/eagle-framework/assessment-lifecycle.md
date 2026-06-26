# Assessment Lifecycle

An Eagle Insight Platform Insight Cycle runs from initial engagement through report delivery. The lifecycle has ten phases.

---

## Phase 1: Intake

The client contacts research@trinetra.life. No intake form. No qualification call. The client provides: deployment domain, system under assessment, and deployment context. triNetra confirms domain coverage and begins onboarding.

---

## Phase 2: Onboarding

Platform Access (USD 3,999, one-time) covers onboarding configuration, Research Catalogue setup, and access to the triNetra Research Studio. This phase is completed once and does not repeat for subsequent Insight Cycles.

---

## Phase 3: Domain Classification and Manifest Template Delivery

The system under assessment is classified against the Eagle Framework's 30-domain library. The appropriate domain-specific Input Manifest template is delivered. For systems spanning multiple domains or falling outside the library, a generic template is provided.

---

## Phase 4: Input Manifest Completion

The client completes the Input Manifest. The Input Manifest is a structured specification defining the system under assessment across the following fields:

| Field | Description |
|---|---|
| Deployment domain | The domain in which the system operates |
| Decision space | Scope of consequential outputs the system produces |
| Architecture | Structural design of the system |
| Data dependencies | Data sources the system relies on |
| Human oversight configuration | How human oversight is configured |
| Logging and traceability setup | How outputs and decisions are logged and traced |
| Incident response posture | The system's approach to incident detection and response |

---

## Phase 5: Manifest Validation

The submitted Input Manifest is validated against structural requirements before corpus generation begins. Validation checks include field completeness, domain compatibility, evidence taxonomy consistency, and decision space definition. Validation errors are returned to the client for correction. A validated manifest is a prerequisite for corpus generation.

---

## Phase 6: Corpus Generation

The validated Input Manifest is processed by the USGE v2.6 engine (Unified Scenario Generation Engine). USGE v2.6 generates the benchmark corpus deterministically from the manifest parameters. No large language model or AI system is involved at any stage. The same manifest produces the same corpus on every evaluation.

See [usge-specification.md](usge-specification.md) for engine detail.

---

## Phase 7: Structural Evaluation

The benchmark corpus is evaluated across all seven Eagle Framework dimensions. Each dimension is scored independently. The evaluation tests structural resilience under epistemic uncertainty, partial observability, conflicting signals, and adversarial obfuscation.

See [seven-dimensions.md](seven-dimensions.md) for dimension definitions.

---

## Phase 8: Scoring

Observations aggregate to pattern scores across 35 Eagle Framework patterns. Pattern scores aggregate to dimension scores. Dimension scores aggregate to the composite Eagle Score (0–100) using domain-specific weighting parameters. The same manifest produces the same Eagle Score on every evaluation.

See [scoring.md](scoring.md) for the full scoring model.

---

## Phase 9: Report Generation

The Assessment Report is generated from the scored evaluation. The report contains: Eagle Score, maturity level classification, dimension-level scores with evidence chains, findings register, contradiction register, and remediation roadmap. The Evaluation Package (evaluation dataset, grading key, prompt template) is retained by the evaluating party.

See [organisation-intelligence/what-you-receive.md](../organisation-intelligence/what-you-receive.md) for full report contents.

---

## Phase 10: Delivery and Decision Support

The Assessment Report is delivered to the client. The remediation roadmap specifies structural improvements by dimension, ordered by severity, with projected maturity level impact for each item. Decision support is available through the triNetra Research Studio for clients requiring interpretation of specific findings.

---

## Framework Limitations

The Eagle Framework evaluates auditability as a structural property. It does not evaluate:

- Output accuracy, capability, or performance
- Safety alignment or ethical posture
- Compliance status against any specific regulatory framework
- Security posture or vulnerability profile
- Vendor claims or marketing representations

Eagle Scores are point-in-time. A score reflects the system's structural auditability at the time of assessment against the submitted Input Manifest. Scores from assessments with different scopes or domain configurations are not directly comparable. An Eagle Score is not a certification.
