# Novidades do maxagent

Depois de uma atualização, o hook diz uma vez «Atualizado para X» — o agente conta ao dono a seção dessa versão.

## 0.6.0
- No início, o agente lê apenas o `AGENTS.md` da pasta de trabalho: o regulamento `AGENTS.core.md` virou referência, e `sync.md`, o índice de experiência e `projects.md` deixaram de ser lidos no início — a experiência aparece em átomos conforme a tarefa. A atualização substitui uma vez, no seu `AGENTS.md`, a linha “leia o regulamento” por uma referência (cópia — `AGENTS.md.maxagent-backup`); “Minhas regras” não são alteradas.
- As “Regras principais” não têm mais idioma nem formato de resposta: o idioma fica na seção “Configurações”, e o formato da resposta é lembrado pelo hook a cada mensagem.
- Depois da compressão de memória, os átomos de experiência voltam a aparecer na mesma sessão; o briefing de quatro perguntas foi removido.
- A atualização coloca na pasta de trabalho apenas os novos arquivos de modelo desta versão e não restaura os que você apagou. Novo: átomos sobre trabalho com projetos (`experience/agents/projects.md`).

## 0.5.12
- A verificação «experiência não registrada» agora vale para todos os agentes: Antigravity, Codex, OpenClaw e Hermes — o hook mantém seu próprio registro do turno (busca, execuções, correções de código). No Hermes o lembrete vem com a próxima mensagem do dono.

## 0.5.11
- OpenClaw e Hermes no nível dos outros: a experiência chega ao modelo antes e depois dos comandos, o que é escrito é verificado, o navegador integrado fica desligado com a ponte; novos agentes entram na atualização.

## 0.5.10
- Hermes se conecta ao maxagent: regras e experiência vêm por um plugin e a ponte do navegador fica disponível. Instalação existente: `npx maxagent update --agents <seus agentes>,hermes`.

## 0.5.9
- Instalação por um agente: o assistente não trava nem fica calado; pergunta tudo ao dono por meio do agente e termina com um relatório.

## 0.5.8
- Os agentes sabem o que usar: para clicar, digitar ou ler, `snapshot`; para ver como a página está, uma captura.

## 0.5.7
- O `snapshot` normal agora responde em linhas curtas: primeiro o que está na tela, sem fundos vazios nem duplicados. JSON completo: `format="full"`.

## 0.5.6
- Pacotes compartilhados: o download é repetido em falhas do GitHub e um pacote com erro não impede os outros; `doctor` não avisa mais sobre cabeçalhos de pacotes.

## 0.5.5
- O `snapshot` rápido responde em linhas curtas em vez de JSON: a tela ocupa várias vezes menos.

## 0.5.4
- Um agente novo já conhece o `snapshot` rápido e o clique por pixels; um `snapshot` grande sugere o modo rápido; em erro da ponte, olhar primeiro uma captura.

## 0.5.3
- Ponte: `snapshot` pode ler só o que está na tela e buscar elementos por palavras: respostas muito menores em páginas grandes.
- Ponte: `click_at` clica por pixels de uma captura, para players e canvas.
- Ponte: o envio de arquivos pode ser permitido uma vez ou sempre para este agente neste site; revogue na janela da extensão.

## 0.5.2
- As dicas da experiência não param mais comandos nem buscas: chegam como uma lembrança.
- No fim da resposta o agente acrescenta só o que realmente falta.
- As skills instaladas de todos os agentes são encontradas quando pedidas: uma estante pessoal, atualizada uma vez por dia.

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
