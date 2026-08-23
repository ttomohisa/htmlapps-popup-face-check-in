# APP_SPEC.md

## 1. Product identity

- **Name:** Pop-up Face Check-in
- **Purpose:** イベント・受付・集まりで一時的に使う、端末内完結の顔照合受付ツール。
- **Primary users:** 飲み会・社内イベント・セミナー・学校/サークル・スポーツ大会・展示会などの受付担当者。
- **Release artifact:** `dist/index.html`

## 2. Product principles

- 「本格的な顔認証基盤」ではなく、一時的な受付・入退場確認に限定する。
- 顔照合は本人確認を保証しない。重要な本人確認やセキュリティゲート用途には使わない。
- 顔画像・照合用データは端末内だけで処理し、実行時に外部へ送信しない。
- 生体情報として慎重に扱うことをUI上で明示し、不要になったら全削除できるようにする。
- ライトテーマのみ。スマートフォンを主要な利用環境として扱う。

## 3. Core user flow

1. 起動時に利用方法（受付 / 入退場）と保存期間を選択する。
2. 生体情報の取扱い注意を確認してセッションを開始する。
3. 1人1枚の顔画像をまとめて登録し、必要な人だけ最大3枚まで追加する。
4. 受付画面でカメラを開始し、同じ人物が連続一致した場合のみ自動記録する。
5. 顔照合できない場合は登録者検索から手動で受付 / 入退場を記録する。
6. 履歴を確認し、必要なら確認ダイアログ付きで記録を取り消し、直後はUndoできる。
7. 利用終了後は受付結果をCSV / JSONで保存し、顔データを全削除する。

## 4. Functional requirements

- YuNet + SFace INT8をONNX Runtime Webで実行する。
- OpenCV.jsを使用せず、画像処理・顔位置合わせはCanvas / JavaScriptで行う。
- 1人につき1〜3件の照合用データを保持し、最大一致度を人物スコアとする。
- 保存期間は「今日だけ / ブラウザを閉じるまで / 手動で削除」。
- 登録情報はパスワード保護した `.popupface` で持ち運べる。
- 受付履歴のCSV / JSONに顔画像・照合用データを含めない。
- 破壊的操作はアプリ内確認ダイアログを使う。
- 可逆操作はトーストのUndoを提供する。
- 日本語 / 英語をリロードなしで切り替えられる。
- スマートフォンではテンプレート標準の固定下部ナビゲーションを使う。

## 5. Data and privacy

保存対象: 名前、代表用の小さな顔画像、1人1〜3件の照合用データ、登録日時 / 保存期限、受付または入退場履歴。

保存しないもの: 登録元画像、2枚目・3枚目の追加写真そのもの、カメラ映像 / 照合フレーム。

## 6. Non-goals

法的な本人確認、セキュリティゲート、恒久的なアクセス制御、クラウド同期、アカウント管理、長期的な生体情報データベース。

## 7. UX and accessibility

- 320px幅から操作できるモバイルファーストUI。
- ヘッダー右上から「使い方と注意事項」を開ける。
- キーボードフォーカスを可視化する。
- `prefers-reduced-motion` を尊重する。
- スマートフォンはテンプレート標準のsafe-area対応下部バーを使う。
- ステータス変更は `aria-live` で通知する。

## 8. Performance

- 受付中のUIを推論で固めない。
- カメラ推論は約0.8秒間隔。
- 単一HTMLはgzip内包により実用的なサイズを維持する（現状約13MB）。

## 9. Browser target

Current stable Chromium / Firefox / Safari on desktop and mobile. Camera use requires localhost or HTTPS.

## 10. Acceptance criteria

- `setup-assets.bat` で固定バージョンの実行資産を取得できる。
- `build-standalone.bat` で `dist/index.html` を生成できる。
- 配布版のCSPは実行時ネットワーク接続を禁止する。
- `dist/build-size-report.json` に内包サイズの内訳を出力する。
- スマホ下部バー、ヘルプ、確認ダイアログ、Undo、safe areaが機能する。
- `assets/screenshot.png` と `assets/screenshot-mobile.png` が現在UIを表す。
- ダークモードを追加しない。
