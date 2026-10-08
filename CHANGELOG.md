# Changelog

## 1.0.1 - 2026-10-08

- Normalize header EN / JA labels and localized language/Help tooltips and accessible names.
- Keep the visible app version and release metadata synchronized; normalize existing Japanese local-processing badges without changing processing behavior.

## Unreleased

- Add history name search, All / Manual / Face matching filters, a shown/total count, and a clear-filter action in Japanese and English. Filters are display-only; session totals, recent activity, and CSV/JSON exports continue to use all history.
- Label history exports explicitly as full-history exports and reset filters when a session is cleared or replaced.
- Ignore overlapping manual actions for the same person while their save is pending, preventing an unintended immediate entry/exit pair. Sequential entry/exit and independent people remain available.
- Add synthetic-only regressions for filtering, full export privacy, manual concurrency, Undo, and session reset behavior.

### Rename to Pop-up Face Check-in

### Fixed

- Fixed standalone startup failure caused by blocking ONNX Runtime's embedded `blob:` WASM fetch. Release CSP now allows `connect-src blob:` while continuing to block HTTP/HTTPS runtime connections.
- UI icons were unified with lightweight line SVGs, including secure file actions and navigation.
- Password fields now support standard eye-button show/hide controls.

- Rename the app to **Pop-up Face Check-in** and the repository to `htmlapps-popup-face-check-in`.
- Reframe the product as a temporary, local face-matching check-in tool for events, receptions and gatherings.
- Replace authentication/recognition-oriented wording in the UI with plain reception terms such as face matching, match, and check-in complete.
- Rename the main “チェック” navigation to “受付” and “チェック結果” to “照合結果”.
- Keep the existing internal storage keys for backward compatibility with data created by earlier builds.
### Standalone gzip packaging

- Gzip the embedded ONNX Runtime WASM before Base64 encoding.
- Measure ORT MJS, YuNet and SFace INT8 compression and use gzip only when it saves at least 5%.
- Cache generated `.gz` files in `assets/` to avoid recompressing unchanged runtime files on every build.
- Keep normal local execution on the original raw runtime/model files.
- Print per-asset raw/gzip sizes and the final standalone HTML size during `build-standalone.bat`.

### SFace INT8 lightweight model

- SFaceをFP32（36.9 MiB）からONNX Runtime互換の標準INT8（約9.4 MiB）へ変更
- SFaceモデル部分を約74%削減
- INT8モデルのサイズ・SHA-256検証をsetup-assetsへ追加
- IndexedDBにembeddingModelを保存し、旧FP32特徴量との混在照合を防止
- 旧FP32登録者は再登録が必要なことをUIで案内
- 起動表示にINT8モデルと初期化時間を表示


## 1.0.0 - 2026-08-21

- Improve real-time recognition feedback with distinct checked-in, already checked-in, confirming, review, and unknown states.
- Add an in-camera status badge, two-step confirmation progress, threshold/margin indicators, and collapsible Top 3 candidates.
- Keep raw cosine similarity visible without presenting it as a probability percentage.
- Add CSV and JSON export for check-in history without biometric data.
- Add UTF-8 BOM CSV output and spreadsheet-formula escaping for names.
- Add a dedicated check-in history screen sorted newest first.
- Show checked-in / remaining counts, latest time, stored similarity score, and per-entry check-in reset.
- Add camera-based real-time face check-in with YuNet + SFace.
- Require two consecutive matches before automatically recording a check-in.
- Preserve the first check-in time when an already checked-in person is recognized again.
- Add check-in status/count and per-person check-in reset.
- Stop the camera when leaving the check screen or hiding the page.
- Add front/rear camera switching for mobile devices.
- Keep photo matching as a non-check-in diagnostic mode with Top3 scores.
- Fix BGR/RGB conversion when generating saved face thumbnails.
- Allow Emscripten Embind dynamic JavaScript generation under CSP for the current OpenCV.js build.
- Allow WebAssembly compilation with `'wasm-unsafe-eval'`; the current Embind build additionally requires `'unsafe-eval'`.
- Initial implementation (formerly Face Check) with bulk registration, IndexedDB persistence, 96×96 thumbnails, 128-D cosine matching, daily expiry, and local data deletion.

## Unreleased

