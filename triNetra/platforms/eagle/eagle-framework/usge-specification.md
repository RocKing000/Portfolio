# USGE v2.6: Unified Scenario Generation Engine

USGE v2.6 is the deterministic corpus generation and scoring engine underlying RiskOpsBench 1.0. It generates benchmark corpora from client-provided Input Manifests and computes all Eagle Framework scores using deterministic arithmetic. No large language model or AI system is involved at any stage of corpus generation, evaluation, or scoring.

---

## Design Principle

The foundational constraint of USGE v2.6 is the elimination of circularity. Evaluating an AI system with another AI system means the measurement instrument shares the bias surface of the system under assessment. Errors in reasoning, calibration drift, and adversarial blind spots propagate identically through both evaluator and evaluated. USGE v2.6 is AI-free by design. The same Input Manifest produces the same corpus and the same scores on every evaluation run.

---

## Corpus Generation Pipeline

USGE v2.6 generates benchmark corpora in six stages:

**Stage 1: Manifest Parsing**
The Input Manifest is parsed and validated. Domain parameters, decision space definition, evidence taxonomy, observer topology, and threat catalogue are extracted.

**Stage 2: Scenario Architecture**
Scenarios are constructed from the manifest parameters. Each scenario defines a decision context with a ground-truth classification (truth label), a difficulty tier, a challenge type, and a benchmark split assignment.

**Stage 3: Observer Pool Construction**
A fixed pool of 18 observers is constructed per scenario. Each observer is assigned a base trust of 0.85 and a partial visibility profile. No observer has full visibility of all evidence in any scenario. Observer disagreement is structurally produced by the partial observability architecture, not by observer error.

**Stage 4: Evidence Object Generation**
Evidence objects are generated from the manifest's evidence taxonomy. Each evidence object carries a type, strength, hypothesis support direction (supports-malicious or supports-legitimate), and a visibility assignment across the observer pool. Hidden evidence (average 1.66 per observer) and visible evidence (average 3.32 per observer) are distributed across observers according to the partial observability design.

**Stage 5: Bayesian Scoring**
Posteriors are computed deterministically for each scenario using the Bayesian update rule:

```
posterior = (prior × LR_product) ÷ (prior × LR_product + (1 − prior))
```

The prior is domain-specific (0.19 for the cybersecurity domain). The likelihood ratio product (LR_product) is derived from the weighted combination of evidence object strengths visible to each observer. All posteriors are verified against the update rule. Zero arithmetic errors are permitted.

**Stage 6: Quality Scoring**
Each scenario receives a quality score reflecting the structural integrity of the compilation. Quality score reflects the consistency and completeness of the corpus compilation, not scenario difficulty. Quality scores are verified before the corpus is released for evaluation.

---

## Deterministic Guarantee

The same Input Manifest produces:
- The same scenario set
- The same evidence objects per scenario
- The same observer pool per scenario
- The same Bayesian posteriors
- The same Eagle Score

This is not a statistical property — it is a structural guarantee of deterministic arithmetic. Clients can independently verify the scoring chain by applying the Bayesian update rule to the counterfactual rankings map in each corpus row.

---

## Verification Protocol

Clients and auditors can independently verify USGE v2.6 output integrity through two checks:

**Posterior verification:** Apply the Bayesian update rule to each corpus row using the prior, evidence strengths, and observer visibility assignments. The resulting posterior must match the corpus-recorded posterior exactly. Zero deviation is permitted.

**Counterfactual ranking verification:** The counterfactual rankings map in each row ranks evidence objects by descending delta impact on the posterior. Verify that the ranking is correctly ordered by delta value. Zero ordering violations are permitted.

---

## Key Parameters (Cybersecurity Domain Sample)

| Parameter | Value |
|---|---|
| Engine version | USGE v2.6 |
| Observers per scenario | 18 |
| Base trust per observer | 0.85 |
| Average hidden evidence per observer | 1.66 |
| Average visible evidence per observer | 3.32 |
| Domain prior (cybersecurity) | 0.19 |
| Scoring method | Deterministic arithmetic |
| AI involvement | None at any stage |

---

## Input and Output

**Input:** Domain-specific Input Manifest (see [domain-manifest-library.md](domain-manifest-library.md))

**Output:** Benchmark corpus (CSV format) containing per-scenario fields including truth label, difficulty, challenge type, benchmark split, observer posteriors, evidence objects, counterfactual rankings map, Bayesian trace, and quality score. The corpus is the evaluation dataset for Eagle Framework scoring.
