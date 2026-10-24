# StrucForge All-Member AUTO-PASS Verification

Implementation date: 2026-10-24  
Scope: beams, columns, slabs, isolated footings, and wall footings in the Full R.C. Structural Designer.

## Result contract

`AUTO-PASS VERIFIED` is issued only when the coordinated X/Y frame solution is stable, the model audit passes, the enabled search converges, and every automated mandatory design gate for the modeled structural-member families passes.

If any member cannot be resolved within the permitted dimensions or reinforcement sets, StrucForge reports its governing failure and the overall AUTO-PASS result remains unresolved. Missing supports, unstable models, incomplete load paths, invalid slab topology, and missing soil/design inputs are not concealed by increasing capacity or changing the displayed status.

## Convergent redesign sequence

1. Generate current member properties, self-weight, slab/wall loads, wind and earthquake actions.
2. Analyze every populated X- and Y-axis frame line.
3. Search practical beam dimensions, longitudinal bars, bar layers, stirrups and spacings.
4. Search monotonic column stacks using permitted section sizes, longitudinal bars, ties and spacings.
5. Search slab thicknesses and permitted bar diameters while preserving the selected slab behavior and support topology.
6. Resize and reinforce isolated footings using the converged column reactions and entered allowable soil pressure.
7. Recompute wall-footing width, thickness and reinforcement using the entered wall and soil data.
8. Regenerate changed automatic loads and member stiffness, reanalyse, and repeat until all coupled gates pass or the search limit is reached.

## Automated member gates

- **Beams:** positive/negative flexure, strain-dependent phi, minimum steel, long-span reserve when enabled, physical bar fit and layering, cover/spacing, shear, stirrup limits, selected frame-detailing zone and conservative service deflection.
- **Columns:** governing strength combinations, axial capacity, biaxial P-M-M interaction, second-order stability, minimum/maximum reinforcement, bar fit and tie spacing.
- **Slabs:** selected slab behavior, thickness, flexural reinforcement, one-way shear, panel topology and supported wall/load path.
- **Isolated footings:** service bearing/contact and eccentricity, flexure, one-way shear, punching shear and reinforcement.
- **Wall footings:** service bearing, one-way shear, flexural/minimum reinforcement and constructible standard spacing.

## Scope boundary

AUTO-PASS verifies the actions represented by the application's coordinated planar-frame and slab/footing models. Torsion is not inferred when no torsional action is supplied. Final issue-for-construction drawings, geotechnical acceptance, project-specific anchorage/splice/hook/joint detailing, and professional approval remain the responsibility of the licensed Structural or Civil Engineer identified on the project.

## Regression commands

```text
node tests/beam-engine-audit.js
node tests/beam-rebar-layout.js
node tests/drawing-navigation-stirrup-spacing.js
node tests/mpr-autopass-show-hide-browser-save.js
node tests/mpr-estimate-mix-and-scoped-autopass.js
node tests/point-load-iso-autopass-regression.js
node tests/slab-autopass-wall-footing-regression.js
node tests/all-member-autopass-verification.js
```
