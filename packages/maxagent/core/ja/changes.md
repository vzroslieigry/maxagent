# maxagent の新機能

エージェントは更新後に一度だけ新機能をオーナーに見せ（ルール、第 8 節）、`experience/maxagent.md` に記録を残します。

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
