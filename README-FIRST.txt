Single HTML App Template
========================

1. Read README.ja.md.
2. Read APP_SPEC.md for this application's product contract.
3. Update app.config.json when product identity or build behavior changes.
4. Reuse the generic UI patterns in components/ where they fit.
5. Edit src/index.template.html; do not edit generated dist/index.html.
6. Run setup-assets.bat once to obtain pinned local runtime/model assets.
7. Run build-standalone.bat on Windows.
8. Review dist\build-size-report.json and test dist\index.html with the network disabled.

This repository follows ttomohisa/htmlapps-template, with an app-specific ONNX Runtime/model asset pipeline.
