# Architecture

Pop-up Face Check-in is a local-first single-HTML application derived from `htmlapps-template`.

## Runtime flow

1. Participants can be registered by name for manual reception. For camera matching, register one face photo per person and optionally add up to two more. The steps below describe the photo path.
2. YuNet detects a face in ONNX Runtime Web.
3. Canvas / JavaScript aligns the five landmarks to the SFace template.
4. SFace INT8 generates a 128-dimensional matching vector.
5. The app compares vectors locally and records a check-in or entry/exit event only when the configured conditions are met.
6. Camera frames and original registration photos are not retained.

## Storage

Retention is selected per session: today only, until the browser closes, or manual deletion. The two persistent modes keep the roster and attendance in IndexedDB with session metadata in localStorage. Browser-session mode stores them in the current tab’s sessionStorage. Password-encrypted `.popupface` files carry the roster, including optional distinguishing details. Photo-only rosters use format 1. Rosters containing name-only participants use format 2. Attendance and retention settings are excluded from both formats.

## Distribution

`src/index.template.html` is the editable application source. `build-standalone.ps1` embeds pinned ORT/model assets into `dist/index.html`. Large assets are gzip-compressed before Base64 embedding when it materially reduces size. The builder also writes the identical `popup-face-check-in.html` download copy and `dist/build-size-report.json`. The generated HTML blocks HTTP/HTTPS runtime connections with CSP. Its `connect-src blob:` directive permits the local WASM bootstrap.

The specialized builder is intentionally retained instead of the generic template asset pipeline because the ORT `.mjs` + `.wasm` bootstrap requires app-specific object URLs and has already been optimized for this product.
