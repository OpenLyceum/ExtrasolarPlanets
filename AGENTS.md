# AGENTS.md — Extrasolar Planets

Sim-specific context for AI assistants. General SceneryStack guidance: [OpenLyceum/.github/AGENTS.md](https://github.com/OpenLyceum/.github/blob/main/AGENTS.md).

## Project

SceneryStack port of the NAAP **Extrasolar Planets** lab. Two independent screens teach the radial-velocity (Doppler wobble) and transit (light-curve dip) detection methods. Architecture and formulas: [doc/model.md](doc/model.md), [doc/implementation-notes.md](doc/implementation-notes.md).

- **Radial Velocity** (`src/radial-velocity/`) — RV curve, orbit views (2-D / edge-on / Earth / pseudo-3-D), orbital and measurement controls.
- **Transit** (`src/transit/`) — normalized flux curve, sky-plane crossing visualization, planet radius control.

Shared code uses the `ExtrasolarPlanets` prefix; per-screen code uses `RadialVelocity` / `Transit`. Layout: 1024×618 px.

## Key files

| Area | Location |
|---|---|
| Screens | `src/radial-velocity/RadialVelocityScreen.ts`, `src/transit/TransitScreen.ts` |
| Models | `radial-velocity/model/RadialVelocityModel.ts`, `transit/model/TransitModel.ts`, `transit/model/EclipseGeometry.ts` |
| Shared physics | `src/common/OrbitalMechanics.ts`, `StarProperties.ts`, `RandomUtils.ts`, `Projection3D.ts` |
| Shared views | `src/common/view/chartUtils.ts`, `createNumberControl.ts`, `StarPropertiesNode.ts`, `ExtrasolarPlanetsPanel.ts` |
| Animation | `src/common/TimeModel.ts` (composed into both screen models) |
| Colors / constants | `src/ExtrasolarPlanetsConstants.ts`, `src/ExtrasolarPlanetsColors.ts` |
| Strings | `src/i18n/StringManager.ts` |
| Preferences | `src/preferences/` (empty scaffold + query params) |
| Entry | `src/main.ts` |

## Model

Two **independent** screen models — slider values do not carry between screens. Both use Keplerian two-body orbits and the same main-sequence star property chain (mass → luminosity → temperature → radius → spectral type).

| Screen | Model | Notes |
|---|---|---|
| **Radial Velocity** | `RadialVelocityModel` | Orbital sliders + noise/measurement count; derived period, amplitude *K*, theoretical curve, noisy scatter; optional four orbit perspectives driven by `phaseProperty`; default phase 0 (periapsis) |
| **Transit** | `TransitModel` + `EclipseGeometry.ts` | Adds `planetRadiusProperty`; derived eclipse depth/duration, flux curve, measurements; default phase 0.25 (mid-transit for Option A); no limb darkening |

**Shared gotchas**

- RV amplitude uses the **Flash/NAAP approximation** `a₁ = (Mp/M★)·a`, not the full reduced-mass textbook form — preserve unless porting fidelity changes.
- UI label **"Longitude"** is argument of periapsis **ω** (Flash naming).
- Simulated measurements are regenerated via `Multilink` + mutable `Property`, not `DerivedProperty`, so scatter stays stable until inputs change.
- Preset names are English proper nouns and are **not localized**; presets set orbital parameters only (not noise, measurement count, animation speed, or phase).

## Accessibility

Follows the shared [OpenLyceum accessibility convention](https://github.com/OpenLyceum/Baton/blob/main/ACCESSIBILITY.md).
Each screen registers `*ScreenSummaryContent` and `*KeyboardHelpContent`, with explicit `pdomOrder` on a wrapper `Node`. A11y strings live under `a11y.radialVelocity` and `a11y.transit` in each locale JSON, via `StringManager.getRadialVelocityA11yStrings()` / `getTransitA11yStrings()`. Keep `currentDetailsContent` live over model state; every interactive node needs an `accessibleName`.

Context responses (`a11y.*.responses`): choosing a preset announces its name with the period and K (RV) or the transit it gives (Transit), and on the Transit screen a slider change that makes the transit start or stop announces it. A preset sets its parameters one at a time, so the Transit view skips the start/stop response while `TransitModel.isApplyingPreset` is true and describes only the final state.

**Drawing conventions.** Earth is towards +z on both screens: the Side View (x, z) puts Earth at the top under a "To Earth" arrow, so a star moving down it is receding (positive RV), and the transit view draws the planet over the star only when `planetInFront` (the flux test) is true; at superior conjunction it is behind the star.

## Testing

| Path | Purpose |
|---|---|
| `vitest.config.ts` | Test environment + `setupFiles`; `execArgv: ["--expose-gc"]` with memory-leak suite |
| `tests/setup.ts` | Canvas / AudioContext mocks + `init({ name: "…" })` before SceneryStack imports |
| `tests/**/*.test.ts` | Model/physics unit tests |
| `tests/memory-leak.test.ts` | WeakRef + `forceGC` dispose regression (fleet pattern) |

| File | Covers |
|---|---|
| `OrbitalMechanics.test.ts` | Kepler period, anomalies, *K*, center velocity |
| `EclipseGeometry.test.ts` | Overlap, HD 209458 b geometry |
| `StarProperties.test.ts` | Sun, M-dwarf, spectral table |
| `RandomUtils.test.ts` | `polarGaussian` statistics |
| `Projection3D.test.ts` | Rotations, `orbitalPlanePosition` |
| `Presets.test.ts` | Preset + reset on both models; `isApplyingPreset`; depth current when the transit starts/stops |
| `TimeModel.test.ts` | Play/pause/reset |
| `manual-stepping.test.ts` | Paused step button advances one frame and wraps the orbit, both screens |
| `chartUtils.test.ts` | Chart y-range, including the ±kσ noise margin |
| `formatSignificant.test.ts` | Significant-figure readouts |
| `createNumberControl.test.ts` | Logarithmic proxy: rounding, range ends, unrounded presets, integer count, readout with units |
| `TransitVisualizationNode.test.ts` | Planet in front of the star at transit, behind it at superior conjunction |
| `OrbitViewsNode.test.ts` | Ellipses kept while the phase moves; hidden views redrawn only when shown |
| `memory-leak.test.ts` | `TimeModel` dispose + GC |

  Duration is 30s by default; override with `npm run test:fuzz -- 90` or `FUZZ_DURATION=90`.

## Development notes

- **`npm run decompile`** extracts NAAP Flash ActionScript via JPEXS FFDec from `../Baseline/Astronomy/flash-animations` into gitignored `NAAP/decompiled/`.
- Pure physics lives in `src/common/` and `EclipseGeometry.ts` with zero SceneryStack imports.
- Separate Jupiter-mass constants for RV vs Transit sliders (`RV_M_JUP_KG` vs `TRANSIT_M_JUP_KG`).
- Masses, distances, radii, noise and the RV measurement count use **logarithmic sliders**, as in
  Flash (`createNumberControl({ logarithmic: true, significantFigures })`); see design decision 7 in
  `doc/implementation-notes.md`. To check a Flash detail, run FFDec on the compiled SWFs in
  `../Baseline/Astronomy/astroUNL/naap/esp/animations/` (`npm run decompile -- --setup` fetches it).
- After `npm run build`, the sim is installable offline via Workbox (`dist/manifest.webmanifest`).
