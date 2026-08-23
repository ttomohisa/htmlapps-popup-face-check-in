# AGENTS.md

This repository is a derived application of `ttomohisa/htmlapps-template`.
Read `APP_SPEC.md` before changing product behavior.

## Product constraints

- Keep the product name **Pop-up Face Check-in** and repository target `htmlapps-popup-face-check-in`.
- This is a temporary, local-first face-matching check-in tool, not an identity-proofing or access-control platform.
- Avoid authentication-oriented user-facing wording. Prefer 顔照合 / 照合 / 一致しました / 受付完了.
- Treat face images and face-derived matching data as sensitive personal data. Keep retention controls and explicit delete-all behavior visible.
- Do not upload face data, camera frames, names, or check-in history to a server.
- Keep light theme only.
- Keep Japanese / English UI and smartphone usability.

## Architecture constraints

- Runtime: ONNX Runtime Web 1.22.0 WASM.
- Detection: YuNet 2026may.
- Matching: SFace 2021dec INT8.
- Alignment / image processing: Canvas + JavaScript. Do not reintroduce OpenCV.js without an explicit product decision.
- One person may hold up to three face-matching vectors; use the maximum similarity as that person's score.
- Preserve the app-specific gzip standalone builder. It is intentionally specialized for ORT assets and currently keeps the single HTML near 13 MB.
- `dist/index.html` is generated. Edit `src/index.template.html`, not `dist/index.html`.

## Template alignment

- Reuse the `htmlapps-template` visual shell and interaction conventions where they fit.
- Use an app-styled confirmation dialog for destructive/high-risk actions.
- Use Undo toasts for reversible actions.
- Use the safe-area-aware fixed mobile bottom bar for persistent smartphone navigation.
- Respect `prefers-reduced-motion` and visible keyboard focus.
- Keep the in-app help synchronized with user-facing behavior.
- Keep `app.config.json`, `APP_SPEC.md`, `dependencies.json`, security/offline notes, screenshots, and build-size reporting current.

## Before handoff

1. Run `check.bat` on Windows (or `scripts/check.ps1`).
2. Run `setup-assets.bat` if runtime assets are missing.
3. Run `build-standalone.bat`.
4. Check `dist/build-size-report.json`.
5. Open `dist/index.html` and verify registration, camera permission, face matching, manual fallback, history/export, retention changes, and delete-all.
6. Test at smartphone width and with the network disabled after the page is loaded.
