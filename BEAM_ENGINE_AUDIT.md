# StrucForge R.C. Beam Engine Audit

Audit date: 2026-10-24  
Scope: beam analysis/design path in `index.html`, the MPR beam schedule, AUTO-PASS candidate selection, and regression tests.

## Executive assessment

The current engine already used separate positive/negative moment envelopes, multi-layer reinforcement, centroid-based effective depth, strain-dependent strength reduction, flexure/shear/deflection checks, and cost-ranked AUTO-PASS candidates. The audit found and corrected two important defects:

1. Longitudinal-bar fit used only `max(25 mm, db)` and did not include maximum aggregate size or a placement tolerance.
2. Special seismic end-zone rules were inferred from the seismic response factor `R`, which is not a valid substitute for an explicit frame classification.

The app now asks for the maximum aggregate size and the beam frame classification. Bar layouts are checked using the available inside width, aggregate-controlled horizontal and vertical clear spacing, a 5 mm placement tolerance, a maximum of two layers, and the centroid of the actual layer arrangement. Ordinary/gravity framing no longer receives special end-zone detailing simply because a high response factor is present.

The result remains a preliminary design aid. Torsion, development/anchorage, splice locations, hook geometry, and beam-column joint congestion are disclosed as **INCOMPLETE / NOT VERIFIED** until project-specific inputs and verified governing-code rules are added. No unverified NSCP clause number is claimed.

## Engine inventory and formula comparison

| Area | Previous implementation | Audited implementation | Location | Result |
|---|---|---|---|---|
| Effective depth | Single- or two-layer centroid was used, but the layer spacing omitted aggregate size | Centroid of the actual `layerCounts`, with vertical clear spacing controlled by 25 mm, `db`, or `4/3` aggregate size | `beamBarLayout`, `beamBarCentroidDepth`, `beamFlexuralResponse` | Corrected |
| Bar fit | Inside width and `max(25, db)` spacing | Inside width includes cover, stirrup and 5 mm tolerance; clear spacing includes aggregate; actual spacing and vertical package depth are checked | `beamBarLayout`, `beamFlexuralResponse` | Corrected |
| Flexural strength | `a = As fy /(0.85 fc' b)` and `Mn = As fy(d-a/2)` | Retained, with steel strain and strain-dependent phi checked for every candidate | `beamFlexuralResponse` | Verified for singly reinforced rectangular sections |
| Strength reduction | Strain-dependent 0.65–0.90 transition already present | Retained and covered by independent tests | `beamStrengthReductionFactor` | Verified numerically; exact NSCP reference unverified in repository |
| Positive/negative design | Positive and negative envelopes selected independently | Retained; support top and midspan bottom follow separate candidates | `beamDemandEnvelope`, `evaluateBeamCandidate` | Verified at envelope level; left/right section-specific output remains a future enhancement |
| Shear | `Vc = 0.17 sqrt(fc') bw d`, two-leg stirrup `Vs`, strength and spacing limits | Retained; strength, ordinary maximum and classified seismic support limits remain separate | `beamStirrupSpacingLimits`, `evaluateBeamCandidate` | Verified numerically; probable-moment shear remains not verified |
| Seismic detailing | Special rules inferred when `max(Rx,Ry) >= 8` | Explicit Gravity/Ordinary/Intermediate/Special beam frame classification | `normalizedBeamFrameClassification`, `beamStirrupSpacingLimits` | Corrected |
| Serviceability | Conservative D+L deflection with cracked inertia modifier and L/240 limit | Retained | `conservativeBeamServiceDeflection` | Preliminary; long-term multiplier/camber inputs remain outside current scope |
| AUTO-PASS | Searches practical beam sizes and bar/stirrup alternatives, then ranks passing candidates by cost | Uses the corrected constructibility and classification checks | `evaluateBeamCandidate`, `optimizeBeamSections` | Improved |

## Supplied reference-beam comparison

The following independent illustration uses the prompt's permitted fallback assumptions only: `fc' = 21 MPa`, `fy = 415 MPa`, 40 mm cover, D10 stirrups, D16 main bars, 20 mm maximum aggregate, and 5 mm placement tolerance. These values are not silently substituted for a saved project's actual inputs.

| Beam | Existing D/C | Corrected illustrative D/C | Actual layers | phi | Preliminary flexural result | Final classification |
|---|---:|---:|---:|---:|---|---|
| B3-2-AB | 0.99 | 1.263 | 2+2 | 0.789 | FAIL | FAIL — capacity after corrected centroid/phi |
| B3-2-BC | 0.88 | 1.123 | 2+2 | 0.789 | FAIL | FAIL — capacity after corrected centroid/phi |
| B3-2-CD | 0.83 | 1.160 | 2+2 | 0.731 | FAIL | FAIL — capacity after corrected centroid/phi |
| TB1-2-AB | 0.82 | 0.918 | 2+1 | 0.900 | Preliminary pass | INCOMPLETE / NOT VERIFIED — anchorage/torsion/joint details |
| TB1-2-CD | 0.85 | 0.868 | 2 | 0.900 | Preliminary pass | INCOMPLETE / NOT VERIFIED — anchorage/torsion/joint details |

The 200 mm beams cannot place 4-D16 in one layer under the audited inputs. The program arranges them as 2+2 and recalculates `d`, steel strain, phi, capacity, and D/C. B3-2-AB therefore changes from the displayed 0.99 to an illustrative 1.263 and must be resized or reinforced using a constructible alternative followed by frame reanalysis.

## Rectification summary

- Added project inputs for maximum aggregate size, reinforcement-cage placement tolerance, and beam frame classification; all are saved with the project controls.
- Added aggregate- and tolerance-aware horizontal spacing, vertical layer spacing, actual layer counts, and explicit fit-failure reasons.
- Removed response-factor-based selection of special beam stirrup detailing.
- Expanded beam calculation tooltips with actual layers, clear spacing, required spacing, effective depth, tensile strain, phi, flexural D/C, shear D/C, deflection D/C, and the governing frame classification.
- Added 15 automated audit scenarios plus independent recalculation of all five supplied reference beams.
- Preserved the existing economical search while forcing every candidate through the corrected fit, flexure, shear, ductility and serviceability checks.

## Remaining mandatory engineering work

The following cannot honestly be reported as code-compliant PASS from the inputs presently available:

- torsion demand and torsional reinforcement;
- development length, anchorage into supports, and bar cutoff extensions;
- lap-splice locations and lengths;
- hook configuration and beam-column joint congestion;
- earthquake probable-moment shear where required;
- verified NSCP 2015 section references from an authorized project code source;
- separate left-support, midspan and right-support report rows for every moment reversal.

These are identified as incomplete rather than assigned invented values or code clauses. Final design and construction documents require review and approval by the licensed structural engineer of record.

## Regression evidence

Run:

```text
node tests/beam-engine-audit.js
node tests/beam-rebar-layout.js
node tests/drawing-navigation-stirrup-spacing.js
node tests/mpr-autopass-show-hide-browser-save.js
```

The audit suite covers the 15 requested scenario classes and the five supplied beams. It derives the corrected outcomes from the equations and inputs; it does not hard-code their PASS statuses.
