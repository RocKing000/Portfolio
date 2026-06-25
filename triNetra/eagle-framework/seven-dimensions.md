# Seven Auditability Dimensions

The Eagle Framework evaluates deployed systems across seven dimensions. Each dimension addresses a distinct structural requirement for auditability in high-consequence AI systems.

---

## 1. Evidence Attribution

**What it evaluates:** Whether every output the system produces can be traced to specific, identifiable evidence inputs.

A system that cannot attribute its outputs to evidence cannot be audited. When a decision is challenged — by a regulator, a court, or an affected party — the organisation must be able to show not just what the system decided, but what evidence that decision was based on. Evidence Attribution measures whether that traceability is structurally built into the system, not reconstructed after the fact.

---

## 2. Decision Traceability

**What it evaluates:** Whether the path from input to output can be reconstructed step by step, without inference.

Decision Traceability is distinct from Evidence Attribution. Evidence Attribution asks: what did the system use? Decision Traceability asks: how did it get from what it used to what it decided? A system with high Evidence Attribution but low Decision Traceability can show its inputs but cannot show its reasoning chain. Under the EU AI Act, both are required.

---

## 3. Confidence Calibration

**What it evaluates:** Whether the system's expressed confidence levels correspond to its actual accuracy rates.

A system that states high confidence in outputs that are frequently wrong is structurally miscalibrated. Confidence Calibration measures the gap between stated certainty and observed accuracy across the system's deployment domain. Miscalibrated confidence is a governance risk: decisions made on the basis of high-confidence outputs carry the assumption that those outputs are reliable.

---

## 4. Counterfactual Accountability

**What it evaluates:** Whether the system can account for decisions it did not make — specifically, what would have changed if a key input had been different.

Counterfactual Accountability is a structural requirement for fairness and discrimination analysis. If a system cannot produce a credible counterfactual account, it cannot demonstrate that its outputs are free from structural bias. This dimension evaluates whether counterfactual reasoning is architecturally supported, not whether the system happens to produce fair outputs.

---

## 5. Human Oversight Readiness

**What it evaluates:** Whether meaningful human oversight of system outputs is structurally enabled — not merely permitted in policy.

A human oversight requirement that is not structurally supported by the system's architecture is not an oversight mechanism. Human Oversight Readiness evaluates whether the system produces outputs in forms that human reviewers can actually evaluate, whether review triggers are defined, and whether override mechanisms are implemented and logged.

---

## 6. Incident Reconstruction Capability

**What it evaluates:** Whether a structural failure, harmful output, or unexpected behaviour can be reconstructed after it occurs with sufficient granularity to identify root cause.

Incident Reconstruction Capability is the forensic dimension. When something goes wrong — and in high-consequence systems, things will go wrong — the organisation must be able to reconstruct what happened, why, and at which structural layer the failure originated. Systems that do not support this reconstruction cannot be governed in the aftermath of failure.

---

## 7. Audit Trail Completeness

**What it evaluates:** Whether the system maintains a complete, tamper-evident, and independently verifiable record of its operation over time.

Audit Trail Completeness is the archival dimension. It evaluates not just whether logs exist, but whether they are complete (no gaps), tamper-evident (changes are detectable), retrievable (accessible when required), and interpretable (contain sufficient context for an external party to understand what they show).
