# Model - Extrasolar Planets

This document describes the model (the underlying physics, math, and behavior) for the simulation,
in terms appropriate for an educator. It is the companion to
[implementation-notes.md](./implementation-notes.md), which targets developers.

## Overview

This sim ports the NAAP *Extrasolar Planets* lab and has two screens that teach the two main
observational methods for detecting planets around other stars. Each screen is an independent
simulator with its own state; they share physics helpers but not slider values.

- **Radial Velocity** shows the Doppler "wobble": a planet and its star orbit a shared center of mass,
  so the star's line-of-sight velocity varies over the orbit. Students adjust masses, separation,
  eccentricity, inclination, and **Longitude** (argument of periapsis ω), compare a theoretical
  velocity curve with noisy simulated measurements, and optionally view up to four orbit perspectives.
- **Transit** shows the photometric dip when a planet crosses in front of its star. Students control
  planet radius as well as orbital parameters, and see how depth and duration depend on geometry and
  stellar size. Again, a theoretical light curve can be compared with noisy simulated points.

Both screens use the same Keplerian two-body orbit and the same main-sequence mass → luminosity →
temperature → radius chain for the host star. Presets include pedagogical "Option" systems and named
exoplanets transcribed from the original Flash labs. Preset names are English proper nouns and are not
localized. Presets set orbital parameters only — not noise, measurement count, animation speed, or phase.

## The two screens

| | Radial Velocity | Transit |
|---|---|---|
| Primary signal | Semi-amplitude *K* (m/s) | Normalized flux dip |
| Extra control | Show multiple orbit views | Planet radius (RJup) |
| Default phase | 0 (periapsis) | 0.25 (mid-transit of Option A) |
| Default preset | Option A | Option A |
| Typical teaching focus | *K*, *P*, eccentricity in RV curve | Depth, duration, inclination ≈ 90° |

## Quantities and units

| Quantity | Symbol | Units | Range (approx.) |
|---|---|---|---|
| Star mass | M★ | solar masses (M☉) | RV 0.2–2; Transit 0.5–2 |
| Planet mass | Mp | Jupiter masses (MJup) | 0.001–100 |
| Planet radius (Transit) | Rp | Jupiter radii (RJup) | 0.01–2 |
| Semimajor axis | a | astronomical units (AU) | RV 0.01–10; Transit 0.015–2 |
| Eccentricity | e | — | RV 0–0.8; Transit 0–0.4 |
| Inclination | i | degrees | 0–180 (edge-on ≈ 90°) |
| Longitude (ω) | ω | degrees | 0–360 (UI label "Longitude") |
| Orbital period | P | days (derived) | from Kepler's third law |
| RV semi-amplitude | K | m/s | derived |
| Systemic RV offset | v₀ | m/s | derived: *K·e·cos ω* |
| Normalized flux (Transit) | F | — (1 = out of transit) | ≤ 1 |
| Measurement noise σ | — | m/s (RV); dimensionless flux (Transit) | slider-controlled |
| Orbital phase | φ | 0–1 (from periapsis) | animated; no phase slider in UI |
| Animation speed | — | phase per frame (scaled by dt) | 0.00001–0.001 |

Internal calculations use SI (m, kg, s); UI masses and distances use solar / Jupiter / AU units.

## Governing equations

### Keplerian two-body orbit

The relative orbit has semimajor axis *a*. Kepler's third law gives the period using the **correct total
mass**:

```
P = √( 4π² a³ / (G (M★ + Mp)) )
```

Mean anomaly advances uniformly with phase φ. Eccentric anomaly *E* is solved from Kepler's equation
`M = E − e sin E` (tolerance 1×10⁻⁸), then converted to true anomaly *ν*. Positions and velocities follow
from *ν*, *e*, and ω.

### Radial velocity

The NAAP Flash port uses a simplified barycentric amplitude (not the full reduced-mass textbook form):

```
a₁ = (Mp / M★) · a
K = (2π / P) · a₁ · sin i / √(1 − e²)
v₀ = K · e · cos ω
v(ν) = K · cos(ω + ν) + v₀
```

The theoretical curve is sampled at 201 phases over φ ∈ [0, 1].

### Transit light curve

Two disks (star and planet) are projected on the sky. Overlap area uses circle–circle geometry. Flux
uses **blackbody visual flux** with a piecewise bolometric correction; the planet is treated as a fixed
**500 K** blackbody for its tiny continuum contribution. Normalized flux equals 1 out of transit:

```
F = 1 − (overlap area × occulted visual flux) / (π r★² H★ + π r_p² H_p)
```

There is **no limb darkening**. Eclipse depth and duration follow from contact geometry (*i*, radii, *a*,
*e*, ω). Planet mass affects the period but **not** the eclipse geometry.

Like the Flash lightcurve ("eclipse of body 1" region), the chart does **not** span the whole orbit: it
zooms onto the transit with a 15 % margin on each side (window width = duration / 0.7), or onto a
±0.001-phase window around inferior conjunction (ν = 90° − ω) when there is no transit. A transit of a
few hours in a year-long orbit would otherwise be a one-pixel spike. When parameters move the window,
the phase keeps its relative position in it (mid-transit stays mid-transit), mirroring the Flash cursor.

### Host star

Main-sequence (class V) properties derive from stellar mass alone: luminosity (broken power law),
temperature (piecewise fit in log *L*), radius (Stefan–Boltzmann), spectral type (temperature table) —
matching the NAAP Flash chain.

### Noise and measurements

Optional scatter points add Gaussian noise (σ from the noise slider) at random orbital phases. RV
measurements draw uniform random **mean anomalies** (not uniform in phase when *e* &gt; 0); transit
measurements draw uniform random **phase inside the displayed transit window**. Default: theoretical curve **on**, simulated measurements
**off**. Measurements regenerate when physics inputs, noise, or count change.

## Simplifications and assumptions

- Strict **two-body** Keplerian motion; no third bodies, tides, or stellar activity jitter.
- Host star is always **main-sequence**; evolution is not modeled.
- Transit: no limb darkening; planet *T* = 500 K fixed.
- Inclination 0° is face-on (no RV signal / no transit); 90° is edge-on.
- **Flash-faithful constants**: *G* = 6.673×10⁻¹¹; separate Jupiter-mass conversion per screen; RV *a₁*
  uses *Mp/M★* ratio as above (not full barycenter reduced mass).
- Kepler solver tolerance is tighter than Flash (1×10⁻⁸ vs 1×10⁻³), same algorithm.
- Changing a slider does **not** deselect the preset combo (PhET-style). Reset All restores all
  properties including preset selection.

## References

- NAAP *Extrasolar Planets* lab (student guide and modeling pages under `../Baseline/Astronomy/astroUNL/naap/`).
- Original Flash simulators: *Radial Velocity Simulator* (`radialVelocitySimulator012`) and
  *Transit Simulator* (`transitSimulator017`).
