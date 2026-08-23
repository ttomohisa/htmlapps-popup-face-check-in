# Dependencies

Runtime/model assets are pinned in `dependencies.json` and downloaded locally by `scripts/setup-assets.ps1`.
The generated `dist/index.html` embeds ONNX Runtime Web, YuNet, and SFace INT8; it does not fetch them at runtime.
The `blob:` connect source is used only to instantiate the embedded ONNX Runtime WASM payload.
