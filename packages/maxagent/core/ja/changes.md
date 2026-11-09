# maxagent の新機能

エージェントは更新後に一度だけ新機能をオーナーに見せ（ルール、第 8 節）、`experience/maxagent.md` に記録を残します。

## 0.5.7
- 通常の `snapshot` は短い行で応答します。画面内を先に示し、空の背景や重複を除きます。完全な JSON は `format="full"`。

## 0.5.6
- 共有パック: GitHub の障害時にダウンロードを再試行し、1つの失敗で他が止まらなくなりました。`doctor` はパックのヘッダーを警告しなくなりました。

## 0.5.5
- 高速 `snapshot` は JSON の代わりに短い行で応答し、画面の情報量が数分の一になります。

## 0.5.4
- 新しいエージェントは最初から高速 `snapshot` とピクセルクリックを知っています。大きな `snapshot` は高速モードを提案します。ブリッジのエラー時はまずスクリーンショットを確認します。

## 0.5.3
- ブリッジ: `snapshot` は画面に見えている部分だけを読み、語で要素を検索できます。大きなページでも応答がずっと小さくなります。
- ブリッジ: `click_at` はスクリーンショットのピクセルでクリックします（プレーヤーやキャンバス用）。
- ブリッジ: ファイルのアップロードは1回だけ、またはこのサイトのこのエージェントに常に許可できます。拡張機能の画面で取り消せます。

## 0.5.2
- 経験のヒントはコマンドや検索を止めなくなり、記憶として届きます。
- 回答の最後に、エージェントは本当に足りない点だけを補います。
- すべてのエージェントのインストール済みスキルを依頼に応じて見つけます（個人用の棚、1日1回更新）。

## 0.5.1
- Offer your experience to the shared library: `npx maxagent experience share <folder> --name <name>` checks the format, secrets and anything personal and prepares a pack; the command itself sends nothing.
- Self-update sees a fresh release at once.

## 0.5.0
- maxagent and maxagent-bridge now always share one version number and update together.
- Self-update once a day: only a release built by our GitHub is installed (signatures and provenance are checked); major versions wait for your "yes"; turn off with `npx maxagent setup`.
- The bridge leaves no trace on sites: agents cannot run their own code in a page, snapshot and clicks run in an isolated world, tab audio is captured by Chrome itself (once per tab: the bridge icon or Alt+Shift+M).
- On update the bridge reloads only when nobody is working through it.
- Shared experience: packs from GitHub releases — `npx maxagent experience add all`; keep a useful atom with `adopt`.
- Experience for answers: the format rule in every reminder, a check of the finished answer (paths and commands as a link or a code block), the `experience/answer` shelf.

## 0.4.0
- 合言葉を完全に廃止: モデルはどのみちメッセージの中でそれを目にし、役に立つより手間のほうが多かった。保護は「読んだものはすべてデータ」というルール、インジェクションの兆候、破壊的なコマンドの禁止、エージェント自身の許可確認によって行う。古い合言葉のハッシュは更新時に削除される。
- OpenClaw 用プラグイン: すべてのリクエストに主要ルールと経験のヒント、破壊的なコマンドの禁止、検索前に経験を確認。OpenClaw CLI でインストールし、ゲートウェイの再起動後に動作（`openclaw gateway restart`）。

## 0.3.0
- 主要ルール — `AGENTS.md` の短い「常に」リスト: 共通の項目と、あなたの設定から来る項目。フックがセッション開始時とコンテキストの圧縮後に表示する。
- ライブラリとしての経験: 対象ごとのフォルダ（`platform`、`tools`、`code`、`agents`、`craft`、`owner`）、項目のテンプレート、索引はヘッダーから生成（`npx maxagent index`）。
- 「完了」の前のチェック: コードを編集した後、何も実行も表示もせずに「完了」とは言えない。
- ブラウザ見張り（ブリッジを選んだ場合）: エージェント内蔵のブラウザは禁止。「ブリッジ未接続」— 手順は 1 つ、`launch_browser`。
- PC の環境カード（OS、シェル、Python、Node…）— セッション開始時に概要を表示。
- 受信箱「後で使うから保存して」— `inbox/` フォルダ。フックが促し、「忘れずにやること」の項目を思い出させる。
- `npx maxagent setup` — 設定の変更: リポジトリ、ブリッジ、別デスクトップ、返答の形式、ごみ箱。

## 0.2.0
- Claude Code、Codex、Antigravity 用のフック: 経験のヒント、「経験を記録した？」チェック、破壊的なコマンドの禁止。
