# Verify the offline release / 配布版のオフライン確認

## English

1. From a release, open the downloaded HTML or extract the distribution ZIP and open `dist/index.html`. From a source checkout, run `setup-assets.bat`, then `build-standalone.bat`, and confirm the app version and byte count in `dist/build-size-report.json`.
2. Open the browser’s Network panel. Disconnect the network and reopen the local HTML. Confirm the matching engine reaches its ready state and the app makes no HTTP or HTTPS requests for scripts, models, or participant data. Local `blob:` requests load the embedded WASM. The standalone CSP contains `connect-src blob:`.
3. Start a disposable session. Register a fictional name, record a manual check-in, export history, and save a password-protected `.popupface` roster. Check the CSV/JSON contains attendance and the encrypted roster can be imported into a fresh session without any history. Use **History → Finish session** to review and delete the test data. Remove the exported files separately.
4. For a camera test, use a compatible browser and grant permission. If camera access is restricted for local files, serve the standalone HTML on localhost. In a source checkout, `start-local.bat` starts a server after asset setup. Open `http://localhost:8765/dist/index.html` explicitly to test the built app. The default `/dev.html` page uses separate development assets. Use fictional or consented test material and keep personal face data out of public fixtures.

## 日本語

1. 配布版はダウンロードしたHTML、またはZIPを展開した中の `dist/index.html` を開きます。ソースから確認する場合は `setup-assets.bat`、`build-standalone.bat` の順に実行し、`dist/build-size-report.json` のバージョンとバイト数を確認します。
2. ブラウザのネットワークパネルを開き、ネットワークを切断して、ローカルのHTMLを開き直します。顔照合の準備が完了し、スクリプト・モデルの取得や参加者情報の送信でHTTP/HTTPS通信が発生しないことを確認します。内包WASMの読み込みにはローカルの `blob:` を使用し、配布版のCSPには `connect-src blob:` が含まれます。
3. テスト用のセッションで架空の名前を登録し、手動受付、履歴出力、パスワード付き `.popupface` の保存を試します。CSV/JSONに受付記録が入り、登録ファイルを新しいセッションに読み込むと履歴が空であることを確認します。「履歴」→「受付を終了」で内容を確認して削除し、出力したテストファイルも別途削除します。
4. カメラの確認には対応ブラウザで利用を許可します。ローカルファイルで利用できない場合は、配布用HTMLをlocalhostで開きます。ソースを取得した環境では、アセット準備後に `start-local.bat` を実行し、`http://localhost:8765/dist/index.html` を開きます。自動で開く `/dev.html` は別ファイルの開発用アセットを使います。テストには架空または同意を得た素材を使い、公開するテストデータに個人の顔画像を含めないでください。
