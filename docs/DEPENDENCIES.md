# Dependencies

`dependencies.json` lists runtime and model versions, licenses, and asset paths. `scripts/setup-assets.ps1` downloads ONNX Runtime Web 1.22.0 at versioned URLs and verifies both model files against their expected sizes and SHA-256 hashes.
The generated `dist/index.html` embeds ONNX Runtime Web, YuNet, and SFace INT8; it does not fetch them at runtime.
The `blob:` connect source loads the embedded ONNX Runtime WASM payload. YuNet 2026may is distributed under MIT and SFace 2021dec INT8 under Apache-2.0. The offline third-party notices include model-specific licenses and the upstream runtime notices. [Third-party notices](../THIRD_PARTY_NOTICES.md)
