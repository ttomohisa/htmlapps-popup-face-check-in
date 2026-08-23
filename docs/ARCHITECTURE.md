# Architecture

Pop-up Face Check-in is a local-first single-HTML application derived from `htmlapps-template`.

## Runtime flow

1. A user registers one face photo per person and optionally adds up to two more.
2. YuNet detects a face in ONNX Runtime Web.
3. Canvas / JavaScript aligns the five landmarks to the SFace template.
4. SFace INT8 generates a 128-dimensional matching vector.
5. The app compares vectors locally and records a check-in or entry/exit event only when the configured conditions are met.
6. Camera frames and original registration photos are not retained.

## Storage

Retention is selected per session: today only, until the browser closes, or manual deletion. Persistent modes use browser storage; the browser-session mode uses temporary session storage. Encrypted `.popupface` files can carry registration data between devices without including check-in history.

## Distribution

`src/index.template.html` is the editable application source. `build-standalone.ps1` embeds pinned ORT/model assets into `dist/index.html`. Large assets are gzip-compressed before Base64 embedding when it materially reduces size. The generated standalone HTML blocks runtime network connections with CSP and writes `dist/build-size-report.json`.

The specialized builder is intentionally retained instead of the generic template asset pipeline because the ORT `.mjs` + `.wasm` bootstrap requires app-specific object URLs and has already been optimized for this product.
