# Film thickness, angles, and bilingual interface

## Film inverse problem

`assets/js/film-thickness.js` solves a uniform, fully covering planar film using a background-subtracted film/substrate peak-area ratio R. The film and substrate components must be separately fitted; the input ratio is before sensitivity-factor correction. Photon energy, work function, and the polar emission angle θ come from the escape-depth page.

Define μ = cos θ, film emitter density na in atoms/nm³, component cross section σa in nm², La for film-origin electrons traveling **inside the film**, and Ls,f for substrate-origin electrons traveling **inside the film**. These generally differ because their kinetic energies differ. Enter IMFPs for a straight-line approximation or EALs suitable for the actual application/geometry. The substrate bulk IMFP must not be substituted for Ls,f in a different material.

The uncoated substrate yield Ys,0 is the selected positive orbital yield from the existing crystal calculation. It already includes the substrate cross section, occupancy, its internal attenuation, and the finite slab or 2D geometry. The added film is separate from that crystal input. With relative transmission/angular response Ta/Ts:

```
Ia(t) ∝ σa na La μ [1 − exp(−t/(La μ))] Ta
Is(t) ∝ Ys,0 exp(−t/(Ls,f μ)) Ts
R(t) = Ia(t) / Is(t)
```

This extends the standard overlayer/substrate ratio described in [Jablonski and Powell, section 3.1.1.4](https://srd.nist.gov/jpcrdreprint/5.0008576.pdf), using the app's uncoated substrate yield instead of assuming a semi-infinite substrate. `1 Mb = 10⁻⁴ nm²`. Given material mass density ρ in g/cm³, molar mass M in g/mol, and ν emitter atoms per formula unit, `na = 602.214076 ρν/M` atoms/nm³. The interface rounds the coefficient to 602.214.

The function is strictly increasing for positive sensitivity, density, and lengths. Set a = Laμ, b = Ls,fμ, C = σa na a(Ta/Ts)/Ys,0. The solver uses `log R(t) = log C + log(−expm1(−t/a)) + t/b`, avoiding underflow from the attenuated substrate. A bound `t ≤ max(a,b) log1p(R/C)` initializes bisection; softplus evaluates this bound even for extreme ratios. R=0 gives t=0. For equal lengths a=b, the independent closed form is `t = a log1p(R/C)`.

Outputs are t in nm, na t in atoms/nm², and substrate retention `exp(−t/b)`. Density and attenuation fields start empty rather than assigning unverified material properties. Cross sections come from the existing Yeh–Lindau implementation, with manual override. The transmission ratio defaults to 1 as an explicit equal-response assumption. A single ratio cannot distinguish film thickness from unknown coverage/density. Islands, partial coverage, intermixing, roughness, and isolated adatoms are outside this model; molecular adsorption yields an equivalent uniform-film thickness.

`film-thickness-app.js` consumes the main app's latest prediction via `EscapeDepthWorkspace.getPrediction()` and `xps:prediction` events. A pending or invalid main calculation invalidates film results and export. Inputs persist under `xps-film-thickness.workspace.v1`; the main reset emits `xps:escape-reset` and restores film defaults too. A selected reference remains selected through temporary invalid drafts. CSV exports retain the fit inputs, energy and cross-section information, the uncoated yield, substrate geometry, and inferred quantities.

## Angle convention

The EAL page defines θ from the outward surface normal to the analyzer center axis. θ=0° is normal emission; θ approaching 90° is grazing. Instruments using take-off angle β from the surface plane need `θ=90°−β`. This is distinct from X-ray incidence. In the straight-line approximation, a normal depth z gives path z/cosθ, so a fixed path attenuation length corresponds to less normal information depth at larger θ.

The collection half-angle α is the half-opening of a circular detector cone. Its geometric solid angle is `Ω=2π(1−cosα)` sr. For α=5°, Ω≈0.02391 sr. The page displays Ω and updates a geometry diagram as θ/α change. A rectangular slit or nonuniform lens response needs the actual angular weighting; α does not specify the instrument's angular resolution. At α=0, the normalized depth calculation uses a single ray. It does not predict nonzero counts through a zero-area angular aperture.

## Navigation and languages

The menu contains only Energy Reference and Escape depth & film thickness. A separate segmented IMFP/EAL navigation control on both depth pages provides direct switching. The IMFP model switch (TPP-2M/Dielectric) remains independent. The orbital summary no longer displays a count of calculated peaks.

The language button next to the menu defaults to English and stores a shared preference at `xps-toolkit.language.v1`. Resetting scientific inputs does not reset language. `i18n.js` translates UI text nodes and accessibility/tooltip/placeholder attributes using explicit bilingual catalogs, including newly rendered content. Original source text is retained per node so toggling remains reversible. The observer is disconnected during translation to prevent feedback loops. No input values, select values, formulas, scientific datasets, or imported names/edited legends are rewritten. Dynamic templates retain variables and support different placeholder order between languages. Cross-tab language changes are synchronized through the storage event.

Validation includes closed-form and unequal-length inverse checks, extreme ratios, 2D substrate yields, input guards, CSV, pending/invalid state clearing, saved inputs and resets, default English, language changes across all three pages, retained numeric results, imported user names, fit dialogs, mobile overflow, and a scan for untranslated Japanese in the default English interface.
