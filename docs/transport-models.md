# Dielectric IMFP and effective attenuation length

The numerical modules `assets/js/dielectric.js` and `assets/js/effective-depth.js` do not depend on the DOM. Both are consumed by static pages; no data is uploaded. `site-menu.js` provides a two-entry disclosure menu, including keyboard Escape and outside-click closing, plus the IMFP / EAL view switch and shared language button.

## Optical loss input and Penn SPA

Default input is a two-column table of loss energy in eV and the dimensionless optical energy-loss function `L0(ω) = Im[−1/ε(0,ω)]`. Comma, tab, or whitespace separators, optional energy headers, and `#` comments are supported. An alternative three-column ε₁/ε₂ format is converted using `L0 = ε₂/(ε₁² + ε₂²)`. Energies must be strictly increasing and nonnegative; ELF must be nonnegative with at least one positive value. Limits are 1 MB and 2000 points. Values between supplied points are linearly interpolated.

The user-supplied [Shinotsuka et al. compound paper](https://pmc.ncbi.nlm.nih.gov/articles/PMC7047655/) uses the **Full Penn algorithm (FPA)**. This implementation instead uses its simpler nonrelativistic **single-pole approximation (SPA)**, explicitly labeled on screen and in exports. It does not claim to reproduce that paper's FPA tables or relativistic 200 keV results. It uses the pole dispersion of [Shinotsuka et al., liquid-water study, Eqs. 7–8](https://pmc.ncbi.nlm.nih.gov/articles/PMC5524379/).

In atomic units (Hartree = 27.211386245988 eV, Bohr radius = 0.0529177210903 nm):

```
g(wp) = 2 L0(wp) / (π wp)
ELF_pole(q,w;wp) = π wp²/(2 wq) δ(w − wq)
wq² = wp² + kF² q²/3 + q⁴/4
kF = (3π/4)^(1/3) wp^(2/3)

λ⁻¹ = 1/(π T′) ∫dwp L0(wp) ∫dq/q (wp/wq)
```

The last expression integrates the delta function over loss energy first, avoiding discretization of a delta peak. The inner interval must satisfy `Eg ≤ wq ≤ E` and `wq ≤ sqrt(2T′)q − q²/2`. The code finds the two kinematic roots by bisection, intersects them with the loss bounds, and integrates over log(q) with 16-point Gauss–Legendre quadrature. Optical intervals are subdivided to widths no larger than max(1 eV, 12% of their lower energy), then integrated with 8-point Gauss–Legendre quadrature. The inverse length is converted from Bohr⁻¹ to nm.

Energy convention: `E = displayed Ekin + offset`, `T′ = E + Ev`, following the compound paper's relation `E = T − Eg − Ev`. Ev is the valence bandwidth for a semiconductor/insulator, or the Fermi energy for a metal. The offset accommodates the difference between the displayed vacuum kinetic energy and the solid-state reference. Zero defaults are an explicit assumption, not inferred material properties; the band gap comes from the material panel. The UI supports offsets from −100 to +100 eV. Density, M, and Nv are used only by TPP-2M.

The app deliberately restricts SPA to corrected E of 200–10000 eV. This is an implementation boundary, not an accuracy certification for every material. It flags energies above 2 keV as nonrelativistic estimates. Below 200 eV, use a manual IMFP or a suitable full dielectric/transport calculation. The single-pole response does not represent the full electron-hole continuum.

Strict coverage requires optical data spanning 0 through E. Missing coverage leaves the affected IMFP/area unavailable; it never silently falls back to TPP-2M. The user may explicitly choose to set the ELF outside the supplied range to zero, which marks every affected result as a truncation approximation. This can overestimate IMFP when real loss weight is missing. No f-sum or Kramers–Kronig normalization is silently applied; supplying physically consistent optical data remains necessary. A manual per-orbital IMFP takes precedence. Zero-thickness sheets still have P=1 and need no IMFP for area calculation.

The `xps-escape-depth.workspace.v1` state now includes model choice, raw optical data, format, Ev, offset, and range policy. Legacy orbital-selection flags are ignored because all orbitals are now shown. Reset all clears the dielectric inputs and restores TPP-2M. CSV contains the input spectrum, energy convention, method, and range flags.

## EAL and information depth

The new `effective-depth.html` page offers two paths:

1. **Transport approximation:** with IMFP λi and transport mean free path λtr in nm, `ω = λi/(λi + λtr)` and `L = λi(1 − 0.735 ω)`.
2. **External EAL:** use a positive L from a measurement/database/transport calculation matching the material, energy, application, and geometry.

The approximation is Eq. E3 of the [NIST SRD 82 guide, Appendix E](https://www.nist.gov/system/files/documents/srd/SRD82UsersGuideV1-3.pdf). It represents a practical thin-film EAL averaged over emission angles 0–50° for source–analyzer angle 54° and selected film attenuations. The page uses it only for 50–2000 eV, the database's stated range, and only when the entire detector cone lies within 50° of the normal. This is not the full NIST Boltzmann-transport calculation. λtr is derived from the transport cross section, not the total elastic cross section; entering an ordinary elastic MFP is inappropriate. No default material is implied by the example λi=2 nm, λtr=5 nm.

The same L is used over the detector cone and inserted into an exponential model for a uniform semi-infinite emitter. Thus the resulting mean depth is labeled a **model mean depth**, not claimed to be the full transport mean escape depth. [NIST's practical guide](https://www.nist.gov/publications/practical-guide-inelastic-mean-free-paths-effective-attenuation-lengths-mean-escape) distinguishes these quantities, and [its review of EAL applications](https://www.nist.gov/publications/effective-attenuation-lengths-different-quantitative-applications-x-ray-photoelectron) emphasizes the application dependence of EAL.

For a single direction, μ = cos θ, ℓ = Lμ, the cumulative fraction is `F(z) = 1 − exp(−z/ℓ)`, mean depth ℓ, and `Dp = −ln(1−p)ℓ`. All displayed depths are measured along the surface normal. EAL and IMFP are lengths along the electron path; an already projected depth must not be entered as EAL.

A nonzero half-angle defines a cone centered on the analyzer axis, with uniform detection sensitivity and emission per solid angle. The calculation uses 24 midpoint samples in cos(δ) and 48 in azimuth. For each sample, `μ = cosθ cosδ + sinθ sinδ cosφ`. All rays must remain above the surface. Integrating uniform generation over depth gives:

```
F(z) = 1 − Σ ℓ exp(−z/ℓ) / Σ ℓ
mean depth = Σ ℓ² / Σ ℓ
```

The ℓ weights are essential: simply averaging single-angle cumulative fractions is not equivalent. D50/D90/D95/D99 are found by monotone bisection. The comparison curve repeats the calculation with IMFP replacing EAL. The probe-depth value reports the fraction of total detected signal produced between the surface and that depth.

External EAL mode permits low-energy ARPES and larger emission angles if the complete cone remains above the surface. It does not compute band-specific matrix elements, coherent diffraction, polarization anisotropy, non-exponential depth distributions, roughness, or multilayer propagation. A practical thin-film EAL should not be taken as a universally accurate information-depth parameter. The page makes these model limits explicit.

Inputs, including invalid drafts, persist independently under `xps-eal-depth.workspace.v1`. Reset changes only that page. Invalid conditions clear prior results and disable CSV export. Exports include units, model, source, geometry, quantiles, and a cumulative-profile table.

## Validation

`tests/transport-models.test.js` compares the SPA kernel against an independent dense kinematic quadrature, checks the Hartree/Bohr prefactor, convergence under optical-grid refinement, inverse scaling with ELF, complex-ε conversion, explicit range handling, and no TPP fallback. EAL tests cover the published algebraic expression, the no-elastic-scattering limit, exact single-angle quantiles, the analytic finite-cone mean depth, and applicability guards including the external-EAL ARPES path.

`tests/escape-depth.browser.js` covers all three pages, source-control placement, column alignment, graph/button alignment, no orbital checkboxes, menu disclosure, model switching, ELF file input, persistence/reset and legacy state, CSV output, EAL angle/acceptance behavior and invalid-state clearing, mobile layout, and reference-workspace isolation.
