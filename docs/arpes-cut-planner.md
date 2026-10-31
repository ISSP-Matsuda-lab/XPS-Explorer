# ARPES Cut Planner

Entry point: `arpes-cut-planner.html`. The page is a static browser application with no build step. `arpes.js` owns the pure numerical model, `arpes-plot.js` owns the canvas and cell diagrams, and `arpes-app.js` connects inputs, persistence, and translation to the model. The shared menu exposes the page from all existing applications.

## Momentum convention

The reference is the local `arpes-planner` application by Matthew Staab, especially `absolute_and_projected_momentum_coords` in its `app.py`. The original [project](https://github.com/mstaab16/arpes-planner) is MIT licensed; its notice is retained in `arpes-planner-license.txt`. The deflector equations below are algebraically equivalent to its angle conversion and avoid an azimuth singularity at normal emission.

At the Fermi level, `Ekin = photonEnergy − workFunction` in eV and `K² = 0.2624684236408253 Å⁻²/eV`. Corrected slit angle `s` and perpendicular scan angle `d` are the supplied angles minus their respective offsets. All trigonometric expressions use radians.

| Mode | Along-slit momentum | Perpendicular-to-slit momentum |
| --- | --- | --- |
| Deflector | `√(K² Ekin) sin(s)` | `−√(K² Ekin) cos(s) sin(d)` |

The normal component is `kn = √[K² (Ekin cos²(s) cos²(d) + V0)]`. Only deflector mode is exposed and supported. It rotates about the slit axis after the slit-angle rotation. Angles corrected by their offsets must lie strictly inside ±90°. The UI supports input scan angles within ±89°.

Sample normal and slit direction are Cartesian vectors in the same crystal frame as the real-space lattice vectors. The normal is normalized; the slit is projected onto its perpendicular plane and normalized. A zero vector or parallel pair fails validation. `normal × slit` supplies the third direction. Positive azimuth rotates the slit toward that direction. The computed local momentum is expressed in this orthonormal basis.

The 2D mode projects the result onto crystal kx–ky, discarding kz before folding. It does not infer a surface reciprocal lattice for an arbitrary Miller plane. The 3D mode retains all three components. Reduced-unit display multiplies kx by the entered `a/π` (π/a units), ky by `b/π` (π/b units), and **kz by `c/π` (π/c units)**. A shared conversion supplies axis ticks, hover values, the unfolded-kz color scale, and the normal-emission curve. Geometry and equal-length drawing aspect remain in physical Å⁻¹. These are Cartesian components, not fractional reciprocal coordinates; for skew cells or tilted surfaces the entered c is a reference length, not an inferred reciprocal-plane spacing. The 2D configuration exposes c for kz normalization without changing its in-plane lattice. Colors show slit angle, perpendicular scan angle, or unfolded kz. This is scan coverage, not a simulated ARPES intensity spectrum: photon momentum, binding-energy scans, band dispersion, matrix elements, and detector response are absent.

## Lattices and primitive cells

Two-dimensional cells lie in xy. The five choices are square, primitive rectangular, centered rectangular, hexagonal/triangular, and oblique. Centered rectangular uses `(a1+a2)/2` and `(-a1+a2)/2` as primitive vectors. Square and hexagonal choices enforce b = a, with γ = 90° and 120° respectively.

The three-dimensional conventional vectors use `a1 = (a,0,0)`, `a2 = (b cosγ,b sinγ,0)`, and a positive-z third vector consistent with α = angle(b,c), β = angle(a,c), and γ = angle(a,b). Impossible metrics and vanishing volume fail validation.

| Metric selection | Centering choices | Constraints |
| --- | --- | --- |
| Orthogonal | P, C, I, F | α = β = γ = 90°; independent a, b, c; equal lengths include cubic/tetragonal metrics |
| Hexagonal | P, R | a = b; α = β = 90°; γ = 120°; R is a rhombohedral lattice in hexagonal axes |
| Rhombohedral | R | a = b = c; α = β = γ; the entered axes are primitive |
| Monoclinic | P, C | α = γ = 90°; unique axis b |
| Triclinic | P | All six parameters independent |

Primitive vectors in fractional conventional coordinates:

| Centering | p1 | p2 | p3 | Conventional / primitive volume |
| --- | --- | --- | --- | --- |
| P | (1,0,0) | (0,1,0) | (0,0,1) | 1 |
| C | (½,½,0) | (−½,½,0) | (0,0,1) | 2 |
| I | (−½,½,½) | (½,−½,½) | (½,½,−½) | 2 |
| F | (0,½,½) | (½,0,½) | (½,½,0) | 4 |
| R, hexagonal axes | (⅔,⅓,⅓) | (−⅓,⅓,⅓) | (−⅓,−⅔,⅓) | 3 |

For rhombohedral **primitive** input axes p1,p2,p3, the equivalent conventional hexagonal cell in the explanatory diagram is `(p1−p2, p2−p3, p1+p2+p3)`. No additional centering transformation is applied to those input primitive axes. The cell diagrams show lattice sites rather than an atomic basis. P/C/I/F/R comparison cards use illustrative conventional cells; the larger selected-cell diagram uses the actual entered metric.

The crystallographic conventions follow the IUCr's [Reciprocal lattice](https://dictionary.iucr.org/Reciprocal_lattice) and [Symmetry](https://www.iucr.org/what-we-do/education/pamphlets/symmetry) references. The distinction between primitive rhombohedral and centered hexagonal axes is also described in the [International Tables, symmetry in reciprocal space](https://onlinelibrary.wiley.com/iucr/itc/Ba/ch1o4v0001/sec1o4o4o5/).

## Brillouin zone and folding

The reciprocal basis satisfies `pi · bj = 2π δij`. The first BZ is the intersection of all origin-neighbor bisectors `k · G ≤ |G|²/2`, not a reciprocal parallelepiped. An LLL-reduced reciprocal basis improves conditioning without changing the lattice.

For drawing, the bisectors of ±basis vectors give a bounded starting region with maximum corner radius R. Only reciprocal points with `|G| ≤ 2R` can cut this region; dual-basis norms bound their integer coefficients. Polygon/polyhedron clipping produces the Wigner–Seitz boundary. Extremely anisotropic inputs that would require over 250,000 candidate coefficient combinations produce a visible error rather than a truncated approximation.

Folding uses a separate nearest-lattice-point solver: a QR decomposition, a Babai starting point, and a bounded integer sphere search. It subtracts the closest reciprocal vector. Thus oblique and triclinic cells do not depend on componentwise fractional rounding or a fixed set of 27 neighboring cells. Equivalent boundary representatives are allowed. Visibility of the BZ has no effect on folding.

By default the displayed zone is translated to the reciprocal lattice point nearest the mean displayed momentum, including its kz. The plot bounds follow the measured region without forcing the origin into view. **All occupied zones** retains this reference cell and adds the distinct translated cells containing the sampled points; other unsampled gaps are not filled. Folding continues to subtract the original reciprocal vector, so folded data is shown in the first BZ around zero. No arbitrary continuous kz translation is applied to the lattice.

Right-button dragging pans in both dimensions. Exact xy, xz, and yz views are available in 3D. On desktop the scan panel is on the left and the primitive-cell panel on the right; narrow screens stack them. Defaults are 15 eV inner potential, with both angular ranges −15° to +15° at 31 points. Existing saved settings are retained; Reset all applies these new defaults.

The main map can switch between dark and white backgrounds with the button next to its color scale. The reference cell stays green when All occupied zones is enabled; only added cells are purple in both themes. Shared edges retain green by drawing the reference outline last among the zone outlines. In 3D, edge depth is compared with each measured point: foreground portions are restored over the point, while rear portions remain behind it, including after rotation and in PNG exports. Its legend remains Brillouin zone, including when translated near the measured kz. The near-cloud choice does not force Γ = 0 into the viewport. Translated copies are repeated-zone cells rather than successively numbered Brillouin shells. In 3D, three shaded axis panes with grid lines give the plot depth, following the axis backgrounds in the original ARPES Planner. The far faces are chosen for each view and drawn behind the zones and points. Theme choice is saved with other configuration. Dimension, lattice system, and centering share a row, reducing the upper panels' height by about 10%.

A collapsed Publication notes footer uses the same layout as Energy Reference and gathers the model and angle conventions, reference links and acknowledgements (including [blochpesto's SBZ calculator](https://pesto.readthedocs.io/en/latest/pesto_core.html#sbz)), use cases, privacy, limitations, MIT license, and repository link. Attribution appears only in this footer; the Surface Brillouin zone panel contains the diagram and distance/angle equations. These notes support English and Japanese.

The 3D initial viewing direction matches the reference planner's `(1.5, 1.5, 1.5)` camera. Only the three planes opposite the camera receive background fills, grid lines, and borders; no bounding-box edges close the foreground. Axis labels follow the outer edges of these panes. Rotating beneath or around the data selects the new rear planes; exact orthogonal views display only the non-edge-on pane.

The toolbar sits below the map, between the color-scale legend and White background. It offers PNG download (including axes and the color scale), zoom in/out, drag-to-zoom, pan, 3D rotation, and a home button to reset the view. The duplicate Reset view text button has been removed. Right-drag always pans, and the map retains a normal arrow cursor in every mode. Dashed hover guides snap to nearby measured points rather than following the cursor continuously. In 2D they show the selected point's horizontal and vertical coordinates; in 3D they project it to the three rear planes with guides along those planes. They disappear when the cursor leaves the data, a drag begins, or the view/data changes. Hover guides are excluded from the PNG export.

The 48 continuous palettes are grouped into Bright & pastel, Sequential, Diverging, and Multicolor & cyclic. Bright options include Aurora, Pastel rainbow, Sunrise, Seafoam, and light versions of Viridis, Plasma, and Turbo. Rainbow colored by scan angle is the default for a new session or Reset all; existing saved palette choices remain valid and persist across reloads. Sample normal and Slit direction share one compact row, each with separate ordinary text inputs for x/y/z (no spinner controls). Signed numbers and scientific notation are accepted; each component must be finite. They retain the existing Cartesian-vector meaning and stored string format, so settings saved by earlier versions still load. Blank components, zero normals, and parallel direction vectors remain invalid.

Angular scan and normal-emission panels form one independent column; the primitive-cell and surface-zone panels form another. On desktop, the open scan/primitive-cell pair and the open normal-emission/surface-zone pair each match the larger natural content height in that pair. The match responds to lattice, validation messages, language, and width changes, and is released for collapsed panels or a stacked mobile layout. Each panel uses a keyboard-accessible native disclosure. Collapsing one moves the next panel in that column upward without leaving a grid-row gap or moving the opposite column. Reset all expands them. The normal-emission graph always retains the configured photon energy and its calculated kz, with a separate persistent readout for a movable point on the curve. Publication notes cards stretch to fill each row, so the group from References & acknowledgements through License aligns with both edges of the full-width Model & angle conventions card. Paragraphs use normal left alignment.

## Validation and interaction

`tests/arpes.test.js` checks 42 cases including normal emission, offsets and rotations, analytical square/hexagonal boundaries, reciprocal duality and zone volumes for all supported systems/centerings, cubic BZ topology, rhombohedral/hexagonal equivalence, independent brute-force nearest-point comparison for skew lattices, retention of the reference zone in sparse scans, single cuts, invalid-input handling, independent a/b/c unit conversion, symmetry equivalence, distance identities, and primitive versus centered axial BZ boundaries.

`tests/arpes.browser.js` exercises menu navigation, right-hand configuration layout, all lattice choices, color/unit/BZ switches, folding, slider/input synchronization, mouse and keyboard interaction, persistence and corrupted state, invalid settings, Japanese/English switching, and a 390px mobile viewport. A separate touch-enabled mobile context uses native browser touch input to verify 2D/3D map pinch zoom, two-finger pan, kz pinch zoom and one-finger pan, movable-point dragging, transition from point drag to pinch, and autoscale. Screenshots are written to the ignored `.browser-qa/` directory. It also checks the 121 × 121 point limit and that the shared depth-page navigation remains available.

Settings are stored under `xps-toolkit.arpes.v1`. Only validated values are saved. Invalid settings clear the plotted simulation and show a contextual error; they are never silently plotted using stale results. Reset is isolated from the other applications and preserves the shared language preference.


## Normal emission and surface-zone panels

The normal-emission curve below Angular scan uses `kz = sqrt(K² (hν − φ + V0))` at EF. Here kz means the component **along the sample normal**, even if that normal is tilted relative to crystal z. Alignment offsets do not change this curve. Energies at or below φ are excluded; an invalid range clears only this graph. The default range is 5–150 eV and the configured photon energy is marked in orange when in range. A separate cyan probe stays on the calculated curve, with persistent energy/kz readouts and dashed guides. Drag the probe horizontally or enter its energy to move it; passive mouse movement does not change the probe. Left/Right arrow keys on the focused probe also move it (Shift increases the step). Probe energy must be within the configured range and above the work function. Numeric input outside the current zoom restores the full range to reveal the probe.

On desktop, dragging a rectangle away from the probe zooms both axes; the mouse wheel zooms around the cursor. On touch screens, one finger drags the probe when starting near it, otherwise pans the view. Two fingers pinch to zoom and move the view, taking priority over probe dragging. Autoscale, double-click, Home, or Escape restores the configured full range while preserving probe energy. Changes to the energy range or curve scale reset zoom, while changing only the configured photon energy preserves it. The shared unit selector also applies here, with π/c for this normal component. The main momentum map likewise supports two-finger pinch zoom and pan in both 2D and 3D; one finger follows its selected toolbar mode, and Home restores its view.

The surface-zone panel below Centering & primitive cell implements an independent surface-lattice size and angle calculator inspired by the documented purpose of [pesto.SBZ()](https://pesto.readthedocs.io/en/latest/pesto_core.html#sbz) ([project](https://gitlab.com/flashingLEDs/pesto)). It does not call Python pesto or reproduce its book-derived illustrations. Its diagrams are calculated directly from the configured primitive real-space lattice and Cartesian sample normal.

For 3D, the normal is expressed as integer reciprocal indices in the primitive basis. The integer kernel of those indices provides two primitive translations lying exactly in the surface. A Gauss reduction shortens the surface basis; its two-dimensional reciprocal dual defines the Wigner–Seitz surface BZ. This is not a kz slice of the bulk BZ. The search recognizes primitive normal indices up to 24 with a relative ratio tolerance of 1e-7. A nonperiodic or unrecognized normal shows a local message without clearing the primary momentum map. In 2D the real lattice is already in crystal xy and therefore requires a normal parallel to crystal z.

Regular hexagons label corners K and edge centers M; squares use M and X; rectangles use S corners and X/Y edge centers. Only one representative per orbit under rotations/reflections preserving the complete polygon is displayed. Equal radius alone does not establish equivalence: a generic oblique cell still retains its three inequivalent vertex pairs and three edge-center pairs. Such cells use geometric V/E labels without claiming standard named high-symmetry points. Selecting a plotted point highlights its Γ-to-point direction. The panel contains the diagram and distance/angle equations, with the table and explanatory paragraphs removed. The underlying azimuth/slit/deflector calculations still describe the actual representative drawn.

Distance equations accompany the drawing. For a hexagonal surface, ΓM = 2π/(√3 aₛ), ΓK = ΓM/cos30°, and KM = ΓM tan30°. Square and rectangular cells use the corresponding Pythagorean identities; general cells use vector norms and the cosine rule. The surface lengths aₛ/bₛ are derived from the configured surface lattice (for example FCC(111) has aₛ = a/√2), so these formulas do not incorrectly substitute the bulk a. Adjacent representative points are selected to make the interpoint distances in these identities agree with the drawing.

For each surface target q, the emission angle is `θ = asin(|q| / sqrt(K² (hν − φ)))` from the surface normal. Inner potential does not enter this parallel-momentum relation. Targets outside the vacuum momentum circle are explicitly unreachable. Azimuth is measured from the configured slit direction, including its azimuth offset. Slit and deflector settings invert the current deflector convention and then add their alignment offsets; a grazing inverse with an undefined deflector value is shown as a dash. The displayed emission angles are geometric targets, not a guarantee of instrument acceptance or coverage by the currently selected scan. Surface in-plane distances use a common π/a reference when reduced units are selected; they are scalar lengths in the surface frame, not the main plot’s separate Cartesian kx/ky components.

Numerical regressions include analytical square and hexagonal distances, FCC(111) surface area and primitive-vector lengths, signed integer surface normals, inaccessible targets, and a round-trip from target angles through the main momentum conversion. Browser tests cover the single-row offsets, relocated dimension selector, deflector-only migration, reordered scan inputs, lower graph placement, invalid energy ranges, point selection, language switching, and narrow screens.

## Axial period verification

The reciprocal basis uses the solid-state convention `aᵢ · bⱼ = 2π δᵢⱼ`, and BZ faces bisect reciprocal-lattice neighbors. For primitive orthogonal and primitive hexagonal lattices, the z ray meets the first boundary at `π/c`; the next Γ is at `2π/c`. Thus normalized boundary positions are ±1 around a Γ center, and Γ-to-Γ spacing is 2 in π/c units. Translated cells retain this half-width.

This is not universal for a conventional centered cell. For cubic F or I with conventional `a=b=c`, the positive z boundary is `2π/c`, or 2 in π/c units. The tests intersect the actual computed face planes with the z ray, and check that nearest-cell folding changes on either side of that boundary. The existing BZ geometry passes these tests; no factor-of-two change to the reciprocal basis or zone geometry was made. References: [IUCr reciprocal-basis convention](https://onlinelibrary.wiley.com/iucr/itc/Db/ch2o2v0001/sec2o2o2/) and [centered reciprocal lattices](https://dictionary.iucr.org/Reciprocal_lattice).

## Angular step inputs

Slit and deflector scans accept positive angular steps in degrees (default 1°). Samples start at Start and advance by Step up to End; End is included only if the step reaches it. For example, 0° to 1° with a 0.3° step samples 0°, 0.3°, 0.6°, and 0.9°. Equal endpoints produce one cut. Each axis supports at most 121 samples; smaller steps that exceed this limit show an error. Saved point-count settings are migrated to `(End − Start) / (Count − 1)` steps, with 1° for single cuts. New saves store steps only.
