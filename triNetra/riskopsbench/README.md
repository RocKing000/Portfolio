# RiskOpsBench 1.0

RiskOpsBench 1.0 is a domain-agnostic benchmark corpus and scoring engine for evaluating AI reasoning quality under the conditions that high-consequence operational environments impose.

---

## What It Evaluates

Standard AI benchmarks measure output accuracy on well-defined tasks under clean conditions. RiskOpsBench evaluates reasoning quality under the conditions that make high-consequence deployments structurally different from benchmark environments:

| Condition | Description |
|---|---|
| **Uncertainty** | Incomplete or ambiguous information where the correct answer is not determinable from available inputs |
| **Partial observability** | The system cannot access the full state of the environment it is operating in |
| **Conflicting signals** | Inputs that point in contradictory directions |
| **Adversarial obfuscation** | Deliberate attempts to manipulate system outputs through prompt construction or input manipulation |

---

## Scoring

**Total Epistemic Reasoning Score (TERS)**
A composite score measuring the evaluated system's reasoning quality across all challenge types and difficulty partitions.

**Expected Calibration Error (ECE)**
A measure of the gap between the system's expressed confidence and its actual accuracy rate across the corpus. A system with high ECE is structurally miscalibrated. It expresses certainty in outputs that are frequently wrong.

No large language model is involved at any stage of corpus generation or scoring.

---

## Challenge Types

| Type | Description |
|---|---|
| Direct scenario evaluation | Straightforward domain scenario with a structurally demanding correct response |
| Narrative and persona-embedded | Scenario embedded in a narrative or persona context to test reasoning stability |
| Minimalist prompt | Scenario with minimal framing to test whether the system can reason without scaffold |
| Noise perturbation | Scenario with introduced irrelevant or misleading information |
| Adversarial signal injection | Scenario with deliberate contradictory or manipulative inputs |

---

## Difficulty Partitions

EASY · MEDIUM · HARD · EXPERT\_ONLY

---

## Partner API

The RiskOpsBench scoring engine is available to partners through an API. Contact research@trinetra.life with subject line **Partner API Inquiry**.

Full documentation: [trinetra.life/cyber-eagle-docs](https://trinetra.life/cyber-eagle-docs)
