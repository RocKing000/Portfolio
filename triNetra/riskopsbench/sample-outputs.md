# Sample Outputs

RiskOpsBench 1.0 produces three output types: the Assessment Report, the Delta Artifact, and the Progression Artifact. Live interactive samples are available on the triNetra website. The underlying JSON files are available for download.

---

## Assessment Report

The Assessment Report is the primary Insight Cycle deliverable. It covers all seven Eagle Framework dimensions, 35 pattern scores, the composite Eagle Score, maturity level classification, findings register, contradiction register, and remediation roadmap.

The sample Assessment Report is derived from the 71 pure cybersecurity domain rows of the 100-row public sample corpus. It is not derived from any client system or client manifest.

**Download sample Assessment Report (JSON):** [trinetra.life/cyber-eagle-docs](https://trinetra.life/cyber-eagle-docs)

Key values from the cybersecurity domain sample:

| Metric | Value |
|---|---|
| Scenarios evaluated | 71 |
| Overall consensus accuracy | 57.75% |
| False negative rate (malicious as legitimate) | 78.57% |
| Quality score mean | 83.57 |
| Quality score range | 67.10 – 94.79 |

The 57.75% accuracy rate is consistent with corpus design intent. The benchmark is a stress-test instrument. Scenarios are constructed to surface reasoning failures under adversarial, sensor failure, partial observability, and fragile consensus conditions. A corpus producing 90% accuracy would not stress-test the reasoning architecture.

---

## Delta Artifact

The Delta Artifact is a structural comparison between two Input Manifest versions. It identifies changes in Eagle Score across dimensions, attributes score delta to specific manifest revisions, and produces structural findings with recommendations.

The sample Delta Artifact compares two cybersecurity domain Input Manifest versions. The second version registers a +27 Eagle Score gain. The report attributes the gain to dimension-level improvements with evidence.

**View interactive sample:** [trinetra.life/manifest-comparison-sample](https://trinetra.life/manifest-comparison-sample)

The interactive sample includes: evidence taxonomy comparison, decision space comparison, observer topology comparison, dimension score comparison with score bars, and four structural findings with recommendations.

---

## Progression Artifact

The Progression Artifact tracks structural evolution across a sequence of Input Manifest submissions. It maps the trajectory from initial submission through successive iterations, identifies which dimension improvements drove each maturity level transition, and projects the path to the next maturity level.

The sample Progression Artifact covers seven iterations from L1 Opaque to L5 Assured in the Enterprise Cybersecurity Threat Operations domain.

**View interactive sample:** [trinetra.life/manifest-evolution-sample](https://trinetra.life/manifest-evolution-sample)

The interactive sample illustrates the full content and structure of a Progression Artifact produced during an Insight Cycle. It includes per-iteration dimension score development, validation error resolution history, and structural refinement guidance at each iteration.

---

## Input Manifest

The Input Manifest is the structured specification submitted by the client to initiate an Insight Cycle. The sample Input Manifest defines the cybersecurity domain parameters used to generate the sample corpus and sample Assessment Report.

**Download sample Input Manifest (JSON):** [trinetra.life/cyber-eagle-docs](https://trinetra.life/cyber-eagle-docs)

See [corpus-documentation.md](corpus-documentation.md) for the full corpus structure derived from this manifest.
