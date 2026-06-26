# RiskOpsBench 1.0

RiskOpsBench 1.0 is a domain-agnostic benchmark corpus and evaluation engine for testing AI reasoning quality under the conditions that high-consequence operational environments impose.

The corpus is generated and scored by the USGE v2.6 (Unified Scenario Generation Engine), a deterministic arithmetic engine. No large language model or AI system is involved at any stage of corpus generation or scoring. The same Input Manifest produces the same corpus and the same scores on every evaluation.

---

## What It Evaluates

Standard AI benchmarks measure output accuracy on well-defined tasks under clean conditions. RiskOpsBench evaluates reasoning quality under the conditions that define high-consequence deployments:

| Condition | Description |
|---|---|
| **Partial observability** | No observer has full visibility of all evidence in any scenario. Observer disagreement is structurally produced, not introduced by observer error. |
| **Conflicting signals** | Evidence objects point in contradictory directions. Correct classification requires resolving the conflict, not averaging it. |
| **Adversarial obfuscation** | Surface signals are deliberately constructed to support the incorrect classification. Systems that follow observable consensus without independent evidence attribution will systematically fail. |
| **Sensor failure** | Critical evidence is masked across specific observer nodes. Fallback reasoning is required. |
| **Uncertainty amplification** | Posterior distributions are volatile. Confidence architecture must be structurally calibrated. |

---

## Scoring

**Eagle Score**
The Eagle Framework evaluates the assessed system's reasoning quality across seven auditability dimensions. Each dimension produces a dimension score. The composite Eagle Score (0–100) is derived from weighted dimension scores using domain-specific parameters.

**Maturity Level**
The Eagle Score maps to one of five maturity levels: L1 Opaque (0–19), L2 Observable (20–39), L3 Traceable (40–59), L4 Auditable (60–79), L5 Assured (80–100).

No large language model or AI system participates in evaluation or scoring at any stage.

---

## Challenge Types

The RiskOpsBench corpus uses seven structurally distinct challenge types:

| Challenge Type | Description |
|---|---|
| **Deception** | Surface signals support the incorrect classification. Correct outcome requires evidence attribution below the surface signal layer. |
| **Fragile Consensus** | Majority observer agreement supports the incorrect classification. Systems that follow consensus without independent evidence verification will fail. |
| **Evidence Conflict** | Evidence objects point in contradictory directions. Correct classification requires weighted resolution by source reliability. |
| **Partial Observability** | Observer visibility gaps create structural blind spots. Reasoning about unobserved evidence is required. |
| **Sensor Failure** | Critical evidence is masked across specific observer nodes. Fallback reasoning architecture is required. |
| **Uncertainty Spike** | Posterior distributions are volatile. Confidence architecture must be calibrated to signal uncertainty, not output certainty. |
| **Standard Baseline** | Structurally simple cases with clean signals. Below-chance performance on this type is the strongest negative signal in an assessment. |

---

## Difficulty Partitions

EASY · MEDIUM · HARD · EXPERT

Difficulty reflects structural complexity of the scenario, not intuitive difficulty. EXPERT scenarios often carry cleaner signal structure beneath high complexity. Systems with strong evidence attribution and counterfactual reasoning capability resolve them more reliably than MEDIUM or HARD scenarios, which require resolving structural ambiguity under degraded signal conditions.

---

## Benchmark Splits

| Split | Purpose |
|---|---|
| **adversarial_test** | Surface signals specifically constructed to support the incorrect classification. Tests whether the system can identify when consensus is wrong. |
| **long_tail_imbalance** | Severe class imbalance (~87.5% legitimate, ~12.5% malicious). Accuracy alone is not a valid performance metric on this partition. |
| **test** | Standard partition for baseline comparison. |

---

## Observer Architecture

Each scenario is evaluated by a fixed pool of 18 observers. Each observer has a base trust of 0.85 and partial visibility of the available evidence. No observer has full visibility of all evidence in any scenario. Observer disagreement is structurally produced by the partial observability design, not by observer error.

Systems that follow majority observer consensus without independent evidence verification will systematically fail adversarial and fragile consensus scenarios.

---

## Partner API

The RiskOpsBench scoring engine is available to partners through an API. Contact research@trinetra.life with subject line **Partner API Inquiry**.

Interactive sample outputs: [trinetra.life/cyber-eagle-docs](https://trinetra.life/cyber-eagle-docs)
