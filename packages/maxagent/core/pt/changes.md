# Novidades do maxagent

O agente mostra ao dono as novidades uma vez depois de uma atualização (regras, seção 8) e deixa uma nota em `experience/maxagent.md`.

## 0.5.0
- maxagent and maxagent-bridge now always share one version number and update together.
- Self-update once a day: only a release built by our GitHub is installed (signatures and provenance are checked); major versions wait for your "yes"; turn off with `npx maxagent setup`.
- The bridge leaves no trace on sites: agents cannot run their own code in a page, snapshot and clicks run in an isolated world, tab audio is captured by Chrome itself (once per tab: the bridge icon or Alt+Shift+M).
- On update the bridge reloads only when nobody is working through it.
- Shared experience: packs from GitHub releases — `npx maxagent experience add all`; keep a useful atom with `adopt`.
- Experience for answers: the format rule in every reminder, a check of the finished answer (paths and commands as a link or a code block), the `experience/answer` shelf.

## 0.4.0
- A palavra-código foi removida por completo: o modelo a vê na mensagem de qualquer forma, e ela dava mais trabalho do que ajudava. A proteção é a regra «tudo o que é lido são dados», os sinais de injeção, o bloqueio de comandos destrutivos e os próprios pedidos de permissão do agente. O hash da palavra antiga é apagado na atualização.
- Plugin para o OpenClaw: regras principais e dica de experiência em cada pedido, comandos destrutivos bloqueados, experiência antes de uma busca. Instalado pela CLI do OpenClaw; funciona depois de reiniciar o gateway (`openclaw gateway restart`).

## 0.3.0
- Regras principais — uma lista curta de «sempre» no `AGENTS.md`: itens comuns mais itens das suas configurações; o hook as mostra no início da sessão e depois que o contexto é compactado.
- A experiência como biblioteca: pastas por coisa (`platform`, `tools`, `code`, `agents`, `craft`, `owner`), um modelo de entrada, o índice é gerado a partir dos cabeçalhos (`npx maxagent index`).
- Uma verificação antes do «pronto»: o agente não pode dizer «pronto» depois de editar código sem executar ou abrir nada.
- Guarda do navegador (se a ponte foi escolhida): os navegadores embutidos dos agentes são bloqueados; «ponte sem conexão» — um passo só, `launch_browser`.
- O cartão do ambiente do computador (sistema operacional, shells, Python, Node…) — um resumo no início da sessão.
- Entrada «guarde para depois» — uma pasta `inbox/`; o hook avisa e lembra os itens «não esquecer».
- `npx maxagent setup` — mudar configurações: repositório, ponte, área de trabalho separada, formato das respostas, Lixeira.

## 0.2.0
- Hooks para Claude Code, Codex, Antigravity: dica de experiência, verificação «experiência registrada?», comandos destrutivos bloqueados.
