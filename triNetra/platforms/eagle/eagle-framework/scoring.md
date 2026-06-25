# Eagle Score and Maturity Levels

The Eagle Framework produces a composite Eagle Score from 0 to 100 and assigns one of five maturity levels based on that score.

---

## Eagle Score

The Eagle Score is a composite numerical score from 0 to 100 representing the system's overall structural auditability across all seven Eagle Framework dimensions.

The score is **deterministic**: the same Input Manifest produces the same Eagle Score on every evaluation. It is **mathematically verifiable**: the scoring chain from dimension findings to composite score can be independently reproduced.

No large language model or AI system participates in scoring at any stage.

---

## Five Maturity Levels

| Level | Name | Score Range | Interpretation |
|---|---|---|---|
| L1 | Opaque | 0 – 19 | The system's decision-making process is structurally inaccessible to external review. Auditability is not architecturally supported. |
| L2 | Observable | 20 – 39 | Outputs are visible but the reasoning chain is not reconstructable. Partial logging exists. Human oversight is policy-level rather than structurally enforced. |
| L3 | Traceable | 40 – 59 | Decision paths can be partially reconstructed. Evidence attribution exists for major outputs. Incident reconstruction is possible for some failure classes. |
| L4 | Auditable | 60 – 79 | The system meets a governance-grade structural standard. Evidence attribution, decision traceability, and audit trail completeness are structurally enforced. Counterfactual reasoning is supported. |
| L5 | Assured | 80 – 100 | The system is structurally assured against adversarial evaluation across all seven dimensions. Human oversight mechanisms are fully implemented, incident reconstruction capability is complete, and confidence calibration is structurally verified. |

---

## How Composite Scoring Works

Each of the seven dimensions is evaluated independently, producing a dimension score. The composite Eagle Score is derived from the weighted combination of dimension scores.

Dimension weightings reflect the relative structural consequence of each dimension within the system's deployment domain. A cybersecurity system has a different weighting profile than a healthcare diagnostic system. Domain-specific Input Manifest templates carry the weighting parameters appropriate to each domain.

---

## Score Comparability

Because the methodology is deterministic and the weighting parameters are domain-specific, Eagle Scores are comparable:

- Across time: the same system assessed in consecutive cycles produces directly comparable scores
- Across the portfolio: companies in the same domain assessed against the same Reference Manifest produce directly comparable scores
- Against the institutional standard: Alignment Scores measure the gap between a company's Eagle Score profile and the Reference Manifest's required profile
