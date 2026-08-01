# Assessment Lifecycle

Eagle Insight Platform is retired as a commercial offering; this describes how an assessment worked, as a reference for what the Eagle Framework's evaluation process produces. triNetra's current commercial offer is Framework Building — applying PaaF directly so an organisation builds its own governing component, rather than receiving a fixed assessment product. See [trinetrarv.com/engage](https://trinetrarv.com/engage).

An assessment ran from Input Manifest submission through report delivery, in five structural stages.

---

## 1. Domain Classification and Manifest Template

The system under assessment was classified against the Eagle Framework's 30-domain library. The appropriate domain-specific Input Manifest template was delivered. For systems spanning multiple domains or falling outside the library, a generic template was provided.

---

## 2. Input Manifest Completion

The client completed the Input Manifest: a structured specification defining the system under assessment across the following fields:

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

## 3. Manifest Validation

The submitted Input Manifest was validated against structural requirements before evaluation began. Validation checks included field completeness, domain compatibility, evidence taxonomy consistency, and decision space definition. A validated manifest was a prerequisite for evaluation.

---

## 4. Structural Evaluation and Scoring

The validated Input Manifest was evaluated across all seven Eagle Framework dimensions, deterministically. Each dimension was scored independently. Pattern scores aggregated to dimension scores; dimension scores aggregated to the composite Eagle Score (0–100) using domain-specific weighting parameters. The same manifest produced the same Eagle Score on every evaluation.

See [seven-dimensions.md](seven-dimensions.md) for dimension definitions and [scoring.md](scoring.md) for the full scoring model.

---

## 5. Report Delivery

The Assessment Report was generated from the scored evaluation: Eagle Score, maturity level classification, dimension-level scores with evidence chains, findings register, contradiction register, and remediation roadmap.

See [organisation-intelligence/what-you-receive.md](../organisation-intelligence/what-you-receive.md) for full report contents.

---

## Framework Limitations

The Eagle Framework evaluates auditability as a structural property. It does not evaluate:

- Output accuracy, capability, or performance
- Safety alignment or ethical posture
- Compliance status against any specific regulatory framework
- Security posture or vulnerability profile
- Vendor claims or marketing representations

Eagle Scores are point-in-time. A score reflects the system's structural auditability at the time of assessment against the submitted Input Manifest. Scores from assessments with different scopes or domain configurations are not directly comparable. An Eagle Score is not a certification.
