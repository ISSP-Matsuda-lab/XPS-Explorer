# XPS Escape Depth calculation model

The new app is a separate static entry point at `escape-depth.html`. It shares CSS and the existing binding-energy and Yeh–Lindau data with the reference app. The numerical functions and structure parsers in `assets/js/escape-depth.js` are independent of the DOM; `escape-depth-app.js` handles inputs, tables, plots, and export.

## Energy and IMFP

`Ekin = photonEnergy − bindingEnergy − workFunction`, all in eV. Nonpositive Ekin is inaccessible. As requested, this Ekin is also used as the energy argument of TPP-2M. Precise solid-state energy conventions can differ; a measured or externally calculated IMFP can be supplied for each orbital.

The nm form is:

```
U = Nv ρ / M
Ep = 28.816 sqrt(U)
β = −1 + 9.44 / sqrt(Ep² + Eg²) + 0.69 ρ^0.1
γ = 0.191 / sqrt(ρ)
C = 19.7 − 9.1 U
D = 534 − 208 U
λ = E / (Ep² [β ln(γ E) − C/E + D/E²])
```

ρ is g/cm³, M is g/mol, and Nv is the valence count for the **same formula unit as M**. The coefficients are ten times the Å convention in the [NIST SRD 71 guide, Appendix A](https://www.nist.gov/system/files/documents/srd/SRD71UsersGuideV1-2.pdf); the result is therefore in nm. The app uses the more precise Ep coefficient 28.816 supplied in the discussion. NIST describes the original fit over 50–2000 eV and substantial model uncertainty; the app flags higher-energy estimates up to 10 keV as nonrelativistic extrapolation. It does not automatically extend below 50 eV or above 10 keV.

Si example (ρ=2.329, M=28.085, Nv=4, Eg=1.12):

| Energy / eV | Calculated λ / nm |
| --- | --- |
| 100 | 0.530610 |
| 200 | 0.761571 |
| 500 | 1.412178 |
| 1000 | 2.386301 |
| 2000 | 4.148990 |

These reproduce the supplied approximate discussion values to within 0.03 nm. The displayed values are calculated directly rather than hardcoded to that rounded table.

## Crystal and surface

Lattice vectors a, b, c are rows in Å, with V = |a·(b×c)|. Reciprocal vectors omit 2π. Miller indices are reduced by their greatest common divisor, retaining their sign. The outward surface normal is parallel to `G = h a* + k b* + l c*`; `d = 1 / |G|`.

For fractional site fj and termination phase s, the first inward depth is:

```
zj,0 = mod(s − (h fj,x + k fj,y + l fj,z), 1) d
zj,n = zj,0 + n d, for 0 ≤ zj,n < slabThickness
```

For primitive integer hkl, each basis site has planar density `occupancy × d/V` in Å⁻², or 100 times that value in nm⁻². This formulation counts sites per surface area, avoids a lateral supercell cutoff, and works for oblique cells. Fractional coordinates are wrapped into the unit cell. Occupancies at the same location may sum to at most one, including mixed sites. CIF symmetry is applied separately to each asymmetric site and its special-position duplicates are removed before checking total occupancy.

For emission angle θ from the outward normal and a single homogeneous scattering matrix:

```
Neff,i = Σj,n densityj exp(−zj,n / (λi cos θ))
Yi = σi × Neff,i
```

The finite depth sum is evaluated analytically as a geometric series using `expm1`, which remains accurate for small d/λ. 1 Mb = 10⁻⁴ nm². Y is a dimensionless all-solid-angle, unscattered-electron yield per incident photon in the model; values are not normalized until the separate area-fraction column. At each photon energy, existing [Yeh–Lindau tabulations digitized by Kalha et al.](https://doi.org/10.6084/m9.figshare.12389750.v3) provide σ. Spin-orbit statistical splitting is inherited from the existing code. A manually entered σ is already the cross section of that displayed component and is not split again.

## Count conversion

```
counts_i = Yi × incidentPhotonsPerSecond × time
           × solidAngle/(4π) × efficiencyAt1keV × (Ekin/1000)^p
```

Incident flux is the photon rate over the entire illuminated footprint, not flux density. The sample is assumed laterally uniform, so no extra surface area factor is needed. Counts assume isotropic emission and a small analyzer angular acceptance at the selected θ. Energy-dependent efficiencies above one are rejected for the affected row. Zero acceptance/efficiency legitimately gives zero counts.

Absolute counts need measured calibration. The model omits elastic scattering/EAL corrections, photoelectron diffraction, polarization/angular asymmetry, surface relaxation, roughness, photon absorption, and interfaces with different scattering media. It is not a complete photoemission simulation or a quantitative composition inversion. For a heterogeneous multilayer specimen, each path segment would require its own material-specific attenuation.

## Validation

`tests/escape-depth.test.js` checks the Si example, independent Å-to-nm conversion, formula-unit invariance, finite and infinite depth sums, units, occupancy and count scaling, polar angle, reciprocal-lattice geometry, terminations, thresholds, absent data, statistical splitting, invalid structures, POSCAR modes, CIF symmetry and special positions.

`tests/escape-depth.browser.js` exercises actual browser navigation and controls, invalid input clearing, presets, count calculation, extrapolation, CSV export, structural-file import, mobile overflow, and JavaScript errors. The original app's existing suite remains `tests/run-tests.js`.
