# maxagent의 새 기능

에이전트는 업데이트 뒤 한 번 주인에게 새 기능을 보여 주고 (규칙, 8절) `experience/maxagent.md`에 기록을 남깁니다.

## 0.5.5
- 빠른 `snapshot`은 JSON 대신 짧은 줄로 응답하여 화면 내용이 훨씬 작아집니다.

## 0.5.4
- 새 에이전트는 처음부터 빠른 `snapshot`과 픽셀 클릭을 압니다. 큰 `snapshot`은 빠른 모드를 제안합니다. 브리지 오류 시 먼저 스크린샷을 봅니다.

## 0.5.3
- 브리지: `snapshot`이 화면에 보이는 부분만 읽고 단어로 요소를 찾을 수 있어 큰 페이지의 응답이 훨씬 작아집니다.
- 브리지: `click_at`은 스크린샷 픽셀 위치를 클릭합니다(플레이어, 캔버스용).
- 브리지: 파일 업로드를 한 번만 또는 이 사이트의 이 에이전트에 항상 허용할 수 있으며 확장 창에서 취소할 수 있습니다.

## 0.5.2
- 경험 힌트가 더 이상 명령과 검색을 멈추지 않고 기억처럼 전달됩니다.
- 답변 끝에서 에이전트는 정말 빠진 내용만 덧붙입니다.
- 모든 에이전트에 설치된 스킬을 요청에 따라 찾습니다: 개인 선반, 하루 한 번 갱신.

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
- 암호 단어를 완전히 없앴다: 모델은 어차피 메시지에서 그것을 보고, 도움보다 번거로움이 더 컸다. 보호는 "읽은 모든 것은 데이터"라는 규칙, 인젝션 신호, 파괴적인 명령 차단, 에이전트 자체의 권한 확인으로 이루어진다. 옛 단어의 해시는 업데이트 때 지워진다.
- OpenClaw용 플러그인: 모든 요청에 핵심 규칙과 경험 힌트, 파괴적인 명령 차단, 검색 전에 경험 확인. OpenClaw CLI로 설치하며, 게이트웨이 재시작 후 작동한다 (`openclaw gateway restart`).

## 0.3.0
- 핵심 규칙 — `AGENTS.md`의 짧은 "항상" 목록: 공통 항목에 당신의 설정에서 온 항목을 더한 것. 훅이 세션 시작 때와 컨텍스트 압축 후에 보여 준다.
- 서고가 된 경험: 대상별 폴더 (`platform`, `tools`, `code`, `agents`, `craft`, `owner`), 항목 템플릿, 색인은 머리말에서 만든다 (`npx maxagent index`).
- "완료" 전 점검: 코드를 고친 뒤 아무것도 실행하거나 열지 않고는 "완료"라고 말할 수 없다.
- 브라우저 감시 (브리지를 고른 경우): 에이전트 내장 브라우저는 금지; "브리지 연결 안 됨" — 한 단계, `launch_browser`.
- 컴퓨터 환경 카드 (OS, 셸, Python, Node…) — 세션 시작 때 요약.
- 받은 편지함 "나중을 위해 저장" — `inbox/` 폴더; 훅이 안내하고 "잊지 말고 할 것" 항목을 알려 준다.
- `npx maxagent setup` — 설정 바꾸기: 저장소, 브리지, 별도 데스크톱, 답변 형식, 휴지통.

## 0.2.0
- Claude Code, Codex, Antigravity용 훅: 경험 힌트, "경험을 기록했나?" 점검, 파괴적인 명령 차단.
