# Implementation Notes - Extrasolar Planets

Developer-facing notes on the architecture. Educator-facing physics are in [model.md](./model.md).

## Architecture Overview

Two independent screens, each a standard `Screen<Model, ScreenView>` pairing. Screens share no model
state; they share physics helpers, themed panels, and i18n/colors.

```
src/main.ts                          Sim + PreferencesModel + screen registration
src/ExtrasolarPlanetsConstants.ts    SI physics, slider ranges, presets
src/ExtrasolarPlanetsColors.ts       ProfileColorProperty (default + projector)
src/ExtrasolarPlanetsNamespace.ts

src/radial-velocity/
  RadialVelocityScreen.ts
  model/RadialVelocityModel.ts
  view/RadialVelocityScreenView.ts       layout coordinator
  view/RadialVelocityChartNode.ts
  view/OrbitViewsNode.ts                 1 or 4 perspectives via Projection3D
  view/RadialVelocityControlPanel.ts
  view/RadialVelocityScreenSummaryContent.ts
  view/RadialVelocityKeyboardHelpContent.ts

src/transit/
  TransitScreen.ts
  model/TransitModel.ts
  model/EclipseGeometry.ts               pure transit physics (Flash Lightcurve port)
  view/TransitScreenView.ts
  view/TransitChartNode.ts
  view/TransitVisualizationNode.ts
  view/TransitControlPanel.ts
  view/TransitScreenSummaryContent.ts
  view/TransitKeyboardHelpContent.ts

src/common/
  OrbitalMechanics.ts                    Kepler + RV helpers (unit-tested)
  StarProperties.ts                      mass → L, T, R, spectral type (unit-tested)
  TimeModel.ts                           play/pause + elapsed time (composed)
  RandomUtils.ts                         Marsaglia-polar Gaussian
  Projection3D.ts                        RV 3-D view math only
  ExtrasolarPlanetsPanel.ts
  ExtrasolarPlanetsButtonOptions.ts      flat button bundles
  view/chartUtils.ts, createNumberControl.ts, StarPropertiesNode.ts

src/preferences/
  ExtrasolarPlanetsPreferencesModel.ts   empty scaffold
  ExtrasolarPlanetsPreferencesNode.ts
  extrasolarPlanetsQueryParameters.ts    no params yet
```

**Layout** (1024×618): top row — square viz (`ORBIT_VIEW_SIZE`) + gap + chart (`CHART_VIEW_WIDTH`×`CHART_VIEW_HEIGHT`); bottom full-width `ExtrasolarPlanetsPanel` control strip; `TimeControlNode` under viz; `ResetAllButton` bottom-right.

Data flows Model → View via AXON `Property` / `DerivedProperty` / `Multilink`. Models implement `TModel`; no view imports in model code.

## Model components

### RadialVelocityModel

| Category | Properties |
|---|---|
| Orbital controls | `planetMassProperty`, `starMassProperty`, `semimajorAxisProperty`, `eccentricityProperty`, `inclinationProperty`, `longitudeProperty` (ω) |
| Measurement | `noiseProperty`, `numberOfMeasurementsProperty` |
| View toggles | `showTheoreticalCurveProperty`, `showSimulatedMeasurementsProperty`, `showMultipleViewsProperty` |
| Animation | `timer: TimeModel`, `phaseProperty`, `animationSpeedProperty` |
| Preset | `presetProperty` → `applyPreset()` |
| Derived | `starPropertiesProperty`, `periodSecondsProperty`, `periodDaysProperty`, `amplitudeProperty`, `centerVelocityProperty`, `theoreticalCurveProperty`, `measurementsProperty` |

`step(dt)`: `timer.step(dt)`; if playing, `phase += animationSpeed × dt × 60`, wrap mod 1.

RV amplitude uses Flash approximation `a₁ = (Mp/M★)·a` in `amplitudeProperty` (see comment ~line 160).

### TransitModel + EclipseGeometry

Same orbital/measurement pattern plus `planetRadiusProperty`. Assembles `TransitSystem`; derived:
`eclipseIntervalProperty`, `eclipseDepthProperty`, `eclipseDurationHoursProperty`, `fluxCurveProperty`,
`measurementsProperty`.

Key `EclipseGeometry` exports: `bolometricCorrection`, `blackbodyVisualFactor`, `circleCircleOverlapArea`,
`projectedSeparation`, `normalizedFluxAtPhase`, `findEclipseInterval`, `eclipseDepth`.

### Shared pure modules

- **`OrbitalMechanics.ts`**: `keplerPeriodSeconds`, anomaly conversions, `radialVelocityAmplitude`, `centerVelocity`, `radialVelocityAtTrueAnomaly`.
- **`StarProperties.ts`**: `deriveStarProperties`, `SPECTRAL_TYPES_AND_TEMPS_V`.
- **`RandomUtils.ts`**: `polarGaussian(mean, stdDev, nextDouble?)` — production `dotRandom`; tests inject sequences.

Constants/presets: `RADIAL_VELOCITY_PRESETS` (7), `TRANSIT_PRESETS` (11); separate `RV_M_JUP_KG` vs `TRANSIT_M_JUP_KG`.

## Key design decisions

1. **Flash fidelity over textbook physics** for RV *a₁* and orbit-view mass ratio — document before "fixing."
2. **Measurements via `Multilink` + mutable `Property`**, not `DerivedProperty`, so scatter is stable until inputs change.
3. **Preset `lazyLink`** on construction; slider edits do not sync combo backward.
4. **`longitudeProperty` = ω** — NAAP/Flash naming preserved in UI strings.
5. **Pure physics in `common/` and `EclipseGeometry.ts`** — zero SceneryStack imports.
6. **Independent screen models** — no shared root model.

## Common components

- `ExtrasolarPlanetsPanel` — pre-themed panel.
- `ExtrasolarPlanetsButtonOptions` — Reset, TimeControl, NumberControl flat bundles.
- `createNumberControl`, `chartUtils`, `StarPropertiesNode`.

## Disposal

Both screens' models and views, including every `DerivedProperty`, `PatternStringProperty` and `Multilink` they create, are built once and live as long as the sim. Their links connect objects that are torn down together (never), so nothing is unlinked and those classes have no `dispose()`. `TimeModel.dispose()` exists and is covered by `tests/memory-leak.test.ts`. Anything created and removed at runtime would need cleanup; this sim has none.

## Testing

```
npm test   # vitest run, --expose-gc for memory-leak suite
```

| File | Covers |
|---|---|
| `OrbitalMechanics.test.ts` | Kepler period, anomalies, *K*, center velocity |
| `EclipseGeometry.test.ts` | Overlap, HD 209458 b geometry |
| `StarProperties.test.ts` | Sun, M-dwarf, spectral table |
| `RandomUtils.test.ts` | polarGaussian statistics |
| `Projection3D.test.ts` | Rotations, orbitalPlanePosition |
| `Presets.test.ts` | Preset + reset on both models |
| `TimeModel.test.ts` | play/pause/reset |
| `memory-leak.test.ts` | `TimeModel` dispose + GC |

Not tested: full derived curves end-to-end, view nodes, chart scaling.

## Multi-screen

Independent-state pattern — see [SceneryStackTemplate `doc/multi-screen.md`](https://github.com/OpenLyceum/SceneryStackTemplate/blob/main/doc/multi-screen.md).