- Align the repository shell and documentation with `ttomohisa/htmlapps-template`, including `APP_SPEC.md`, `app.config.json`, dependency metadata, AGENTS guidance, offline/security notes, standalone verification, and build-size reporting.
- Replace the bespoke smartphone navigation with the template-style safe-area-aware fixed mobile bottom bar and add the standard footer / reduced-motion behavior.
- Add representative desktop and smartphone screenshots under `assets/` using fictional sample data only.

- Add session use modes: one-time check-in and repeatable entry / exit with re-entry support.
- Add a face-leave guard in entry / exit mode so one continuous camera view cannot immediately create opposite events.
- Add registered-person name search and all / pending / done filters, relabeled as outside / inside in entry / exit mode.
- Add manual person search directly inside reception mode.
- Add a reception preflight dialog for registered people, face-matching readiness, camera availability and permission state.
- Warn on likely duplicate face registration and let the operator add the photo to the existing person, register separately, or skip.
- Replace the native matching-data removal confirm with an app-styled confirmation dialog and Undo.
- Keep normal match settings to three plain-language presets; move numeric sliders and raw result metrics under advanced details.
- Flatten entry / exit events into history, recent activity, CSV and JSON exports, with per-event cancellation and Undo.


- 登録者削除の前に、名前・照合用データ件数・受付状態を確認できるダイアログを追加
- 登録者削除後は従来どおりトーストの「元に戻す」で復元可能

- 登録者名だけを保存する「参加者リストCSV」を追加
- 名前・代表用の小さな顔画像・最大3件の照合用データを `.popupface` として保存 / 読み込みできる機能を追加
- `.popupface` はWeb Cryptoでパスワード保護し、受付履歴と保存期間はファイルに含めない
- 読み込み時に現在の登録へ追加 / 置き換えを選択し、同一登録IDの重複を防止
- 読み込み先で保存期間を再選択し、現在の顔照合方式との互換性を検証
- 生体情報を含む登録データファイル自体も慎重に取り扱い、不要時に削除する注意をUIへ追加

- 受付取消の前に確認ダイアログを表示
- 受付取消後のトーストから「元に戻す」で受付時刻・受付方法・一致度を復元
- ブラウザを閉じるまでモードでも受付方法を正しく保持

- 登録者カードからの手動受付を追加し、顔照合が通らない場合の受付手段を用意
- 手動受付を履歴・直近の受付・CSV / JSONで顔照合による受付と区別
- 手動受付直後はトーストから取り消し可能

- UI上の専門用語を平易な表現へ変更
- 保存期間を登録データを保持したまま変更できる導線を追加

### Session retention and multi-embedding

- Add session creation with three retention modes: Today only / Until browser closes / Delete manually.
- Require acknowledgement of biometric-data handling precautions before starting a new session.
- Show the active retention mode in the normal UI and reception mode.
- Automatically delete Today-only data when the date changes, not only on the next startup.
- Store browser-session data in `sessionStorage` instead of persistent IndexedDB.
- Add up to three SFace embeddings per person; matching uses the highest cosine score for each person.
- Keep only the representative thumbnail; second/third source photos and extra thumbnails are not stored.
- Add an explicit non-undoable Delete all face data dialog with person / embedding / check-in counts.
- Expand privacy guidance for face thumbnails and embeddings.

- Add a dedicated reception mode that emphasizes the camera, current decision, attendance counts, and recent check-ins.
- Add camera guidance for face position, distance, brightness, and multiple faces without changing the recognition threshold.
- Add a recent three check-ins panel to the check screen.
- Add a bulk-registration completion summary with skipped-file reasons and in-memory retry for skipped photos.
- Fix YuNet 2026may ONNX Runtime decoding for its 12 outputs (`cls/obj/bbox/kps` at strides 8/16/32).
- Include actual ONNX output names/shapes in parsing errors for easier diagnostics.

### ONNX Runtime YuNet parity fix
- Match OpenCV FaceDetectorYN preprocessing: preserve source resolution and pad only right/bottom to multiples of 32.
- Match OpenCV score calculation: `sqrt(clamp(cls) * clamp(obj))` with the existing 0.9 threshold.
- Use BGR 0-255 for YuNet and RGB 0-255 for SFace, matching the OpenCV wrappers.

### Registration rendering safety
- Escape imported person IDs and stored event IDs in card, history and manual reception attributes without changing identifier values.
- Add dependency-free rendering regression tests and run them in pull request validation.
- Save the existing Japanese PowerShell check as UTF-8 with BOM for Windows PowerShell 5.1 compatibility.
