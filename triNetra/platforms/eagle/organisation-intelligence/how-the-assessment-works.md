# How the Assessment Works

The assessment process has three steps: Input Manifest submission, structural evaluation by the Eagle Framework engine, and delivery of the Assessment Report.

---

## Step 1 — Input Manifest

The assessed entity provides an Input Manifest: a structured specification defining the system under assessment. The Input Manifest covers:

- The system's deployment domain
- Its decision space and scope of consequential outputs
- Its structural characteristics: architecture, data dependencies, human oversight configuration, logging and traceability setup, and incident response posture

A domain-specific Input Manifest template is available for each of the 30 Eagle Framework high-risk domains. A generic template is also available for systems that span multiple domains or fall outside the catalogue.

Templates are available at [trinetra.life/cyber-eagle-docs](https://trinetra.life/cyber-eagle-docs).

---

## Step 2 — Structural Evaluation

The Eagle Framework assessment engine evaluates the submitted Input Manifest across seven auditability dimensions. The engine tests structural resilience under:

- Epistemic uncertainty
- Partial observability
- Conflicting signals
- Adversarial obfuscation

**No large language model or AI system participates in evaluation or scoring at any stage.** The methodology is deterministic and mathematically verifiable. The same Input Manifest produces the same Eagle Score on every evaluation.

---

## Step 3 — Assessment Report Delivery

The Assessment Report is delivered upon completion of evaluation. The Evaluation Package — containing the evaluation dataset, grading key, and prompt template — is retained by the evaluating party.

---

## What It Is Not

The assessment does not produce implementation recommendations, vendor suggestions, or technology roadmaps. It produces a structural diagnosis: where the system stands, where it fails, and what needs to change at the structural level for the maturity level to improve.

---

## Self-Validation

To verify independently that the Eagle Framework produces outputs a large language model cannot replicate:

1. Ask any LLM to assess a deployed AI system using the seven Eagle Framework dimensions. Request structured output with observations against each dimension. Retain the output.
2. Download the sample Assessment Report from [trinetra.life/cyber-eagle-docs](https://trinetra.life/cyber-eagle-docs). Provide it to the same LLM alongside Step 1 output. Ask it to identify every element present in the sample report that is absent from its own output.

The model will identify what it cannot produce without a structural assessment engine: deterministic pattern scores, a counterfactual ranking map, a contradiction register, adversarial split benchmark results, the evidence weighting chain, and a scored remediation roadmap.
