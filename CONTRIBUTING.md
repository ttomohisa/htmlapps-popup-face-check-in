# Contributing

## Development principles

- Preserve the one-file release artifact.
- Keep face data and matching local to the browser.
- Keep runtime network access disabled in the generated standalone HTML; `blob:` is allowed only for the embedded ONNX Runtime WASM bootstrap.
- Treat smartphone interaction, keyboard operation, accessibility, and explicit biometric-data handling as core requirements.
- Keep dependencies pinned and auditable.
- Prefer reversible action + Undo when recovery is safe; use styled confirmation for destructive or high-risk actions.
- Never edit generated `dist/index.html` directly.

## Workflow

1. Update `APP_SPEC.md` when behavior changes.
2. Modify `src/index.template.html`, configuration, or scripts.
3. Run `scripts/check-repository.ps1`.
4. Run `build-standalone.bat` and review `dist/build-size-report.json`.
5. Test desktop/mobile, Japanese/English, camera flow, manual reception, import/export, retention, and delete flows.
6. Update README, changelog, notices, and security documentation when relevant.
