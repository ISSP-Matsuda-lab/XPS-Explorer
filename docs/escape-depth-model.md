# XPS Escape Depth calculation model

The new app is a separate static entry point at `escape-depth.html`. It shares CSS and the existing binding-energy and Yeh–Lindau data with the reference app. The numerical functions and structure parsers in `assets/js/escape-depth.js` are independent of the DOM; `escape-depth-app.js` handles inputs, the orbital table, the atomic-layer preview, and export. Crystal and surface inputs occupy the top panel; no separate attenuation or peak-area graph is displayed.

Input drafts, structure text, all orbital overrides, IMFP method, optical loss data, instrument settings, and expanded sections are saved synchronously to the versioned `xps-escape-depth.workspace.v1` localStorage key, including edits made just before reloading. Derived results are recomputed after restoration. Reset all replaces only this app's state with its initial Si structure and default settings; it does not delete the reference app's IndexedDB workspace. Storage failures are shown in the page.

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

## Zero-thickness 2D system

Setting sample thickness to exactly **0 nm** selects a single 2D sheet instead of the periodic slab. Each occupied basis site in the input cell is counted once and projected to the surface. There are no repeats along the normal, and fractional height and termination phase do not bury the sheet. The phase field is disabled while this mode is active. All input basis atoms belong to the sheet, so use a cell containing only the intended 2D layer rather than a bulk cell or substrate plus layer.

**Zero-volume lattices are supported** when at least two vectors are independent. Two input rows are accepted, with a zero c vector appended. For three coplanar vectors, the first independent pair in order (a,b), (a,c), (b,c) defines the in-plane unit cell; its area is `A = |u × v|` in Å² (divide by 100 for nm²). The remaining vector contributes to coordinate conversion but is not an additional periodic generator. This is an explicit cell convention, not a search for a primitive lattice generated by three coplanar vectors. The selected pair is displayed and exported. Collinear or entirely zero vectors still fail because they define no surface area.

For these planar lattices, thickness is automatically set to zero and its control is disabled. Miller indices and termination phase are unused and disabled: the plane normal is `u × v`, and a 3D reciprocal volume is unnecessary. Fractional coordinates are converted to Cartesian positions and then to the chosen 2D basis using its in-plane dual vectors. This catches physically duplicated sites that differ only along a zero/redundant vector. POSCAR Direct and in-plane Cartesian coordinates are supported; Cartesian positions outside the plane and negative target-volume scaling are rejected. A CIF with c = 0, or consistent coplanar lattice angles, is also accepted; symmetry duplicates are removed in the 2D basis.

For a finite-volume vacuum cell used at thickness zero, the existing Miller-index definition remains available and `A = V/d`. For (001), `A = |a × b|`: changing the vacuum cell height does not change the intensity.

**Attenuation is always zero for a zero-thickness sheet**, meaning the survival probability is one, not zero. There is no virtual-depth parameter or averaging layer:

```
P_i(0) = 1
Neff,i = Σj occupancyj / A    (j: atoms of the orbital's element)
Yi = σi × Neff,i
```

The sheet's yield is independent of IMFP and emission angle within this isotropic-emission model. Occupancy, cross section, and instrument calibration retain their existing linear scaling. A missing IMFP or unavailable bulk material parameters do not prevent calculating the 2D area when the cross section is known and the orbital is accessible. Missing cross sections remain missing. The 95% information depth is zero for a sheet because all its atoms are at the surface; finite-thickness slabs retain the semi-infinite reference value.

TPP-2M is shown only as a **bulk-material reference** for the sheet, not used in its area calculation. Material density should exclude artificial vacuum when requesting that reference value. Old saved virtual-depth fields are ignored. CSV exports identify `geometry_mode`, `lattice_dimension`, `surface_cell_area_nm2`, `in_plane_basis`, the absence of attenuation, and whether termination was applied. The structure preview keeps all atoms at z = 0. The material sidebar defines Neff as the weighted sum of the relevant element's layer areal densities without a separate zero-thickness formula. Excitation conditions are above the orbital table; the page menu and IMFP-method switch are separate controls.

## Count conversion

```
counts_i = Yi × incidentPhotonsPerSecond × time
           × solidAngle/(4π) × efficiencyAt1keV × (Ekin/1000)^p
```

Incident flux is the photon rate over the entire illuminated footprint, not flux density. The sample is assumed laterally uniform, so no extra surface area factor is needed. Counts assume isotropic emission and a small analyzer angular acceptance at the selected θ. Energy-dependent efficiencies above one are rejected for the affected row. Zero acceptance/efficiency legitimately gives zero counts.

Absolute counts need measured calibration. The model omits elastic scattering/EAL corrections, photoelectron diffraction, polarization/angular asymmetry, surface relaxation, roughness, photon absorption, and interfaces with different scattering media. It is not a complete photoemission simulation or a quantitative composition inversion. For a heterogeneous multilayer specimen, each path segment would require its own material-specific attenuation.

## Validation

`tests/escape-depth.test.js` checks the Si example, independent Å-to-nm conversion, formula-unit invariance, finite and infinite depth sums, zero attenuation for sheets, zero-volume lattices, tilted and alternate 2D bases, duplicate planar sites, invariance to vacuum height, units, occupancy and count scaling, polar angle, reciprocal-lattice geometry, terminations, thresholds, absent data, statistical splitting, invalid structures, POSCAR modes, CIF symmetry and special positions.

`tests/escape-depth.browser.js` exercises actual browser navigation and controls, table alignment, 2D/zero-volume calculations, the Neff definition, invalid input clearing, presets, count calculation, extrapolation, CSV export, structural-file import, persistence across reloads (including invalid drafts and older saved state), complete reset and isolation from the reference app, mobile overflow, and JavaScript errors. The original app's existing suite remains `tests/run-tests.js`.
