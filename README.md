# CoreLevel - XPS Peak Explorer

XPS Peak Explorer is a browser app for inspecting X-ray photoelectron spectroscopy (XPS) and related measurements by **visualizing element binding energies and Auger electron energies**.

The basic workflow is to select elements from the periodic table at the bottom of the screen, compare expected peak positions in the plot at the top, and inspect exact values in the energy table. You can also search for candidate elements from a measured peak energy. XY measurement files can be overlaid on the reference peaks, with simple background subtraction and normalization tools available in the browser.

The app includes neutral-atom core levels and Auger transitions from H to U. It supports Al, Mg, Cr, Cu, and Ga K-alpha presets as well as custom excitation photon energies. Core-line heights are calculated from Yeh-Lindau atomic subshell photoionization cross sections at the selected photon energy and normalized to the strongest selected core line. Neutral-atom binding energies are based on the LBNL X-Ray Data Booklet (XDB). Auger kinetic energies prefer recommended elemental reference data from the NIST X-ray Photoelectron Spectroscopy Database (SRD 20), supplemented by XDB Principal Auger Electron Energies where representative lines are not covered.

## Online URL

<https://corelevel-explorer.vercel.app/>

## Running Locally

No build step or package installation is required. Start a local HTTP server from the repository root:

```bash
python3 -m http.server 8000
```

Open <http://localhost:8000> in your browser. To stop the server, press `Ctrl+C` in the terminal where it is running.

Use the menu at the upper right to switch between **Energy Reference** and **IMFP & Peak Intensity** (`escape-depth.html`).

## IMFP & Peak Intensity

The separate **XPS Escape Depth** app reuses the reference app's layout, binding energies, and photoionization cross sections. Enter photon energy and work function to calculate each orbital's kinetic energy, `Ekin = hν − EB − φ`. Enter the scattering material's density, molar mass, valence-electron count, and band gap to estimate its IMFP using the nonrelativistic TPP-2M equation in nm.

- Start with the Si, Cu, or NaCl examples, or enter three lattice vectors in Å and all atoms in fractional coordinates, with optional occupancies.
- Import VASP 5 POSCAR files (Direct or Cartesian, including selective dynamics and negative volume scaling), or a single-block CIF containing fractional sites and explicit symmetry operations. CIF special positions are deduplicated. CIF files without symmetry operations must explicitly declare P1; other space groups need their operations or a structure already expanded to P1.
- Set the Miller indices, surface termination phase, slab thickness, and emission angle measured from the surface normal. The model sums `exp(−z/(λ cos θ))` over the periodic atomic layers in the finite slab.
- The table shows absolute cross sections, IMFP, the reference 95% information depth, attenuation-weighted areal atom density, yield `Y = σ × Neff`, and relative peak areas. Binding energies, individual-component cross sections, and IMFPs can be overridden; the reset links restore reference/automatic values.
- Optional photon flux, collection solid angle, acquisition time, and transmission/detection efficiency convert yield to integrated counts. These defaults are illustrative and require instrument calibration for absolute predictions.
- Export CSV to retain the structure, material and instrument settings, calculated results, data provenance, and missing-data flags. This separate app does not persist its inputs between page loads and does not upload structures.

This is a homogeneous, unrelaxed, periodic crystal slab model with a flat surface. It does not include elastic scattering, diffraction, angular asymmetry/polarization, roughness, reconstruction, photon absorption, or different scattering materials along the escape path. It uses the specified vacuum kinetic-energy convention for the TPP-2M input as an approximation. The reference 95% information depth describes a semi-infinite continuum, not the cumulative depth of the discrete finite slab. Area fractions are **not atomic concentrations**.

The basic IMFP energy range is 50–2000 eV; values from 2000–10000 eV are explicitly marked as extrapolations. Other energies require a manual IMFP. Missing cross sections or IMFPs stay missing and are excluded from area normalization, while inaccessible orbitals have zero yield. Imported structures do not infer density, molar mass, Nv, or band gap: update the material fields for the actual specimen. See [the calculation model](docs/escape-depth-model.md) for definitions and validation.

Run the regression tests with `node tests/run-tests.js` and `node tests/escape-depth.test.js`. With Playwright available and Microsoft Edge installed, `node tests/escape-depth.browser.js` runs the browser checks using temporary data inside `.browser-qa/`; screenshots and the exported CSV are written there. A Playwright module location can be supplied through the process variable `PLAYWRIGHT_MODULE`, and an alternative browser executable through `XPS_BROWSER_EXE`.

> [!NOTE]
> You can open `index.html` directly, but using a local HTTP server is recommended to avoid browser security restrictions.

## Basic Usage

### 1. Select Elements and Visualize Reference Peaks

Use the `Periodic table` at the bottom of the screen to select elements that may be present in the sample. Selected elements are highlighted, added to `Selected elements`, and shown as vertical reference lines in the `Energy map`.

![Elements selected in the periodic table and displayed as reference peaks in the Energy map](docs/images/usage-reference-map.svg)

