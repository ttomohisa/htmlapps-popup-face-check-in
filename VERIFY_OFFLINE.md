# Offline / local-first verification

1. Run `setup-assets.bat`.
2. Run `build-standalone.bat`.
3. Confirm `dist/index.html` was created and review `dist/build-size-report.json`.
4. Open the generated HTML and verify registration-file export/import, history export, and non-camera UI.
5. For camera testing, use `start-local.bat` because browsers require a secure context for `getUserMedia()`.
6. In browser DevTools, enable Offline mode and confirm the generated standalone HTML does not attempt runtime network requests.
7. Confirm the release HTML CSP contains `connect-src blob:`.

Do not use real biometric data for repository screenshots or public test fixtures.
