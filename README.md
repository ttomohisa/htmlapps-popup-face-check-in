# Pop-up Face Check-in

[![GitHub Pages](https://github.com/ttomohisa/htmlapps-popup-face-check-in/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/ttomohisa/htmlapps-popup-face-check-in/actions/workflows/deploy-pages.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Single HTML](https://img.shields.io/badge/distribution-single%20HTML-0ea5e9)](https://ttomohisa.github.io/htmlapps-popup-face-check-in/)

[日本語版 README](README.ja.md)

A privacy-focused, single-HTML face-matching check-in app for temporary events and gatherings. Register participants, match faces at reception, fall back to manual check-in when needed, and remove the data when the event is over.

Face matching runs locally in the browser. The app does not upload registration photos or camera frames to a server.

## 🚀 Live demo

### [Open Pop-up Face Check-in on GitHub Pages](https://ttomohisa.github.io/htmlapps-popup-face-check-in/)

GitHub Pages delivers the initial HTML. After it loads, face detection, feature extraction, matching, registration, history, and export are processed locally on your device. Runtime/model assets are embedded in the generated standalone HTML.

[![Pop-up Face Check-in registration screen with English controls](assets/screenshot-en.png)](https://ttomohisa.github.io/htmlapps-popup-face-check-in/)

The screenshot shows the registration screen in English. See the [Japanese registration screen](assets/screenshot.png) and the [mobile check-in screen](assets/screenshot-mobile.png).

## Features

- **Run reception without a server** — Face detection and matching stay in the browser, with no account, backend, analytics, or cloud database required.
- **Register once and handle real reception flow** — Add participants in batches, keep up to three matching samples per person, search the list, and use manual check-in when face matching is difficult.
- **Choose check-in or entry/exit tracking** — Record one-time attendance or repeated entry, exit, and re-entry events from the same app.
- **Recover from mistakes safely** — Check-in cancellation, participant deletion, and matching-data removal use clear confirmation and Undo where recovery is safe.
- **Carry registration data between devices** — Save encrypted `.popupface` registration files with password protection, then import them on another device without including attendance history.
- **Keep retention explicit** — Choose today only, until the browser closes, or until manually deleted, with a dedicated command to remove all face-related data.

## Quick start

### Use the web demo

Open the [GitHub Pages demo](https://ttomohisa.github.io/htmlapps-popup-face-check-in/). No installation or account is required.

Camera access requires a secure context. GitHub Pages uses HTTPS, so modern browsers can request camera permission normally.

### Use an offline release

Download the versioned `.html` file from [GitHub Releases](https://github.com/ttomohisa/htmlapps-popup-face-check-in/releases/latest) and open it in your browser. If you downloaded the distribution ZIP, extract it and open `dist/index.html`. Both contain the runtime and models. For camera use, grant permission when prompted. If your browser restricts the camera for local files, open the standalone HTML through localhost or HTTPS. Name-only registration and manual check-in work without a camera.

### Build a fully standalone HTML file

1. Download or clone this repository.
2. Double-click `setup-assets.bat` on Windows once to download the pinned runtime and models.
3. Double-click `build-standalone.bat`.
4. Copy `dist/index.html` wherever you need it.
5. Open that single HTML file in a current browser.

Python and Node.js are not required. The setup/build scripts use Windows PowerShell.

### Local development

From a source checkout, run `setup-assets.bat` once. To serve the editable source and local assets, run

```bat
start-local.bat
```

Then open the local URL printed by the script. `localhost` is treated as a secure context by modern browsers, so camera access is available during development.

## Usage

1. Select Japanese or English in the setup dialog, then choose **Check-in** or **Entry / exit**.
2. Choose **Today only**, **Until the browser is closed**, or **Delete manually**. Review the handling precautions, select the acknowledgement, and start the session.
3. Choose **By photo** or **By name** in Register. When adding a name that already exists, enter a group or ticket number to distinguish the guests. A participant registered with photos can have up to three matching samples; original registration photos are not retained by the app after processing.
4. Open **Check in**. To use face matching, register at least one person by photo and start the camera. The app requires two consecutive matches before recording attendance. **Reception mode** opens a preflight check for the roster, matching engine, and camera.
5. In manual reception, search for an attendee and record their attendance. If the name is missing, add the guest and then check them in. Choose Undo in the same dialog to correct the last record.
6. Review recent activity and history. Search history by name, filter by All / Manual / Face matching, and check the shown/total count. Check-in or entry/exit records can be cancelled after confirmation, with Undo immediately afterward.
7. Export all attendance history as CSV or JSON when needed. History filters affect only the displayed list; both exports always include every record in the session. These exports do not include face thumbnails or face-matching data.
8. Open **History → Finish session** to review the full record count and optionally save a CSV. **Review data to delete** opens a separate confirmation for deleting the local roster and history. The app cannot delete exported files. Remove any CSV, JSON, or `.popupface` files you no longer need.

### Check-in and Entry / Exit modes

**Check-in** stores the first attendance time for each person and does not overwrite it on later matches.

**Entry / Exit** records repeated entry, exit, and re-entry events in chronological order. After recording a person, automatic matching for that same person is temporarily locked until their face leaves the camera view, preventing an immediate entry → exit pair from one continuous appearance.

Manual entry/exit ignores repeated activations for the same person while their save is pending. You can still record another person, or record a later exit after the entry finishes saving.

### Matching settings

Choose **Easier match**, **Standard**, or **Stricter**. Open the advanced settings to adjust the similarity threshold and the minimum difference between the two best candidates.

The default behavior uses:

- Similarity threshold: `0.50`
- Top1 − Top2 margin: `0.06`
- Automatic check-in: the same person must match `2 consecutive times`
- Camera inference interval: approximately `0.8 seconds`

Test with the actual cameras, lighting, and registration photos you plan to use before a real event.

## Registration data files

Open **People** to see how many people are registered, how many have checked in (or are currently inside), and how many matching samples are stored. Choose **Name list → Save CSV** for the names CSV. Under **Registration file**, choose **Load** or **Save** for an encrypted roster.

### Participant list CSV

Contains names only. It does **not** include face thumbnails, matching data, or attendance history.

### Encrypted `.popupface` registration file

The file carries participant names, IDs, registration times, optional group or ticket details, and model compatibility information. Each photo registration includes a small thumbnail and up to three matching samples. A photo-only roster uses file format 1. A roster containing any name-only registrations uses format 2 and requires v1.1.0 or later to import. Both formats exclude attendance history and retention settings.

Choose a password of at least eight characters. The app uses Web Crypto to encrypt the file and does not store the password. On import, enter the password, check the preview, and select the retention period. **Add to current registration** keeps the current history and skips matching participant IDs. **Replace current registration** replaces the roster and clears its attendance history. Export any history you need first.

Because `.popupface` files contain data that can be used to identify people, treat them as sensitive files. Avoid unnecessary sharing or long-term storage, and delete them when they are no longer needed.

## Publish with GitHub Pages

The repository includes a workflow that builds the standalone HTML and deploys it to GitHub Pages.

1. Push the repository to GitHub as `htmlapps-popup-face-check-in`.
2. Open **Settings → Pages → Build and deployment → Source** and select **GitHub Actions**.
3. Run `setup-assets.bat` locally when developing, or let the repository workflow prepare the required build inputs as configured.
4. Push to `main`, or manually run **Deploy standalone app to GitHub Pages** from the Actions tab.
5. After a successful deployment, the app is available at `https://ttomohisa.github.io/htmlapps-popup-face-check-in/`.

## Development and build layout

The repository follows [`ttomohisa/htmlapps-template`](https://github.com/ttomohisa/htmlapps-template) and keeps the application source separate from generated output.

```text
.
├─ src/index.template.html       # Application source
├─ app.config.json               # App/build configuration
├─ dependencies.json             # Runtime/model metadata
├─ setup-assets.bat              # Download pinned ORT/model assets
├─ build-standalone.bat          # Windows build entry point
├─ build-standalone.ps1          # Standalone HTML builder
├─ scripts/                      # Setup, verification, and template tooling
├─ components/                   # Reusable htmlapps-template UI references
├─ assets/
│  ├─ screenshot.png
│  └─ screenshot-mobile.png
└─ dist/index.html               # Generated single-HTML artifact
```

Do not edit generated files in `dist/` directly. Update `src/index.template.html`, configuration, or build scripts instead.

### Update runtime and models

Runtime/model versions are pinned by the repository configuration and setup script. Run:

```bat
setup-assets.bat
```

The setup verifies the official YuNet and SFace model files before use. The current runtime is ONNX Runtime Web 1.22.0; OpenCV.js is not included at runtime.

### Standalone build

```bat
build-standalone.bat
```

The build embeds ONNX Runtime Web, WASM, YuNet, and SFace into `dist/index.html`. Large assets are gzip-packed when it materially reduces size and are expanded locally with `DecompressionStream` at startup.

The build also writes `dist/build-size-report.json` so size regressions can be reviewed.

## Privacy and runtime network protection

Face thumbnails and face-derived matching data can identify people and should be handled carefully.

The app is designed so that:

- Registration source photos are processed locally and not retained after registration. For skipped photos, the page keeps the file name and reason so you can choose replacements.
- Additional second/third registration photos are discarded after their matching data is created.
- Camera frames and live matching frames are not saved.
- Face matching data is not sent to an application server.
- Attendance CSV/JSON exports exclude face thumbnails and matching data.
- `.popupface` exports are password-protected and exclude attendance history.
- A complete face-data deletion action removes registered people, thumbnails, matching data, and attendance state from the app's local/session storage.

The standalone build blocks normal HTTP/HTTPS runtime connections. `blob:` is allowed by Content Security Policy because ONNX Runtime must load the WASM module that is already embedded in the HTML. This does not permit the app to fetch remote HTTP/HTTPS resources.

Before using the app, confirm the purpose, necessity, consent requirements, and organizational rules that apply to handling face-related data in your environment.

## Limitations

- This tool is for temporary event reception and attendance workflows. It is **not** intended for legal identity verification, access-control security gates, or other high-assurance authentication.
- Face matching can produce false matches or missed matches. Manual check-in is provided as a fallback.
- Accuracy depends on lighting, camera quality, face angle, expression, registration photos, and threshold settings.
- A participant's second and third registration photos improve matching variety but do not guarantee recognition in all conditions.
- Browser storage can be cleared by the user, browser, device policy, or private-browsing behavior. Export registration data when you need a portable backup.
- `Until the browser closes` uses browser session storage semantics; session-restore features can affect when that data disappears. Use explicit deletion when certainty matters.
- Camera behavior and available camera devices vary by browser and operating system.

## Dependencies

| Component | Version | License | Purpose |
| --- | ---: | --- | --- |
| ONNX Runtime Web | 1.22.0 | MIT | Browser-side ONNX inference |
| YuNet | 2026may | MIT | Face detection and landmarks |
| SFace INT8 | 2021dec-int8 | Apache-2.0 | Face feature extraction for matching |

Face alignment, YuNet post-processing, cosine matching, storage, encryption, and the application UI are implemented directly in browser JavaScript/Canvas APIs. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for details.

## Contributing

Bug reports and feature proposals are welcome through GitHub Issues. See [CONTRIBUTING.md](CONTRIBUTING.md) for development guidance and [APP_SPEC.md](APP_SPEC.md) for the product contract.

## License

Copyright © 2026 ttomohisa

Licensed under the [MIT License](LICENSE).

## Regression validation

Use Node.js 22 or later and PowerShell for repository validation. After building both `dist/index.html` and `popup-face-check-in.html`, run `node scripts/test-regressions.cjs`. The gate runs all source tests and the application regressions against both release copies, failing on any test or missing prerequisite. `--source-only` runs the complete source suite without rebuilding. The standalone build remains Node-free. Verify scrolling, touch, focus, and camera behavior in a real browser. For offline release checks, follow [VERIFY_OFFLINE.md](VERIFY_OFFLINE.md).