- `Core` displays binding energies, and `Auger` displays Auger transitions. Both can be shown at the same time.
- `PIcross` switches photoionization weighting on or off. When enabled, core-line heights show relative photoionization cross sections at the selected photon energy; hover over a line to see its absolute cross section in megabarns (Mb) and its percentage of the strongest selected line. When disabled, core levels are drawn as equal-height reference lines and the cross-section axis is hidden.
- Switch the horizontal axis between `Binding energy` and `Kinetic energy`.
- Click a selected element card to temporarily hide it, use `x` to remove it, or use `Clear selection` to clear all selected elements.
- Choose the excitation source from `Al K-alpha`, `Mg K-alpha`, `Cr K-alpha`, `Cu K-alpha`, `Ga K-alpha`, or `Custom`, then adjust `Photon energy` and `Work function` if needed.

### 2. Inspect Exact Energy Values

Open `Selected elements` in `Peak energies` to see the energy values for each selected element and level. The `Core` / `Auger` selection and energy-axis mode are shared between the plot and the table.

![Binding energies listed for selected elements](docs/images/usage-energy-table.svg)

Values shown in red exceed the current excitation photon energy and are therefore not observable under that source. These are reference values, so measured peaks may not match them exactly.

### 3. Search Candidate Elements from a Peak Energy

If a peak is unknown, switch the table to `Energy search`. Enter the measured value in `Peak energy` and the allowed window in `Search width (+/-)`. The table lists matching elements, levels, and energy differences.

![Candidate elements found by searching around a 285 eV peak](docs/images/usage-energy-search.svg)

Use `Include higher orders` when you want to include peaks excited by higher-order photons. Candidate assignment should also consider sample composition, other observed peaks, and measurement conditions.

### 4. Overlay Measurement Data

Use `Add XY files` in `Measurement data` to add one or more local XY files. Check the regions you want to display, and the selected spectra will be overlaid on the `Energy map`.

![Measurement spectra overlaid on reference peaks with analysis actions available](docs/images/usage-measurement-analysis.svg)

Drag across the plot to open actions for the selected energy range:

- `Zoom both axes` / `Zoom horizontal axis` / `Zoom vertical axis`: zoom the selected range
- `Constant background`: subtract a constant background
- `Normalize height`: normalize by the maximum intensity in the selected range
- `Normalize area`: normalize by the integrated area in the selected range

Analysis results are saved as new states. Use `Data state` to switch between the original `raw` data and processed states. Double-click the plot to autoscale.

### Adjusting the Display

- `Edit plot layout`: edit line style, markers, color, offsets, and plot order
- `Even offsets`: apply evenly spaced offsets to multiple spectra
- `Legend`: show the legend, drag it to reposition it, and double-click items to edit names and font sizes

## Saving Data and Resetting

Loaded measurement data, selected elements, analysis results, and plot settings are automatically saved to IndexedDB in the browser and restored the next time you open the app in the same browser.

Saved state is separated by origin, so local development, Vercel Preview URLs, and the production URL do not share the same workspace. `Reset all` in the upper-right corner deletes the saved workspace and returns the app to its initial state.

Added XY files are read in the browser and stored in IndexedDB. This app does not upload measurement data to the application server.

## XY File Format

The app reads text files containing comment headers and two-column `energy counts/s` data. A single file can contain multiple `Region` sections.

```text
# Group: Sample 1
# Region: C 1s
# Spectrum ID: 1
# Excitation Energy: 1486.6
# Cycle: 1, Curve: 1
# ColumnLabels: energy counts/s
1200.0 1532.4
1199.9 1540.8
```

## Notes and Disclaimer

- Reference binding energies are neutral-atom values. Actual peak positions can shift with chemical state, charging, excitation source, calibration, and work function.
- Core levels above the current excitation photon energy are not shown in the plot.
- Photoionization cross sections use the [Yeh-Lindau tabulation digitized by Kalha et al.](https://doi.org/10.6084/m9.figshare.12389750.v3) (CC BY 4.0). Values between tabulated photon energies use monotone cubic interpolation in log-log space. Spin-orbit components share the tabulated subshell cross section according to their statistical weights. A short high-energy extrapolation (at most 25% above the final tabulated energy) supports the Ga K-alpha preset and is identified in the line tooltip.
- Do not use this app alone for definitive elemental or chemical-state identification. Compare results with calibrated measurements, standards, and literature values.

## Privacy

Measurement files are processed in your browser and saved locally in IndexedDB. The app does not upload XY files or generated analysis data to the application server.

The public site uses Vercel Analytics for aggregate page usage metrics. File contents and locally saved measurement data are not sent by the app as analytics events.

## Project Structure

- `index.html`: application entry point
- `assets/css/`: styles
- `assets/js/`: application logic, binding-energy data, and photoionization cross-section data
- `docs/images/`: documentation images
- `vercel.json`: minimal static-site configuration for Vercel

## Repository

<https://github.com/ISSP-Matsuda-lab/XPS-Explorer>

## License

This project is published under the [MIT License](LICENSE).
