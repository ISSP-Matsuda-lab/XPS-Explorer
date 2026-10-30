# Film thickness, angles, and bilingual interface

## Film inverse problem

The adsorbate parameter section is a native disclosure, initially collapsed. Its heading toggles the inputs; expansion state persists with the film workspace and Reset all collapses it again. The result row (surface geometry, orbital IMFP, thickness, and atoms per cell) sits outside the disclosure, below the parameters and immediately above the orbital table, so it remains visible when inputs are collapsed.

`assets/js/film-thickness.js` supports three film attenuation modes: **none** (default), **TPP-2M**, and **manual path lengths**. The user enters separately fitted film and substrate areas in the same units, before sensitivity-factor correction. `measuredRatio` divides the nonnegative film area by the strictly positive substrate area; invalid or unrepresentable ratios cannot produce a thickness. Scaling both areas equally leaves thickness unchanged. Six fields (element, orbital, reference peak, two areas, number density) share one row above the orbital table; narrow screens scroll that row horizontally. The model selector and its conditional inputs occupy the next compact row. Thickness and adsorbate atoms per substrate surface cell appear next to IMFP. Photon energy, work function, and emission angle θ are shared by both peaks; binding energies and cross sections use reference data.

Define adsorbate emitter density na in atoms/nm³ and component cross section σa in nm². Equal transmission and angular sensitivity for the two peaks remain explicit assumptions. None needs only number density. Manual adds La and Ls,f in nm: film-origin and substrate-origin electrons traveling inside the film. Values are path lengths (IMFP or an appropriate EAL), not normal projected depths.

TPP-2M adds molar mass M, valence count Nv, selected-element atom count ν, and band gap Eg, all for the same film formula unit. Mass density is `ρ = na M / (602.214076 ν)`. Both peak energies use the shared vacuum-energy convention `hν − EB − φ`; the existing `EscapeDepth.imfp` evaluates the film material at each energy. Valid inputs are 50–10000 eV; either energy above 2000 marks extrapolation. There is no fallback to the substrate material, no element-dependent guessed constants, and no silent fallback to zero attenuation. The model does not depend on the substrate's choice of TPP or dielectric IMFP. References: [NIST SRD 82, appendix B](https://www.nist.gov/document/srd82usersguidev1-3pdf) and [EAL application definitions](https://www.nist.gov/publications/effective-attenuation-lengths-different-quantitative-applications-x-ray-photoelectron).

The uncoated substrate yield Ys,0 is the selected positive orbital yield from the existing crystal calculation. It already includes the substrate cross section, occupancy, internal attenuation, and finite slab or 2D geometry. The adsorbate is separate from that crystal input. Without film attenuation:

```
Ia(t) ∝ σa na t
Is(t) ∝ Ys,0
R = Ia / Is
adsorbate_areal_density = R Ys,0 / σa
t = adsorbate_areal_density / na
adsorbate_atoms_per_surface_cell = adsorbate_areal_density × Acell
```

This is the infinite-adsorbate-attenuation-length limit of the previous exponential overlayer model, with equal sensitivity factors. The direct cosθ factor cancels in this limit; θ can still affect Ys,0 through substrate internal attenuation. `1 Mb = 10⁻⁴ nm²`. Given mass density ρ in g/cm³, molar mass M in g/mol, and ν selected-element atoms per formula unit, `na = 602.214076 ρν/M` atoms/nm³.

Without attenuation the estimate is linear in R. Doubling number density halves thickness while leaving atoms per cell unchanged. With attenuation, set a = La cosθ, b = Ls,f cosθ, C = σa na a / Ys,0:

```
R(t) = C [1 − exp(−t/a)] exp(t/b)
log R(t) = log C + log(−expm1(−t/a)) + t/b
```

The monotone function is inverted by bisection in log space. A softplus expression initializes the upper bound `max(a,b) log1p(R/C)`. Equal lengths have the closed form `t = a log1p(R/C)`. R=0 gives zero thickness and atoms in every mode. The film-average escape factor is `a (1−exp(−t/a))/t` (limit 1 at zero thickness); substrate transmission through the film is `exp(−t/b)`. Exports name these separately. Non-finite or underflowed positive outputs are rejected. Attenuated modes assume a uniform, fully covering flat film and a narrow angular acceptance; density now also changes attenuation in TPP mode.

Outputs are t in nm, adsorbate atoms/nm², and the selected adsorbate element's atoms per substrate surface cell. Acell is the existing crystal model's area in nm²: V/dhkl for a 3D input and the independent in-plane basis area for a rank-two, zero-volume lattice. Counts use the actual input surface cell, including supercells, not a volume cell or an automatically reduced primitive cell. These are average atom counts, not molecule counts or a monolayer fraction. Nonuniform adsorption is represented by an equivalent uniform-film thickness. Number density starts empty instead of assigning an unverified value.

`film-thickness-app.js` consumes the main prediction via `EscapeDepthWorkspace.getPrediction()` and `xps:prediction`. Pending or invalid main calculations invalidate film results/export. Storage key remains `xps-film-thickness.workspace.v1`, payload version 4. Older versions retain common selections, measured areas, and density, and start in none mode. A version-1 ratio is shown until actual areas are supplied. Current mode-specific inputs persist across switches and reloads; hidden inputs are disabled and do not influence another mode. Reset restores none and clears all extra inputs. CSV records mode, film material inputs, computed density/lengths, extrapolation flag, average film escape and substrate transmission factors, areas, energies, geometry, surface-cell area, thickness, and atom count.

## Angle convention

The EAL page defines θ from the outward surface normal to the analyzer center axis. θ=0° is normal emission; θ approaching 90° is grazing. Instruments using take-off angle β from the surface plane need `θ=90°−β`. This is distinct from X-ray incidence. In the straight-line approximation, a normal depth z gives path z/cosθ, so a fixed path attenuation length corresponds to less normal information depth at larger θ.

The collection half-angle α is the half-opening of a circular detector cone. Its geometric solid angle is `Ω=2π(1−cosα)` sr. For α=5°, Ω≈0.02391 sr. The page displays Ω and updates a geometry diagram as θ/α change. A rectangular slit or nonuniform lens response needs the actual angular weighting; α does not specify the instrument's angular resolution. At α=0, the normalized depth calculation uses a single ray. It does not predict nonzero counts through a zero-area angular aperture.

## Navigation and languages

The menu contains only Energy Reference and Escape depth & film thickness. A separate segmented IMFP/EAL navigation control on both depth pages provides direct switching. The IMFP model switch (TPP-2M/Dielectric) remains independent. The orbital summary no longer displays a count of calculated peaks.

The language button next to the menu defaults to English and stores a shared preference at `xps-toolkit.language.v1`. Resetting scientific inputs does not reset language. `i18n.js` translates UI text nodes and accessibility/tooltip/placeholder attributes using explicit bilingual catalogs, including newly rendered content. Original source text is retained per node so toggling remains reversible. The observer is disconnected during translation to prevent feedback loops. No input values, select values, formulas, scientific datasets, or imported names/edited legends are rewritten. Dynamic templates retain variables and support different placeholder order between languages. Cross-tab language changes are synchronized through the storage event.

Validation includes all three modes, TPP density conversion and energy guards, equal-length closed forms and unequal-length inverse checks, the no-attenuation limit, angle effects, extreme ratios, 2D atom counts, CSV mode/length metadata, mode-specific persistence and reset, language changes, six fields on one row, mobile overflow, and existing reference-page workflows.
