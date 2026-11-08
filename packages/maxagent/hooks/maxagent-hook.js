#!/usr/bin/env node
'use strict';
// maxagent hook — one script for every agent and event.
//   node maxagent-hook.js <agent> <event>
//   agent: claude-code | codex | antigravity
//   event: start (SessionStart, incl. after compaction) | prompt (UserPromptSubmit) | invocation (Antigravity PreInvocation)
//          | stop (Stop) | pretool (PreToolUse) | posttool (PostToolUse, maxagent-bridge tools only)
// Installed by `npx maxagent init/update` into ~/.maxagent/hooks/ and reads ~/.maxagent/config.json next to it.
// A hook must never break the agent's work: any internal error → neutral answer.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..'); // ~/.maxagent
const [AGENT, EVENT] = process.argv.slice(2);

const TXT = {
  ru: {
    reminder: 'Брифинг: нужен поиск (сеть/компьютер)? нужно что-то от хозяина? больше 3 шагов? относится к проекту? — хоть одно «да»: сначала опыт по задаче: всплыл выше — делай по нему, не всплыл — node ~/.maxagent/tools/experience-engine.js find "<слова задачи>"; при проекте — projects.md и карточка. Не заново. Скажи одной фразой: «Делаю по опыту: <файл>» / «Сначала сверюсь с опытом» / «Новая задача, опыта нет — если выясню новое, запишу». Записывать — только новое знание (выяснял, что-то не сработало, правило хозяина, повторяемый способ), не из-за числа шагов.',
    projectHead: '[проект] Похоже на работу по проекту — карточка и активная задача:',
    stop: (did) => `[maxagent, опыт] За этот ход: ${did}, а опыт (experience/) не менялся. Опыт — повторяемое действие без поиска и ошибок. Если в этом ходе пришлось искать, что-то не сработало, хозяин дал правило или получился способ, который повторится, — запиши атом в experience/<вид>/<вещь>.md по experience/_spec.md (образец — experience/_template.md; такой атом уже есть — поправь его):\n### <задача словами просьбы>\n- когда: <просьба> · <команда/инструмент> · <текст ошибки>\n- вещь: <предмет> · <предмет>\n1. <шаг, команда>\n- проверка: <что должно получиться>\n- ловушка: не <так> — <почему>\n- источник: свой опыт, <дата>\nПроверь: node ~/.maxagent/tools/experience-engine.js lint <файл> → «ошибок нет»; find "<слова просьбы>" → атом наверху. Затем коммит. Записывать нечего — одной строкой скажи почему и заканчивай. Второй раз этот хук не остановит.`,
    lintBad: (file, list) => `[maxagent, опыт] ${file} не по формату атома (experience/_spec.md) — исправь сейчас, иначе он плохо найдётся и коммит не пройдёт:\n${list}`,
    actionAtom: (a) => `[опыт перед действием — так у нас уже делалось; сверь и сделай по нему, затем повтори вызов: второй раз этот атом не остановит]\n(${a.file})\n${a.text}`,
    recallHeads: { sure: '[опыт — похоже, я так уже делал; сверь, подходит ли]', maybe: '[опыт — возможно, похожее; сверь, подходит ли]', also: 'Ещё похоже:', only: '[опыт — похожие случаи]' },
    answerRule: 'Ответ хозяину: что глянуть (файл, картинка, страница) — кликабельной ссылкой; что скопировать (путь, команда, готовый текст) — отдельным блоком кода. Не проверено — так и написать.',
    formatAsk: (list) => `[maxagent, ответ] Простым текстом остались: ${list.map((x) => `«${x}»`).join(', ')}. Ответ уже у хозяина — не повторяй его. Допиши только недостающее: что глянуть — список кликабельных ссылок [имя](путь) с пояснением в несколько слов; что скопировать — отдельным блоком кода.`,
    answerAtoms: (atoms) => `[опыт ответа] Так у нас отдают это хозяину:\n${atoms}\nОтвет уже у хозяина — не повторяй его. Чего-то не хватает — допиши только это, коротко; всё на месте — просто заверши ход.`,
    updateAvail: (cur, v) => `[maxagent] Вышла версия ${v} (у вас ${cur || '?'}). Предложи хозяину обновить и после его «да» выполни: npx --yes maxagent@latest update — что нового, покажет сама команда.`,
    autoUpdated: (v) => `[maxagent] Обновлено до ${v} (исправления ставятся сами, настройка autoUpdate).`,
    news: (text) => `[maxagent, новость] ${text}`,
    adoptAsk: (head, id) => `[опыт] В этом ходе показывался чужой атом «${head}» (общий набор). Если он пригодился и сработал — сохрани его своим: node ~/.maxagent/tools/experience-packs.js adopt "${id}", при нужде поправь пути и проверь lint. Не пригодился — ничего не делай и заканчивай. Второй раз этот хук не остановит.`,
    did: { research: 'поиск/чтение в сети', shell: 'команды', edits: 'правки кода после проверки' },
    catastrophic: 'Команда может уничтожить систему или все данные (корень диска, домашняя папка, форматирование). Запрещено всегда — если это действительно нужно, хозяин выполнит сам.',
    search: (rows) => `[опыт перед поиском] По словам запроса в опыте есть записи:\n${rows}\nСначала прочитай подходящие и делай по ним. Если в опыте ответа нет — повтори этот же поиск (второй раз в этом ходе хук пропустит), а найденное потом запиши в опыт.`,
    ask: (quote, rows) => `[опыт перед просьбой] Ты просишь хозяина сделать руками: «${quote}». В опыте есть записи об этом:\n${rows}\nПрочитай их: если там способ сделать это самому — сделай сам и не проси. Если без хозяина никак (его вход, пароль, решение, физическое действие) — оставь просьбу и заканчивай. Второй раз этот хук не остановит.`,
    done: (word, file) => `[maxagent, проверка] Ты пишешь «${word}», но после последней правки (${file}) ничего не запускал и результат не открывал. Проверь вживую (запусти, открой, посмотри) или прямо напиши хозяину, что не проверено. Второй раз этот хук не остановит.`,
    browserBuiltIn: (tool) => `[maxagent, браузер] Встроенный браузер агента (${tool}) запрещён настройкой хозяина: браузер — только его собственный Chrome через maxagent-bridge (инструменты mcp__maxagent-bridge__*: browser_status, tabs_list, snapshot, click, type…). Если их нет в списке — найди их поиском инструментов по слову maxagent-bridge.`,
    browserProc: '[maxagent, браузер] Команда сама ищет, запускает или закрывает процессы Chrome. Так агенты принимают чужой Chrome (Playwright, headless, другой профиль) за браузер хозяина и уходят в обходы. Мост не на связи / браузер закрыт / завис — один шаг: инструмент launch_browser моста (он открывает профиль хозяина с расширением). Если команда не про браузер хозяина (свой headless, временный профиль) — добавь в неё комментарий not-owner-browser.',
    bridgeDown: '[maxagent, браузер] Мост не на связи. Один шаг, без обходов: инструмент launch_browser моста — он запускает именно браузер хозяина (профиль с расширением) и ждёт связи. Не искать chrome.exe в списке процессов (там бывают чужие: Playwright, headless, другие профили — их не трогать), не переходить на другие браузеры и способы. Не помогло — `npx maxagent-bridge doctor` и коротко сказать хозяину, что именно не так.',
    inboxSave: (where) => `[входящие] Хозяин просит сохранить — положи как есть, без разбора и без вопросов «куда»: в ${where}inbox/ одним файлом ГГГГ-ММ-ДД-<коротко-латиницей>.md (дословно + «Откуда:» + «Зачем:», если сказано, + строка «Вид:»). Правила — inbox/README.md. Ответ — одна строка со ссылкой на файл.`,
    inboxLine: (n, items) => `[входящие] Несортированного: ${n} (разбор — только по команде хозяина).${items ? ` Не забыть сделать: ${items}.` : ''}`,
    envHead: '[окружение]',
    startHead: '[maxagent] Главные правила — держи перед глазами всю сессию:',
    compactHead: '[maxagent] Память сжата — правила, прочитанные в начале, могли выпасть. Главное — ниже, держи перед глазами:',
    ownHead: 'Правила хозяина («Мои правила» в AGENTS.md):',
    startTail: (ws) => `Полный регламент и правила рабочей папки: ${ws}`,
  },
  en: {
    reminder: 'Briefing: needs a search (web/computer)? needs something from the owner? more than 3 steps? belongs to a project? — any "yes": experience for this task first: shown above — do it that way; not shown — node ~/.maxagent/tools/experience-engine.js find "<task words>"; for a project also projects.md and its card. Not from scratch. Say it in one phrase: "Following experience: <file>" / "Checking experience first" / "New task, no experience yet — will record anything new". Record only new knowledge (had to find out, something failed, owner\'s rule, a repeatable way), not because of the number of steps.',
    projectHead: '[project] Looks like project work — card and active task:',
    stop: (did) => `[maxagent, experience] This turn: ${did}, but experience (experience/) did not change. Experience is a repeatable action without search and mistakes. If this turn needed a search, something failed, the owner gave a rule or you found a way that will repeat — write an atom to experience/<kind>/<thing>.md per experience/_spec.md (sample — experience/_template.md; if such an atom exists, fix it):\n### <task in the words of the request>\n- когда: <request> · <command/tool> · <error text>\n- вещь: <thing> · <thing>\n1. <step, command>\n- проверка: <expected result>\n- ловушка: not <this> — <why>\n- источник: own experience, <date>\nCheck: node ~/.maxagent/tools/experience-engine.js lint <file> → no errors; find "<request words>" → the atom on top. Then commit. Nothing to record — say why in one line and finish. This hook won't stop you a second time.`,
    lintBad: (file, list) => `[maxagent, experience] ${file} does not follow the atom format (experience/_spec.md) — fix it now, or it will be found badly and the commit will fail:\n${list}`,
    actionAtom: (a) => `[experience before the action — this was done before; check it and do it this way, then repeat the call: this atom won't stop you again]\n(${a.file})\n${a.text}`,
    recallHeads: { sure: '[experience — looks like I did this before; check it fits]', maybe: '[experience — maybe similar; check it fits]', also: 'Also similar:', only: '[experience — similar cases]',
      shared: (p, v) => `[someone else's experience — not verified here; pack "${p}"${v ? `, v${v}` : ''}]`, adopt: (id) => `If it helps — keep it as your own: node ~/.maxagent/tools/experience-packs.js adopt "${id}"` },
    answerRule: 'Answer to the owner: what to look at (file, image, page) — a clickable link; what to copy (path, command, ready text) — a separate code block. Not verified — say so.',
    formatAsk: (list) => `[maxagent, answer] Left as plain text: ${list.map((x) => `"${x}"`).join(', ')}. The owner already has the answer — do not repeat it. Add only what is missing: what to look at — a list of clickable links [name](path), a few words each; what to copy — a separate code block.`,
    answerAtoms: (atoms) => `[answer experience] This is how we hand this to the owner:\n${atoms}\nThe owner already has the answer — do not repeat it. Something missing — add only that, briefly; all in place — just finish.`,
    updateAvail: (cur, v) => `[maxagent] Version ${v} is out (you have ${cur || '?'}). Offer the owner to update and after their "yes" run: npx --yes maxagent@latest update — the command shows what's new.`,
    autoUpdated: (v) => `[maxagent] Updated to ${v} (fixes install themselves, setting autoUpdate).`,
    news: (text) => `[maxagent, news] ${text}`,
    adoptAsk: (head, id) => `[experience] A shared (someone else's) atom "${head}" was shown this turn. If it helped and worked — keep it as your own: node ~/.maxagent/tools/experience-packs.js adopt "${id}", fix paths if needed and check lint. If not — do nothing and finish. This hook won't stop you a second time.`,
    did: { research: 'web search/reading', shell: 'commands', edits: 'code fixes after a check' },
    catastrophic: 'The command could destroy the system or all data (drive root, home folder, formatting). Always forbidden — if really needed, the owner runs it.',
    search: (rows) => `[experience before search] Experience has entries matching this query:\n${rows}\nRead the relevant ones first and follow them. If the answer is not there, repeat the same search (the hook lets it through the second time this turn) and record what you find.`,
    ask: (quote, rows) => `[experience before asking] You are asking the owner to do something by hand: "${quote}". Experience has entries about it:\n${rows}\nRead them: if they show a way to do it yourself, do it and don't ask. If it really needs the owner (their sign-in, password, decision, physical action), keep the request and finish. This hook won't stop you a second time.`,
    done: (word, file) => `[maxagent, check] You say "${word}", but after the last edit (${file}) you ran nothing and opened no result. Check it for real (run, open, look) or tell the owner plainly that it is not verified. This hook won't stop you a second time.`,
    browserBuiltIn: (tool) => `[maxagent, browser] The agent's built-in browser (${tool}) is turned off by the owner's settings: the browser is only their own Chrome through maxagent-bridge (tools mcp__maxagent-bridge__*: browser_status, tabs_list, snapshot, click, type…). If they are not in your list, find them with a tool search for maxagent-bridge.`,
    browserProc: '[maxagent, browser] This command itself looks for, starts or kills Chrome processes. That is how agents take someone else\'s Chrome (Playwright, headless, another profile) for the owner\'s browser and wander into workarounds. Bridge not connected / browser closed / hung — one step: the bridge tool launch_browser (it opens the owner\'s profile with the extension). If the command is not about the owner\'s browser (your own headless, a temp profile), add the comment not-owner-browser to it.',
    bridgeDown: '[maxagent, browser] The bridge is not connected. One step, no workarounds: the bridge tool launch_browser — it starts exactly the owner\'s browser (the profile with the extension) and waits for the connection. Don\'t look for chrome.exe in the process list (other ones live there: Playwright, headless, other profiles — leave them alone), don\'t switch to other browsers or methods. If it doesn\'t help — `npx maxagent-bridge doctor` and tell the owner briefly what exactly is wrong.',
    inboxSave: (where) => `[inbox] The owner asks to save something — store it as is, without sorting and without asking "where": in ${where}inbox/ as one file YYYY-MM-DD-<short-latin>.md (verbatim + "From:" + "Why:" if said, + a "Kind:" line). Rules — inbox/README.md. Answer with one line linking the file.`,
    inboxLine: (n, items) => `[inbox] Unsorted: ${n} (sorted only when the owner says so).${items ? ` Don't forget: ${items}.` : ''}`,
    envHead: '[environment]',
    startHead: '[maxagent] Core rules — keep them in view for the whole session:',
    compactHead: '[maxagent] The context was compacted — rules read at the start may be gone. The essentials, keep them in view:',
    ownHead: 'Owner\'s rules ("My rules" in AGENTS.md):',
    startTail: (ws) => `Full rules and workspace rules: ${ws}`,
  },
  es: {
    reminder: 'Briefing: ¿hace falta buscar (web/ordenador)? ¿hace falta algo del dueño? ¿más de 3 pasos? ¿es de un proyecto? — con un solo «sí»: primero la experiencia de esta tarea: si apareció arriba, hazlo así; si no, node ~/.maxagent/tools/experience-engine.js find "<palabras de la tarea>"; si es de un proyecto, también projects.md y su ficha. No desde cero. Dilo en una frase: «Sigo la experiencia: <archivo>» / «Primero reviso la experiencia» / «Tarea nueva, sin experiencia — si descubro algo nuevo, lo anoto». Anota solo conocimiento nuevo (tuviste que averiguarlo, algo falló, una regla del dueño, una forma repetible), no por el número de pasos.',
    projectHead: '[proyecto] Parece trabajo de un proyecto — ficha y tarea activa:',
    stop: (did) => `[maxagent, experiencia] En este turno: ${did}, pero la experiencia (experience/) no cambió. Experiencia es una acción repetible sin búsquedas ni errores. Si en este turno hubo que buscar, algo falló, el dueño dio una regla o salió una forma que se repetirá — escribe un átomo en experience/<tipo>/<cosa>.md según experience/_spec.md (muestra — experience/_template.md; si ese átomo ya existe, corrígelo):\n### <tarea con las palabras de la petición>\n- когда: <petición> · <comando/herramienta> · <texto del error>\n- вещь: <objeto> · <objeto>\n1. <paso, comando>\n- проверка: <qué debe salir>\n- ловушка: no <así> — <por qué>\n- источник: experiencia propia, <fecha>\nComprueba: node ~/.maxagent/tools/experience-engine.js lint <archivo> → sin errores; find "<palabras de la petición>" → el átomo arriba. Luego commit. Si no hay nada que anotar, di por qué en una línea y termina. Este hook no te detendrá una segunda vez.`,
    lintBad: (file, list) => `[maxagent, experiencia] ${file} no sigue el formato de átomo (experience/_spec.md) — corrígelo ahora, o se encontrará mal y el commit no pasará:\n${list}`,
    actionAtom: (a) => `[experiencia antes de la acción — esto ya se hizo antes; revísalo y hazlo así, luego repite la llamada: este átomo no te volverá a detener]\n(${a.file})\n${a.text}`,
    recallHeads: { sure: '[experiencia — parece que ya hice esto; comprueba si encaja]', maybe: '[experiencia — quizá algo parecido; comprueba si encaja]', also: 'También parecido:', only: '[experiencia — casos parecidos]',
      shared: (p, v) => `[experiencia ajena — no verificada aquí; paquete «${p}»${v ? `, v${v}` : ''}]`, adopt: (id) => `Si sirve, guárdala como tuya: node ~/.maxagent/tools/experience-packs.js adopt "${id}"` },
    updateAvail: (cur, v) => `[maxagent] Salió la versión ${v} (tienes ${cur || '?'}). Ofrece al dueño actualizar y, tras su «sí», ejecuta: npx --yes maxagent@latest update — el propio comando muestra las novedades.`,
    autoUpdated: (v) => `[maxagent] Actualizado a ${v} (las correcciones se instalan solas, ajuste autoUpdate).`,
    news: (text) => `[maxagent, noticia] ${text}`,
    adoptAsk: (head, id) => `[experiencia] En este turno se mostró un átomo ajeno «${head}» (paquete compartido). Si sirvió y funcionó, guárdalo como tuyo: node ~/.maxagent/tools/experience-packs.js adopt "${id}", corrige rutas si hace falta y comprueba lint. Si no sirvió, no hagas nada y termina. Este hook no te detendrá una segunda vez.`,
    did: { research: 'búsqueda/lectura en la web', shell: 'comandos', edits: 'correcciones de código tras una comprobación' },
    catastrophic: 'El comando podría destruir el sistema o todos los datos (raíz del disco, carpeta personal, formateo). Prohibido siempre — si de verdad hace falta, lo ejecuta el dueño.',
    search: (rows) => `[experiencia antes de buscar] La experiencia tiene entradas que coinciden con esta búsqueda:\n${rows}\nLee primero las que encajen y sigue lo que dicen. Si la respuesta no está, repite la misma búsqueda (el hook la deja pasar la segunda vez en este turno) y anota luego lo que encuentres.`,
    ask: (quote, rows) => `[experiencia antes de pedir] Le pides al dueño que haga algo a mano: «${quote}». La experiencia tiene entradas sobre ello:\n${rows}\nLéelas: si muestran una forma de hacerlo tú mismo, hazlo y no pidas. Si de verdad hace falta el dueño (su inicio de sesión, contraseña, decisión, acción física), mantén la petición y termina. Este hook no te detendrá una segunda vez.`,
    done: (word, file) => `[maxagent, comprobación] Escribes «${word}», pero tras la última edición (${file}) no ejecutaste nada ni abriste ningún resultado. Compruébalo de verdad (ejecuta, abre, mira) o dile claramente al dueño que no está verificado. Este hook no te detendrá una segunda vez.`,
    browserBuiltIn: (tool) => `[maxagent, navegador] El navegador integrado del agente (${tool}) está desactivado en los ajustes del dueño: el navegador es solo su propio Chrome a través de maxagent-bridge (herramientas mcp__maxagent-bridge__*: browser_status, tabs_list, snapshot, click, type…). Si no están en tu lista, búscalas con la búsqueda de herramientas por maxagent-bridge.`,
    browserProc: '[maxagent, navegador] Este comando busca, inicia o cierra por sí mismo procesos de Chrome. Así los agentes toman un Chrome ajeno (Playwright, headless, otro perfil) por el navegador del dueño y se pierden en rodeos. Puente sin conexión / navegador cerrado / colgado — un solo paso: la herramienta launch_browser del puente (abre el perfil del dueño con la extensión). Si el comando no trata del navegador del dueño (tu propio headless, un perfil temporal), añádele el comentario not-owner-browser.',
    bridgeDown: '[maxagent, navegador] El puente no está conectado. Un solo paso, sin rodeos: la herramienta launch_browser del puente — inicia justo el navegador del dueño (el perfil con la extensión) y espera la conexión. No busques chrome.exe en la lista de procesos (allí hay otros: Playwright, headless, otros perfiles — no los toques), no cambies a otros navegadores ni métodos. Si no ayuda — `npx maxagent-bridge doctor` y dile brevemente al dueño qué falla exactamente.',
    inboxSave: (where) => `[entrada] El dueño pide guardar algo — guárdalo tal cual, sin clasificar y sin preguntar «dónde»: en ${where}inbox/ como un archivo AAAA-MM-DD-<breve-en-latín>.md (literal + «De dónde:» + «Para qué:» si lo dijo, + una línea «Tipo:»). Reglas — inbox/README.md. Responde con una línea con el enlace al archivo.`,
    inboxLine: (n, items) => `[entrada] Sin clasificar: ${n} (se clasifica solo cuando el dueño lo pide).${items ? ` No olvidar: ${items}.` : ''}`,
    envHead: '[entorno]',
    startHead: '[maxagent] Reglas principales — tenlas presentes toda la sesión:',
    compactHead: '[maxagent] El contexto se compactó — las reglas leídas al inicio pueden haberse perdido. Lo esencial, tenlo presente:',
    ownHead: 'Reglas del dueño («Mis reglas» en AGENTS.md):',
    startTail: (ws) => `Reglas completas y reglas de la carpeta de trabajo: ${ws}`,
  },
  pt: {
    reminder: 'Briefing: precisa de busca (web/computador)? precisa de algo do dono? mais de 3 passos? é de um projeto? — qualquer «sim»: primeiro a experiência desta tarefa: apareceu acima — faça assim; não apareceu — node ~/.maxagent/tools/experience-engine.js find "<palavras da tarefa>"; se for projeto, também projects.md e o cartão dele. Não do zero. Diga numa frase: «Sigo a experiência: <arquivo>» / «Primeiro confiro a experiência» / «Tarefa nova, sem experiência — se descobrir algo novo, registro». Registre só conhecimento novo (teve que descobrir, algo falhou, regra do dono, um jeito repetível), não pelo número de passos.',
    projectHead: '[projeto] Parece trabalho de projeto — cartão e tarefa ativa:',
    stop: (did) => `[maxagent, experiência] Neste turno: ${did}, mas a experiência (experience/) não mudou. Experiência é uma ação repetível sem busca e sem erros. Se neste turno foi preciso buscar, algo falhou, o dono deu uma regra ou saiu um jeito que vai se repetir — escreva um átomo em experience/<tipo>/<coisa>.md conforme experience/_spec.md (modelo — experience/_template.md; se esse átomo já existe, corrija-o):\n### <tarefa nas palavras do pedido>\n- когда: <pedido> · <comando/ferramenta> · <texto do erro>\n- вещь: <objeto> · <objeto>\n1. <passo, comando>\n- проверка: <o que deve sair>\n- ловушка: não <assim> — <por quê>\n- источник: experiência própria, <data>\nConfira: node ~/.maxagent/tools/experience-engine.js lint <arquivo> → sem erros; find "<palavras do pedido>" → o átomo no topo. Depois commit. Nada a registrar — diga por quê numa linha e termine. Este hook não vai te parar uma segunda vez.`,
    lintBad: (file, list) => `[maxagent, experiência] ${file} não segue o formato de átomo (experience/_spec.md) — corrija agora, senão ele será mal encontrado e o commit não vai passar:\n${list}`,
    actionAtom: (a) => `[experiência antes da ação — isso já foi feito antes; confira e faça assim, depois repita a chamada: este átomo não vai te parar de novo]\n(${a.file})\n${a.text}`,
    recallHeads: { sure: '[experiência — parece que já fiz isso; confira se serve]', maybe: '[experiência — talvez algo parecido; confira se serve]', also: 'Também parecido:', only: '[experiência — casos parecidos]',
      shared: (p, v) => `[experiência de outra pessoa — não verificada aqui; pacote «${p}»${v ? `, v${v}` : ''}]`, adopt: (id) => `Se ajudar, guarde como sua: node ~/.maxagent/tools/experience-packs.js adopt "${id}"` },
    updateAvail: (cur, v) => `[maxagent] Saiu a versão ${v} (você tem ${cur || '?'}). Ofereça ao dono atualizar e, depois do «sim» dele, execute: npx --yes maxagent@latest update — o próprio comando mostra as novidades.`,
    autoUpdated: (v) => `[maxagent] Atualizado para ${v} (as correções se instalam sozinhas, configuração autoUpdate).`,
    news: (text) => `[maxagent, novidade] ${text}`,
    adoptAsk: (head, id) => `[experiência] Neste turno apareceu um átomo de outra pessoa «${head}» (pacote compartilhado). Se ajudou e funcionou, guarde como seu: node ~/.maxagent/tools/experience-packs.js adopt "${id}", corrija caminhos se preciso e confira o lint. Se não ajudou, não faça nada e termine. Este hook não vai te parar uma segunda vez.`,
    did: { research: 'busca/leitura na web', shell: 'comandos', edits: 'correções de código depois de uma verificação' },
    catastrophic: 'O comando pode destruir o sistema ou todos os dados (raiz do disco, pasta pessoal, formatação). Sempre proibido — se for mesmo necessário, o dono executa.',
    search: (rows) => `[experiência antes da busca] A experiência tem registros que batem com esta busca:\n${rows}\nLeia primeiro os que servem e siga-os. Se a resposta não estiver lá, repita a mesma busca (o hook a deixa passar na segunda vez neste turno) e depois registre o que encontrar.`,
    ask: (quote, rows) => `[experiência antes de pedir] Você está pedindo ao dono que faça algo à mão: «${quote}». A experiência tem registros sobre isso:\n${rows}\nLeia: se mostram um jeito de fazer você mesmo, faça e não peça. Se realmente precisa do dono (login dele, senha, decisão, ação física), mantenha o pedido e termine. Este hook não vai te parar uma segunda vez.`,
    done: (word, file) => `[maxagent, verificação] Você escreve «${word}», mas depois da última edição (${file}) não executou nada nem abriu nenhum resultado. Verifique de verdade (execute, abra, olhe) ou diga claramente ao dono que não foi verificado. Este hook não vai te parar uma segunda vez.`,
    browserBuiltIn: (tool) => `[maxagent, navegador] O navegador embutido do agente (${tool}) está desligado nas configurações do dono: o navegador é só o Chrome dele, via maxagent-bridge (ferramentas mcp__maxagent-bridge__*: browser_status, tabs_list, snapshot, click, type…). Se elas não estão na sua lista, encontre-as pela busca de ferramentas com maxagent-bridge.`,
    browserProc: '[maxagent, navegador] Este comando procura, inicia ou fecha por conta própria processos do Chrome. É assim que agentes confundem um Chrome alheio (Playwright, headless, outro perfil) com o navegador do dono e se perdem em gambiarras. Ponte sem conexão / navegador fechado / travado — um passo só: a ferramenta launch_browser da ponte (ela abre o perfil do dono com a extensão). Se o comando não é sobre o navegador do dono (seu próprio headless, um perfil temporário), adicione nele o comentário not-owner-browser.',
    bridgeDown: '[maxagent, navegador] A ponte não está conectada. Um passo só, sem gambiarras: a ferramenta launch_browser da ponte — ela inicia exatamente o navegador do dono (o perfil com a extensão) e espera a conexão. Não procure chrome.exe na lista de processos (lá há outros: Playwright, headless, outros perfis — não mexa neles), não troque para outros navegadores ou métodos. Não resolveu — `npx maxagent-bridge doctor` e diga ao dono, em poucas palavras, o que exatamente está errado.',
    inboxSave: (where) => `[entrada] O dono pede para guardar algo — guarde como está, sem organizar e sem perguntar «onde»: em ${where}inbox/ como um arquivo AAAA-MM-DD-<curto-em-latim>.md (literal + «De onde:» + «Para quê:» se ele disse, + uma linha «Tipo:»). Regras — inbox/README.md. Responda com uma linha com o link do arquivo.`,
    inboxLine: (n, items) => `[entrada] Não organizados: ${n} (organiza-se só quando o dono pedir).${items ? ` Não esquecer: ${items}.` : ''}`,
    envHead: '[ambiente]',
    startHead: '[maxagent] Regras principais — mantenha-as à vista durante toda a sessão:',
    compactHead: '[maxagent] O contexto foi compactado — as regras lidas no início podem ter sumido. O essencial, mantenha à vista:',
    ownHead: 'Regras do dono («Minhas regras» no AGENTS.md):',
    startTail: (ws) => `Regras completas e regras da pasta de trabalho: ${ws}`,
  },
  de: {
    reminder: 'Briefing: Ist eine Suche nötig (Web/Rechner)? Braucht es etwas vom Besitzer? Mehr als 3 Schritte? Gehört es zu einem Projekt? — bei einem einzigen „ja“: zuerst die Erfahrung zu dieser Aufgabe: oben angezeigt — so machen; nicht angezeigt — node ~/.maxagent/tools/experience-engine.js find "<Wörter der Aufgabe>"; bei einem Projekt auch projects.md und seine Karte. Nicht von vorn. Sag es in einem Satz: „Ich folge der Erfahrung: <Datei>“ / „Ich prüfe zuerst die Erfahrung“ / „Neue Aufgabe, keine Erfahrung — finde ich Neues, halte ich es fest“. Festhalten nur neues Wissen (musste es herausfinden, etwas ging schief, Regel des Besitzers, ein wiederholbarer Weg), nicht wegen der Zahl der Schritte.',
    projectHead: '[Projekt] Sieht nach Projektarbeit aus — Karte und aktive Aufgabe:',
    stop: (did) => `[maxagent, Erfahrung] In diesem Zug: ${did}, aber die Erfahrung (experience/) hat sich nicht geändert. Erfahrung ist eine wiederholbare Handlung ohne Suche und ohne Fehler. Wenn in diesem Zug gesucht werden musste, etwas schiefging, der Besitzer eine Regel gab oder ein Weg entstand, der sich wiederholen wird — schreib ein Atom nach experience/<Art>/<Sache>.md gemäß experience/_spec.md (Muster — experience/_template.md; gibt es das Atom schon, korrigiere es):\n### <Aufgabe in den Worten der Bitte>\n- когда: <Bitte> · <Befehl/Werkzeug> · <Fehlertext>\n- вещь: <Gegenstand> · <Gegenstand>\n1. <Schritt, Befehl>\n- проверка: <was herauskommen soll>\n- ловушка: nicht <so> — <warum>\n- источник: eigene Erfahrung, <Datum>\nPrüfe: node ~/.maxagent/tools/experience-engine.js lint <Datei> → keine Fehler; find "<Wörter der Bitte>" → das Atom oben. Dann commit. Nichts festzuhalten — sag in einer Zeile, warum, und hör auf. Ein zweites Mal hält dich dieser Hook nicht an.`,
    lintBad: (file, list) => `[maxagent, Erfahrung] ${file} entspricht nicht dem Atom-Format (experience/_spec.md) — korrigiere es jetzt, sonst wird es schlecht gefunden und der Commit scheitert:\n${list}`,
    actionAtom: (a) => `[Erfahrung vor der Aktion — das wurde schon einmal gemacht; prüfe es und mach es so, dann wiederhole den Aufruf: dieses Atom hält dich nicht noch einmal an]\n(${a.file})\n${a.text}`,
    recallHeads: { sure: '[Erfahrung — sieht aus, als hätte ich das schon gemacht; prüfe, ob es passt]', maybe: '[Erfahrung — vielleicht Ähnliches; prüfe, ob es passt]', also: 'Auch ähnlich:', only: '[Erfahrung — ähnliche Fälle]',
      shared: (p, v) => `[fremde Erfahrung — hier nicht geprüft; Paket „${p}“${v ? `, v${v}` : ''}]`, adopt: (id) => `Wenn es hilft — als eigene übernehmen: node ~/.maxagent/tools/experience-packs.js adopt "${id}"` },
    updateAvail: (cur, v) => `[maxagent] Version ${v} ist erschienen (Sie haben ${cur || '?'}). Biete dem Besitzer das Update an und führe nach seinem „ja“ aus: npx --yes maxagent@latest update — was neu ist, zeigt der Befehl selbst.`,
    autoUpdated: (v) => `[maxagent] Auf ${v} aktualisiert (Korrekturen installieren sich selbst, Einstellung autoUpdate).`,
    news: (text) => `[maxagent, Neuigkeit] ${text}`,
    adoptAsk: (head, id) => `[Erfahrung] In diesem Zug wurde ein fremdes Atom „${head}“ (geteiltes Paket) angezeigt. Wenn es geholfen und funktioniert hat — übernimm es als eigenes: node ~/.maxagent/tools/experience-packs.js adopt "${id}", passe bei Bedarf Pfade an und prüfe lint. Wenn nicht — tu nichts und hör auf. Ein zweites Mal hält dich dieser Hook nicht an.`,
    did: { research: 'Websuche/Lesen im Web', shell: 'Befehle', edits: 'Code-Korrekturen nach einer Prüfung' },
    catastrophic: 'Der Befehl könnte das System oder alle Daten zerstören (Laufwerkswurzel, Benutzerordner, Formatieren). Immer verboten — wenn es wirklich nötig ist, führt der Besitzer ihn selbst aus.',
    search: (rows) => `[Erfahrung vor der Suche] Die Erfahrung hat Einträge passend zu dieser Suche:\n${rows}\nLies zuerst die passenden und folge ihnen. Steht die Antwort nicht darin, wiederhole dieselbe Suche (der Hook lässt sie beim zweiten Mal in diesem Zug durch) und halte danach fest, was du findest.`,
    ask: (quote, rows) => `[Erfahrung vor der Bitte] Du bittest den Besitzer, etwas von Hand zu tun: „${quote}“. Die Erfahrung hat Einträge dazu:\n${rows}\nLies sie: zeigen sie einen Weg, es selbst zu tun — tu es und bitte nicht. Braucht es wirklich den Besitzer (seine Anmeldung, sein Passwort, seine Entscheidung, eine körperliche Handlung) — lass die Bitte stehen und hör auf. Ein zweites Mal hält dich dieser Hook nicht an.`,
    done: (word, file) => `[maxagent, Prüfung] Du schreibst „${word}“, aber nach der letzten Änderung (${file}) hast du nichts ausgeführt und kein Ergebnis geöffnet. Prüfe es wirklich (ausführen, öffnen, ansehen) oder sag dem Besitzer klar, dass es nicht geprüft ist. Ein zweites Mal hält dich dieser Hook nicht an.`,
    browserBuiltIn: (tool) => `[maxagent, Browser] Der eingebaute Browser des Agenten (${tool}) ist in den Einstellungen des Besitzers abgeschaltet: Browser ist nur sein eigenes Chrome über maxagent-bridge (Werkzeuge mcp__maxagent-bridge__*: browser_status, tabs_list, snapshot, click, type…). Stehen sie nicht in deiner Liste — finde sie über die Werkzeugsuche nach maxagent-bridge.`,
    browserProc: '[maxagent, Browser] Dieser Befehl sucht, startet oder beendet selbst Chrome-Prozesse. So halten Agenten ein fremdes Chrome (Playwright, headless, anderes Profil) für den Browser des Besitzers und verlieren sich in Umwegen. Brücke nicht verbunden / Browser geschlossen / hängt — ein Schritt: das Brückenwerkzeug launch_browser (es öffnet das Profil des Besitzers mit der Erweiterung). Geht es im Befehl nicht um den Browser des Besitzers (dein eigenes headless, ein temporäres Profil) — füge ihm den Kommentar not-owner-browser hinzu.',
    bridgeDown: '[maxagent, Browser] Die Brücke ist nicht verbunden. Ein Schritt, keine Umwege: das Brückenwerkzeug launch_browser — es startet genau den Browser des Besitzers (das Profil mit der Erweiterung) und wartet auf die Verbindung. Such nicht nach chrome.exe in der Prozessliste (dort laufen auch fremde: Playwright, headless, andere Profile — nicht anfassen), wechsle nicht zu anderen Browsern oder Methoden. Hilft es nicht — `npx maxagent-bridge doctor` und sag dem Besitzer kurz, was genau nicht stimmt.',
    inboxSave: (where) => `[Eingang] Der Besitzer bittet, etwas zu speichern — leg es so ab, wie es ist, ohne Sortieren und ohne zu fragen „wohin“: in ${where}inbox/ als eine Datei JJJJ-MM-TT-<kurz-in-lateinischer-Schrift>.md (wörtlich + „Woher:“ + „Wozu:“, falls gesagt, + eine Zeile „Art:“). Regeln — inbox/README.md. Antworte mit einer Zeile mit Link zur Datei.`,
    inboxLine: (n, items) => `[Eingang] Unsortiert: ${n} (sortiert wird nur auf Anweisung des Besitzers).${items ? ` Nicht vergessen: ${items}.` : ''}`,
    envHead: '[Umgebung]',
    startHead: '[maxagent] Hauptregeln — die ganze Sitzung über im Blick behalten:',
    compactHead: '[maxagent] Der Kontext wurde komprimiert — am Anfang gelesene Regeln können weg sein. Das Wichtigste, im Blick behalten:',
    ownHead: 'Regeln des Besitzers („Meine Regeln“ in AGENTS.md):',
    startTail: (ws) => `Vollständige Regeln und Regeln des Arbeitsordners: ${ws}`,
  },
  fr: {
    reminder: 'Briefing : faut-il chercher (web/ordinateur) ? faut-il quelque chose du propriétaire ? plus de 3 étapes ? lié à un projet ? — au moindre « oui » : d’abord l’expérience pour cette tâche : affichée plus haut — fais comme elle dit ; pas affichée — node ~/.maxagent/tools/experience-engine.js find "<mots de la tâche>" ; pour un projet, aussi projects.md et sa fiche. Pas de zéro. Dis-le en une phrase : « Je suis l’expérience : <fichier> » / « Je vérifie d’abord l’expérience » / « Nouvelle tâche, pas d’expérience — si j’apprends du nouveau, je le note ». Noter seulement un savoir nouveau (il a fallu chercher, quelque chose a échoué, règle du propriétaire, une façon répétable), pas à cause du nombre d’étapes.',
    projectHead: '[projet] Ça ressemble à un travail de projet — fiche et tâche active :',
    stop: (did) => `[maxagent, expérience] Pendant ce tour : ${did}, mais l’expérience (experience/) n’a pas changé. L’expérience, c’est une action répétable sans recherche ni erreurs. Si ce tour a demandé une recherche, si quelque chose a échoué, si le propriétaire a donné une règle ou si une façon de faire va se répéter — écris un atome dans experience/<type>/<chose>.md selon experience/_spec.md (modèle — experience/_template.md ; si cet atome existe déjà, corrige-le) :\n### <tâche avec les mots de la demande>\n- когда: <demande> · <commande/outil> · <texte de l’erreur>\n- вещь: <objet> · <objet>\n1. <étape, commande>\n- проверка: <ce qui doit sortir>\n- ловушка: pas <ainsi> — <pourquoi>\n- источник: expérience propre, <date>\nVérifie : node ~/.maxagent/tools/experience-engine.js lint <fichier> → pas d’erreurs ; find "<mots de la demande>" → l’atome en tête. Puis commit. Rien à noter — dis pourquoi en une ligne et termine. Ce hook ne t’arrêtera pas une seconde fois.`,
    lintBad: (file, list) => `[maxagent, expérience] ${file} ne suit pas le format d’atome (experience/_spec.md) — corrige-le maintenant, sinon il sera mal retrouvé et le commit ne passera pas :\n${list}`,
    actionAtom: (a) => `[expérience avant l’action — cela a déjà été fait ; vérifie et fais comme ça, puis relance l’appel : cet atome ne t’arrêtera plus]\n(${a.file})\n${a.text}`,
    recallHeads: { sure: '[expérience — on dirait que j’ai déjà fait ça ; vérifie que ça convient]', maybe: '[expérience — peut-être quelque chose de proche ; vérifie que ça convient]', also: 'Aussi proche :', only: '[expérience — cas proches]',
      shared: (p, v) => `[expérience d’autrui — non vérifiée ici ; paquet « ${p} »${v ? `, v${v}` : ''}]`, adopt: (id) => `Si ça aide — garde-la comme la tienne : node ~/.maxagent/tools/experience-packs.js adopt "${id}"` },
    updateAvail: (cur, v) => `[maxagent] La version ${v} est sortie (vous avez ${cur || '?'}). Propose au propriétaire de mettre à jour et, après son « oui », lance : npx --yes maxagent@latest update — la commande affiche elle-même les nouveautés.`,
    autoUpdated: (v) => `[maxagent] Mis à jour vers ${v} (les correctifs s’installent seuls, réglage autoUpdate).`,
    news: (text) => `[maxagent, nouvelle] ${text}`,
    adoptAsk: (head, id) => `[expérience] Un atome d’autrui « ${head} » (paquet partagé) a été affiché pendant ce tour. S’il a servi et marché — garde-le comme le tien : node ~/.maxagent/tools/experience-packs.js adopt "${id}", corrige les chemins si besoin et vérifie lint. Sinon — ne fais rien et termine. Ce hook ne t’arrêtera pas une seconde fois.`,
    did: { research: 'recherche/lecture sur le web', shell: 'commandes', edits: 'corrections de code après une vérification' },
    catastrophic: 'La commande pourrait détruire le système ou toutes les données (racine du disque, dossier personnel, formatage). Toujours interdit — si c’est vraiment nécessaire, le propriétaire la lance lui-même.',
    search: (rows) => `[expérience avant la recherche] L’expérience contient des entrées correspondant à cette recherche :\n${rows}\nLis d’abord celles qui conviennent et suis-les. Si la réponse n’y est pas, relance la même recherche (le hook la laisse passer la seconde fois dans ce tour) et note ensuite ce que tu trouves.`,
    ask: (quote, rows) => `[expérience avant de demander] Tu demandes au propriétaire de faire quelque chose à la main : « ${quote} ». L’expérience contient des entrées à ce sujet :\n${rows}\nLis-les : si elles montrent une façon de le faire toi-même, fais-le et ne demande pas. Si le propriétaire est vraiment indispensable (sa connexion, son mot de passe, sa décision, une action physique), garde la demande et termine. Ce hook ne t’arrêtera pas une seconde fois.`,
    done: (word, file) => `[maxagent, vérification] Tu écris « ${word} », mais après la dernière modification (${file}) tu n’as rien lancé ni ouvert aucun résultat. Vérifie pour de vrai (lance, ouvre, regarde) ou dis clairement au propriétaire que ce n’est pas vérifié. Ce hook ne t’arrêtera pas une seconde fois.`,
    browserBuiltIn: (tool) => `[maxagent, navigateur] Le navigateur intégré de l’agent (${tool}) est désactivé par les réglages du propriétaire : le navigateur, c’est uniquement son propre Chrome via maxagent-bridge (outils mcp__maxagent-bridge__* : browser_status, tabs_list, snapshot, click, type…). S’ils ne sont pas dans ta liste, trouve-les par une recherche d’outils sur maxagent-bridge.`,
    browserProc: '[maxagent, navigateur] Cette commande cherche, lance ou ferme elle-même des processus Chrome. C’est ainsi que les agents prennent un Chrome étranger (Playwright, headless, autre profil) pour le navigateur du propriétaire et se perdent en contournements. Pont non connecté / navigateur fermé / bloqué — une seule étape : l’outil launch_browser du pont (il ouvre le profil du propriétaire avec l’extension). Si la commande ne concerne pas le navigateur du propriétaire (ton propre headless, un profil temporaire), ajoute-lui le commentaire not-owner-browser.',
    bridgeDown: '[maxagent, navigateur] Le pont n’est pas connecté. Une seule étape, sans contournement : l’outil launch_browser du pont — il lance exactement le navigateur du propriétaire (le profil avec l’extension) et attend la connexion. Ne cherche pas chrome.exe dans la liste des processus (il y en a d’autres : Playwright, headless, autres profils — n’y touche pas), ne passe pas à d’autres navigateurs ou méthodes. Si ça n’aide pas — `npx maxagent-bridge doctor` et dis brièvement au propriétaire ce qui ne va pas exactement.',
    inboxSave: (where) => `[entrée] Le propriétaire demande d’enregistrer quelque chose — range-le tel quel, sans trier et sans demander « où » : dans ${where}inbox/ en un fichier AAAA-MM-JJ-<court-en-latin>.md (mot pour mot + « Source : » + « Pourquoi : » si c’est dit, + une ligne « Type : »). Règles — inbox/README.md. Réponds par une ligne avec le lien vers le fichier.`,
    inboxLine: (n, items) => `[entrée] Non triés : ${n} (tri seulement sur demande du propriétaire).${items ? ` À ne pas oublier : ${items}.` : ''}`,
    envHead: '[environnement]',
    startHead: '[maxagent] Règles principales — garde-les en vue pendant toute la session :',
    compactHead: '[maxagent] Le contexte a été compacté — les règles lues au début ont pu disparaître. L’essentiel, garde-le en vue :',
    ownHead: 'Règles du propriétaire (« Mes règles » dans AGENTS.md) :',
    startTail: (ws) => `Règles complètes et règles du dossier de travail : ${ws}`,
  },
  zh: {
    reminder: '任务简报：需要搜索（网络/电脑）吗？需要主人做什么吗？超过 3 步吗？属于某个项目吗？— 只要有一个「是」：先查这个任务的经验：上面已显示 — 照着做；没显示 — node ~/.maxagent/tools/experience-engine.js find "<任务关键词>"；属于项目的，还要看 projects.md 和项目卡片。不要从头来。用一句话说明：「按经验做：<文件>」/「先查一下经验」/「新任务，还没有经验 — 发现新东西就记下来」。只记录新知识（需要查明的、有东西失败了、主人的规则、可重复的方法），不看步骤多少。',
    projectHead: '[项目] 看起来是项目工作 — 卡片和当前任务：',
    stop: (did) => `[maxagent，经验] 本轮：${did}，但经验（experience/）没有变化。经验是无需搜索、不会出错的可重复操作。如果本轮需要搜索、有东西失败了、主人给了规则，或者得到了一个会重复使用的方法 — 按 experience/_spec.md 在 experience/<类别>/<事物>.md 写一个原子（样例 — experience/_template.md；已有这样的原子就修改它）：\n### <用请求原话描述的任务>\n- когда: <请求> · <命令/工具> · <错误文本>\n- вещь: <对象> · <对象>\n1. <步骤，命令>\n- проверка: <应该得到什么>\n- ловушка: 不要<这样> — <原因>\n- источник: 自己的经验，<日期>\n检查：node ~/.maxagent/tools/experience-engine.js lint <文件> → 没有错误；find "<请求关键词>" → 原子排在最前。然后 commit。没有可记录的 — 用一行说明原因并结束。这个钩子不会第二次拦你。`,
    lintBad: (file, list) => `[maxagent，经验] ${file} 不符合原子格式（experience/_spec.md）— 现在就修正，否则很难被找到，commit 也通不过：\n${list}`,
    actionAtom: (a) => `[操作前的经验 — 以前做过这件事；核对后照着做，然后重新调用：这个原子不会再拦你]\n(${a.file})\n${a.text}`,
    recallHeads: { sure: '[经验 — 好像我做过这个；核对是否适用]', maybe: '[经验 — 可能有类似的；核对是否适用]', also: '其他类似：', only: '[经验 — 类似的情况]',
      shared: (p, v) => `[他人的经验 — 在这里未经验证；经验包「${p}」${v ? `，v${v}` : ''}]`, adopt: (id) => `如果有用 — 存为自己的：node ~/.maxagent/tools/experience-packs.js adopt "${id}"` },
    updateAvail: (cur, v) => `[maxagent] 已发布 ${v} 版（你的是 ${cur || '?'}）。向主人提议更新，在主人说「是」之后运行：npx --yes maxagent@latest update — 更新内容由该命令自己显示。`,
    autoUpdated: (v) => `[maxagent] 已更新到 ${v}（修复会自动安装，设置项 autoUpdate）。`,
    news: (text) => `[maxagent，消息] ${text}`,
    adoptAsk: (head, id) => `[经验] 本轮显示了他人的原子「${head}」（共享经验包）。如果它有用且奏效 — 存为自己的：node ~/.maxagent/tools/experience-packs.js adopt "${id}"，必要时修改路径并检查 lint。没用 — 什么都不做，结束即可。这个钩子不会第二次拦你。`,
    did: { research: '网络搜索/阅读', shell: '命令', edits: '检查后的代码修改' },
    catastrophic: '该命令可能毁掉系统或全部数据（磁盘根目录、主文件夹、格式化）。永远禁止 — 如果确实需要，由主人自己执行。',
    search: (rows) => `[搜索前的经验] 经验中有与此搜索匹配的条目：\n${rows}\n先读相关的条目并照做。如果里面没有答案 — 重复同样的搜索（本轮第二次钩子会放行），然后把找到的记录到经验里。`,
    ask: (quote, rows) => `[请求前的经验] 你在请主人手动做事：「${quote}」。经验中有相关条目：\n${rows}\n先读：如果里面有自己完成的方法 — 自己做，不要请求。如果确实离不开主人（他的登录、密码、决定、实际操作）— 保留请求并结束。这个钩子不会第二次拦你。`,
    done: (word, file) => `[maxagent，检查] 你写了「${word}」，但在最后一次修改（${file}）之后什么都没运行，也没打开结果。请实际检查（运行、打开、查看），或者直接告诉主人尚未验证。这个钩子不会第二次拦你。`,
    browserBuiltIn: (tool) => `[maxagent，浏览器] 智能体的内置浏览器（${tool}）已被主人的设置禁用：浏览器只能是主人自己的 Chrome，通过 maxagent-bridge 使用（工具 mcp__maxagent-bridge__*：browser_status、tabs_list、snapshot、click、type…）。如果你的列表里没有这些工具 — 用工具搜索查找 maxagent-bridge。`,
    browserProc: '[maxagent，浏览器] 这条命令自己查找、启动或关闭 Chrome 进程。智能体就是这样把别人的 Chrome（Playwright、headless、其他配置文件）当成主人的浏览器，然后陷入各种绕路。浏览器桥未连接 / 浏览器已关闭 / 卡死 — 只需一步：浏览器桥的 launch_browser 工具（它会打开带扩展的主人配置文件）。如果命令与主人的浏览器无关（你自己的 headless、临时配置文件）— 在命令中加上注释 not-owner-browser。',
    bridgeDown: '[maxagent，浏览器] 浏览器桥未连接。只需一步，不要绕路：浏览器桥的 launch_browser 工具 — 它会启动的正是主人的浏览器（带扩展的配置文件）并等待连接。不要在进程列表里找 chrome.exe（那里也有别人的：Playwright、headless、其他配置文件 — 别碰它们），不要换用其他浏览器或方法。还不行 — 运行 `npx maxagent-bridge doctor`，并简短告诉主人具体哪里出了问题。',
    inboxSave: (where) => `[收件箱] 主人要求保存 — 原样保存，不整理，也不问「放哪儿」：在 ${where}inbox/ 中存为一个文件 YYYY-MM-DD-<拉丁字母简称>.md（原文 + 「来源：」+ 「用途：」（如果说了）+ 一行「类型：」）。规则 — inbox/README.md。回复一行带文件链接的话即可。`,
    inboxLine: (n, items) => `[收件箱] 未整理：${n}（只在主人要求时整理）。${items ? `别忘了做：${items}。` : ''}`,
    envHead: '[环境]',
    startHead: '[maxagent] 核心规则 — 整个会话都要记在心里：',
    compactHead: '[maxagent] 上下文已压缩 — 开头读过的规则可能丢了。要点如下，记在心里：',
    ownHead: '主人的规则（AGENTS.md 中的「我的规则」）：',
    startTail: (ws) => `完整规则和工作文件夹规则：${ws}`,
  },
  ja: {
    reminder: 'ブリーフィング: 検索が必要（ネット/PC）？ オーナーに何か頼む必要がある？ 3 ステップより多い？ プロジェクトに関係する？ — 1 つでも「はい」なら、まずこのタスクの経験: 上に表示されていればそのとおりに、表示されていなければ node ~/.maxagent/tools/experience-engine.js find "<タスクの言葉>"。プロジェクトなら projects.md とそのカードも。ゼロから始めない。ひと言で伝える:「経験どおりに進めます: <ファイル>」/「まず経験を確認します」/「新しいタスクで経験はまだありません — 新しくわかったことは記録します」。記録するのは新しい知識だけ（調べる必要があった、何かが失敗した、オーナーのルール、繰り返し使える方法）。ステップの数では決めない。',
    projectHead: '[プロジェクト] プロジェクトの作業のようです — カードと進行中のタスク:',
    stop: (did) => `[maxagent、経験] このターン: ${did}。しかし経験（experience/）は変わっていません。経験とは、検索もミスもなく繰り返せる行動です。このターンで検索が必要だった、何かが失敗した、オーナーがルールを示した、繰り返し使う方法ができた — なら experience/_spec.md に従って experience/<種類>/<対象>.md にアトムを書いてください（見本 — experience/_template.md。同じアトムがあれば直す）:\n### <依頼の言葉で書いたタスク>\n- когда: <依頼> · <コマンド/ツール> · <エラーの文>\n- вещь: <対象> · <対象>\n1. <手順、コマンド>\n- проверка: <得られるべき結果>\n- ловушка: <こう>しない — <理由>\n- источник: 自分の経験、<日付>\n確認: node ~/.maxagent/tools/experience-engine.js lint <ファイル> → エラーなし。find "<依頼の言葉>" → アトムが一番上。その後 commit。記録することがなければ、理由を 1 行で述べて終了。このフックが止めるのは 1 回だけです。`,
    lintBad: (file, list) => `[maxagent、経験] ${file} はアトムの形式（experience/_spec.md）になっていません — 今すぐ直してください。直さないと見つけにくく、commit も通りません:\n${list}`,
    actionAtom: (a) => `[操作前の経験 — これは以前にやったことがあります。確認してそのとおりに行い、呼び出しをやり直してください: このアトムが止めるのは 1 回だけです]\n(${a.file})\n${a.text}`,
    recallHeads: { sure: '[経験 — 以前やったことがあるようです。合っているか確認]', maybe: '[経験 — 似たものかもしれません。合っているか確認]', also: 'ほかに似たもの:', only: '[経験 — 似たケース]',
      shared: (p, v) => `[他人の経験 — ここでは未確認。パック「${p}」${v ? `、v${v}` : ''}]`, adopt: (id) => `役に立ったら自分のものとして保存: node ~/.maxagent/tools/experience-packs.js adopt "${id}"` },
    updateAvail: (cur, v) => `[maxagent] バージョン ${v} が出ました（現在 ${cur || '?'}）。オーナーに更新を提案し、「はい」の後に実行: npx --yes maxagent@latest update — 新機能はコマンド自体が表示します。`,
    autoUpdated: (v) => `[maxagent] ${v} に更新しました（修正は自動でインストールされます。設定 autoUpdate）。`,
    news: (text) => `[maxagent、お知らせ] ${text}`,
    adoptAsk: (head, id) => `[経験] このターンで他人のアトム「${head}」（共有パック）が表示されました。役に立って動いたなら自分のものとして保存: node ~/.maxagent/tools/experience-packs.js adopt "${id}"。必要ならパスを直し、lint を確認。役に立たなければ何もせず終了。このフックが止めるのは 1 回だけです。`,
    did: { research: 'ネットでの検索・閲覧', shell: 'コマンド', edits: '確認後のコード修正' },
    catastrophic: 'このコマンドはシステムやすべてのデータを壊すおそれがあります（ドライブのルート、ホームフォルダ、フォーマット）。常に禁止 — 本当に必要ならオーナー自身が実行します。',
    search: (rows) => `[検索前の経験] この検索に合う経験の記録があります:\n${rows}\nまず合うものを読み、そのとおりに行ってください。答えがなければ同じ検索をもう一度（このターンの 2 回目はフックが通します）。見つけたことは後で経験に記録してください。`,
    ask: (quote, rows) => `[依頼前の経験] オーナーに手作業を頼もうとしています:「${quote}」。これについての経験があります:\n${rows}\n読んでください: 自分でやる方法があれば、自分でやって頼まない。どうしてもオーナーが必要なら（本人のログイン、パスワード、判断、物理的な操作）、依頼を残して終了。このフックが止めるのは 1 回だけです。`,
    done: (word, file) => `[maxagent、確認] 「${word}」と書いていますが、最後の編集（${file}）の後に何も実行せず、結果も開いていません。実際に確認する（実行する、開く、見る）か、未確認だとオーナーにはっきり伝えてください。このフックが止めるのは 1 回だけです。`,
    browserBuiltIn: (tool) => `[maxagent、ブラウザ] エージェント内蔵のブラウザ（${tool}）はオーナーの設定で禁止されています: ブラウザはオーナー自身の Chrome のみ、maxagent-bridge 経由で使います（ツール mcp__maxagent-bridge__*: browser_status、tabs_list、snapshot、click、type…）。一覧になければ、ツール検索で maxagent-bridge を探してください。`,
    browserProc: '[maxagent、ブラウザ] このコマンドは自分で Chrome のプロセスを探したり、起動・終了したりします。こうしてエージェントは他人の Chrome（Playwright、headless、別プロファイル）をオーナーのブラウザと取り違え、回り道に迷い込みます。ブリッジ未接続 / ブラウザが閉じている / 固まった — 手順は 1 つ: ブリッジのツール launch_browser（拡張入りのオーナーのプロファイルを開きます）。コマンドがオーナーのブラウザと無関係なら（自分の headless、一時プロファイル）、コマンドに not-owner-browser というコメントを付けてください。',
    bridgeDown: '[maxagent、ブラウザ] ブリッジが接続されていません。手順は 1 つ、回り道なし: ブリッジのツール launch_browser — まさにオーナーのブラウザ（拡張入りのプロファイル）を起動し、接続を待ちます。プロセス一覧で chrome.exe を探さない（Playwright、headless、別プロファイルなど他のものもあります — 触らない）、別のブラウザや方法に切り替えない。それでもだめなら `npx maxagent-bridge doctor` を実行し、何がおかしいのかをオーナーに手短に伝えてください。',
    inboxSave: (where) => `[受信箱] オーナーが保存を頼んでいます — 整理せず、「どこに」とも聞かず、そのまま保存: ${where}inbox/ に 1 つのファイル YYYY-MM-DD-<ラテン文字の短い名前>.md として（原文そのまま +「出典:」+ 言われていれば「目的:」+「種類:」の行）。ルール — inbox/README.md。返答はファイルへのリンク付きの 1 行。`,
    inboxLine: (n, items) => `[受信箱] 未整理: ${n}（整理はオーナーの指示があったときだけ）。${items ? `忘れずにやること: ${items}。` : ''}`,
    envHead: '[環境]',
    startHead: '[maxagent] 主要ルール — セッションの間ずっと意識しておくこと:',
    compactHead: '[maxagent] コンテキストが圧縮されました — 最初に読んだルールが抜けているかもしれません。要点は以下、意識しておくこと:',
    ownHead: 'オーナーのルール（AGENTS.md の「自分のルール」）:',
    startTail: (ws) => `完全なルールと作業フォルダのルール: ${ws}`,
  },
  ko: {
    reminder: '브리핑: 검색이 필요한가 (인터넷/컴퓨터)? 주인에게서 뭔가 필요한가? 3단계보다 많은가? 프로젝트와 관련 있는가? — 하나라도 "예"라면 먼저 이 작업의 경험: 위에 나왔으면 그대로 하고, 안 나왔으면 node ~/.maxagent/tools/experience-engine.js find "<작업 단어>"; 프로젝트라면 projects.md와 그 카드도. 처음부터 하지 말 것. 한 문장으로 말하기: "경험대로 합니다: <파일>" / "먼저 경험을 확인합니다" / "새 작업이라 경험이 없습니다 — 새로 알게 되면 기록하겠습니다". 기록은 새로운 지식만 (알아봐야 했던 것, 실패한 것, 주인의 규칙, 반복될 방법) — 단계 수 때문이 아님.',
    projectHead: '[프로젝트] 프로젝트 작업으로 보입니다 — 카드와 진행 중인 작업:',
    stop: (did) => `[maxagent, 경험] 이번 턴: ${did}, 그런데 경험(experience/)은 바뀌지 않았습니다. 경험이란 검색도 실수도 없이 반복할 수 있는 행동입니다. 이번 턴에 검색이 필요했거나, 뭔가 실패했거나, 주인이 규칙을 줬거나, 반복될 방법이 나왔다면 — experience/_spec.md에 따라 experience/<종류>/<대상>.md에 아톰을 쓰세요 (예시 — experience/_template.md; 같은 아톰이 이미 있으면 고치기):\n### <요청한 말 그대로의 작업>\n- когда: <요청> · <명령/도구> · <오류 문구>\n- вещь: <대상> · <대상>\n1. <단계, 명령>\n- проверка: <나와야 할 결과>\n- ловушка: <이렇게> 하지 말 것 — <이유>\n- источник: 직접 경험, <날짜>\n확인: node ~/.maxagent/tools/experience-engine.js lint <파일> → 오류 없음; find "<요청 단어>" → 아톰이 맨 위. 그다음 commit. 기록할 것이 없으면 이유를 한 줄로 말하고 마치세요. 이 훅은 두 번 막지 않습니다.`,
    lintBad: (file, list) => `[maxagent, 경험] ${file}이(가) 아톰 형식(experience/_spec.md)에 맞지 않습니다 — 지금 고치세요. 아니면 잘 찾아지지 않고 commit도 통과하지 못합니다:\n${list}`,
    actionAtom: (a) => `[행동 전 경험 — 전에 해 본 일입니다; 확인하고 그대로 한 뒤 호출을 다시 하세요: 이 아톰은 다시 막지 않습니다]\n(${a.file})\n${a.text}`,
    recallHeads: { sure: '[경험 — 전에 해 본 것 같습니다; 맞는지 확인]', maybe: '[경험 — 비슷한 것일 수 있습니다; 맞는지 확인]', also: '그 밖에 비슷한 것:', only: '[경험 — 비슷한 사례]',
      shared: (p, v) => `[다른 사람의 경험 — 여기서 확인되지 않음; 팩 "${p}"${v ? `, v${v}` : ''}]`, adopt: (id) => `도움이 되면 내 것으로 저장: node ~/.maxagent/tools/experience-packs.js adopt "${id}"` },
    updateAvail: (cur, v) => `[maxagent] ${v} 버전이 나왔습니다 (현재 ${cur || '?'}). 주인에게 업데이트를 제안하고, "예"라고 하면 실행: npx --yes maxagent@latest update — 새로운 내용은 명령이 직접 보여 줍니다.`,
    autoUpdated: (v) => `[maxagent] ${v}(으)로 업데이트됨 (수정 사항은 자동 설치, 설정 autoUpdate).`,
    news: (text) => `[maxagent, 소식] ${text}`,
    adoptAsk: (head, id) => `[경험] 이번 턴에 다른 사람의 아톰 "${head}" (공유 팩)이 표시되었습니다. 도움이 되고 작동했다면 내 것으로 저장: node ~/.maxagent/tools/experience-packs.js adopt "${id}", 필요하면 경로를 고치고 lint를 확인하세요. 도움이 안 됐다면 아무것도 하지 말고 마치세요. 이 훅은 두 번 막지 않습니다.`,
    did: { research: '인터넷 검색/읽기', shell: '명령', edits: '확인 후 코드 수정' },
    catastrophic: '이 명령은 시스템이나 모든 데이터를 파괴할 수 있습니다 (드라이브 루트, 홈 폴더, 포맷). 항상 금지 — 정말 필요하면 주인이 직접 실행합니다.',
    search: (rows) => `[검색 전 경험] 이 검색과 맞는 경험 기록이 있습니다:\n${rows}\n먼저 맞는 것을 읽고 그대로 하세요. 거기에 답이 없으면 같은 검색을 다시 하세요 (이번 턴 두 번째에는 훅이 통과시킵니다). 찾은 것은 나중에 경험에 기록하세요.`,
    ask: (quote, rows) => `[요청 전 경험] 주인에게 손으로 해 달라고 요청하고 있습니다: "${quote}". 이에 대한 경험 기록이 있습니다:\n${rows}\n읽어 보세요: 직접 하는 방법이 있으면 직접 하고 요청하지 마세요. 정말 주인이 필요하면 (본인 로그인, 비밀번호, 결정, 물리적 행동) 요청을 남기고 마치세요. 이 훅은 두 번 막지 않습니다.`,
    done: (word, file) => `[maxagent, 확인] "${word}"라고 쓰고 있지만, 마지막 수정(${file}) 뒤로 아무것도 실행하지 않았고 결과도 열지 않았습니다. 실제로 확인하거나 (실행하고, 열고, 보기) 확인하지 않았다고 주인에게 분명히 말하세요. 이 훅은 두 번 막지 않습니다.`,
    browserBuiltIn: (tool) => `[maxagent, 브라우저] 에이전트 내장 브라우저(${tool})는 주인의 설정으로 꺼져 있습니다: 브라우저는 maxagent-bridge를 통한 주인의 Chrome뿐입니다 (도구 mcp__maxagent-bridge__*: browser_status, tabs_list, snapshot, click, type…). 목록에 없으면 도구 검색에서 maxagent-bridge로 찾으세요.`,
    browserProc: '[maxagent, 브라우저] 이 명령은 스스로 Chrome 프로세스를 찾거나, 시작하거나, 종료합니다. 이렇게 에이전트는 남의 Chrome (Playwright, headless, 다른 프로필)을 주인의 브라우저로 착각하고 우회로를 헤맵니다. 브리지 연결 안 됨 / 브라우저 닫힘 / 멈춤 — 한 단계: 브리지 도구 launch_browser (확장이 든 주인 프로필을 엽니다). 명령이 주인의 브라우저와 상관없다면 (직접 쓰는 headless, 임시 프로필) 명령에 not-owner-browser 주석을 붙이세요.',
    bridgeDown: '[maxagent, 브라우저] 브리지가 연결되지 않았습니다. 한 단계, 우회 없이: 브리지 도구 launch_browser — 바로 주인의 브라우저 (확장이 든 프로필)를 시작하고 연결을 기다립니다. 프로세스 목록에서 chrome.exe를 찾지 마세요 (거기엔 남의 것도 있습니다: Playwright, headless, 다른 프로필 — 건드리지 말 것). 다른 브라우저나 방법으로 바꾸지 마세요. 그래도 안 되면 `npx maxagent-bridge doctor`를 실행하고 무엇이 문제인지 주인에게 짧게 알리세요.',
    inboxSave: (where) => `[받은 편지함] 주인이 저장을 부탁합니다 — 정리하지 말고 "어디에" 묻지도 말고 그대로 저장: ${where}inbox/에 파일 하나 YYYY-MM-DD-<라틴-문자로-짧게>.md (원문 그대로 + "출처:" + 말했다면 "용도:" + "종류:" 줄). 규칙 — inbox/README.md. 답은 파일 링크가 있는 한 줄.`,
    inboxLine: (n, items) => `[받은 편지함] 정리 안 됨: ${n} (정리는 주인이 말할 때만).${items ? ` 잊지 말고 할 것: ${items}.` : ''}`,
    envHead: '[환경]',
    startHead: '[maxagent] 핵심 규칙 — 세션 내내 눈앞에 두세요:',
    compactHead: '[maxagent] 컨텍스트가 압축되었습니다 — 처음에 읽은 규칙이 빠졌을 수 있습니다. 핵심은 아래, 눈앞에 두세요:',
    ownHead: '주인의 규칙 (AGENTS.md의 "내 규칙"):',
    startTail: (ws) => `전체 규칙과 작업 폴더 규칙: ${ws}`,
  },
  hi: {
    reminder: 'ब्रीफ़िंग: खोज चाहिए (इंटरनेट/कंप्यूटर)? मालिक से कुछ चाहिए? 3 से ज़्यादा कदम? किसी प्रोजेक्ट से जुड़ा है? — एक भी "हाँ" हो तो पहले इस काम का अनुभव: ऊपर दिखा — उसी तरह करो; नहीं दिखा — node ~/.maxagent/tools/experience-engine.js find "<काम के शब्द>"; प्रोजेक्ट हो तो projects.md और उसका कार्ड भी। शून्य से नहीं। एक वाक्य में बताओ: "अनुभव के अनुसार कर रहा हूँ: <फ़ाइल>" / "पहले अनुभव देख लेता हूँ" / "नया काम, अनुभव नहीं है — कुछ नया पता चला तो दर्ज करूँगा"। दर्ज करो सिर्फ़ नया ज्ञान (पता लगाना पड़ा, कुछ विफल हुआ, मालिक का नियम, दोहराने लायक तरीका), कदमों की गिनती की वजह से नहीं।',
    projectHead: '[प्रोजेक्ट] लगता है प्रोजेक्ट का काम है — कार्ड और चालू काम:',
    stop: (did) => `[maxagent, अनुभव] इस बारी में: ${did}, लेकिन अनुभव (experience/) नहीं बदला। अनुभव वह दोहराने लायक काम है जिसमें न खोज लगे न गलती हो। अगर इस बारी में खोजना पड़ा, कुछ विफल हुआ, मालिक ने नियम दिया या कोई ऐसा तरीका निकला जो दोहराया जाएगा — experience/_spec.md के अनुसार experience/<प्रकार>/<चीज़>.md में एक एटम लिखो (नमूना — experience/_template.md; ऐसा एटम पहले से हो तो उसे सुधारो):\n### <अनुरोध के शब्दों में काम>\n- когда: <अनुरोध> · <कमांड/टूल> · <त्रुटि का पाठ>\n- вещь: <चीज़> · <चीज़>\n1. <कदम, कमांड>\n- проверка: <क्या मिलना चाहिए>\n- ловушка: <ऐसे> नहीं — <क्यों>\n- источник: अपना अनुभव, <तारीख>\nजाँचो: node ~/.maxagent/tools/experience-engine.js lint <फ़ाइल> → कोई त्रुटि नहीं; find "<अनुरोध के शब्द>" → एटम सबसे ऊपर। फिर commit। दर्ज करने को कुछ नहीं — एक पंक्ति में वजह बताओ और खत्म करो। यह हुक दूसरी बार नहीं रोकेगा।`,
    lintBad: (file, list) => `[maxagent, अनुभव] ${file} एटम के प्रारूप (experience/_spec.md) में नहीं है — अभी ठीक करो, वरना यह ठीक से नहीं मिलेगा और commit पास नहीं होगा:\n${list}`,
    actionAtom: (a) => `[काम से पहले अनुभव — यह पहले किया जा चुका है; जाँचो और उसी तरह करो, फिर कॉल दोहराओ: यह एटम दोबारा नहीं रोकेगा]\n(${a.file})\n${a.text}`,
    recallHeads: { sure: '[अनुभव — लगता है मैं यह पहले कर चुका हूँ; जाँचो कि फ़िट बैठता है]', maybe: '[अनुभव — शायद कुछ मिलता-जुलता; जाँचो कि फ़िट बैठता है]', also: 'और मिलते-जुलते:', only: '[अनुभव — मिलते-जुलते मामले]',
      shared: (p, v) => `[किसी और का अनुभव — यहाँ जाँचा नहीं गया; पैक "${p}"${v ? `, v${v}` : ''}]`, adopt: (id) => `काम आए तो अपना बना लो: node ~/.maxagent/tools/experience-packs.js adopt "${id}"` },
    updateAvail: (cur, v) => `[maxagent] संस्करण ${v} आ गया है (आपके पास ${cur || '?'})। मालिक को अपडेट का सुझाव दो और उनके "हाँ" के बाद चलाओ: npx --yes maxagent@latest update — नया क्या है, कमांड खुद दिखाएगी।`,
    autoUpdated: (v) => `[maxagent] ${v} पर अपडेट हुआ (सुधार अपने आप इंस्टॉल होते हैं, सेटिंग autoUpdate)।`,
    news: (text) => `[maxagent, खबर] ${text}`,
    adoptAsk: (head, id) => `[अनुभव] इस बारी में किसी और का एटम "${head}" (साझा पैक) दिखाया गया। अगर काम आया और चला — अपना बना लो: node ~/.maxagent/tools/experience-packs.js adopt "${id}", ज़रूरत हो तो पाथ ठीक करो और lint जाँचो। काम नहीं आया — कुछ मत करो और खत्म करो। यह हुक दूसरी बार नहीं रोकेगा।`,
    did: { research: 'इंटरनेट पर खोज/पढ़ना', shell: 'कमांड', edits: 'जाँच के बाद कोड में सुधार' },
    catastrophic: 'यह कमांड सिस्टम या सारा डेटा नष्ट कर सकती है (डिस्क का रूट, होम फ़ोल्डर, फ़ॉर्मैट)। हमेशा मना है — सच में ज़रूरत हो तो मालिक खुद चलाएँगे।',
    search: (rows) => `[खोज से पहले अनुभव] इस खोज से मेल खाती अनुभव की प्रविष्टियाँ हैं:\n${rows}\nपहले जो फ़िट बैठें उन्हें पढ़ो और उनके अनुसार करो। जवाब उनमें न हो तो वही खोज दोहराओ (इस बारी में दूसरी बार हुक जाने देगा), और जो मिले उसे बाद में अनुभव में दर्ज करो।`,
    ask: (quote, rows) => `[अनुरोध से पहले अनुभव] तुम मालिक से हाथ से कुछ करने को कह रहे हो: "${quote}"। इस बारे में अनुभव की प्रविष्टियाँ हैं:\n${rows}\nउन्हें पढ़ो: अगर खुद करने का तरीका है — खुद करो और मत कहो। अगर मालिक के बिना सच में नहीं होगा (उनका लॉगिन, पासवर्ड, फ़ैसला, शारीरिक काम) — अनुरोध रहने दो और खत्म करो। यह हुक दूसरी बार नहीं रोकेगा।`,
    done: (word, file) => `[maxagent, जाँच] तुम "${word}" लिख रहे हो, पर आखिरी बदलाव (${file}) के बाद तुमने कुछ नहीं चलाया और कोई नतीजा नहीं खोला। सच में जाँचो (चलाओ, खोलो, देखो) या मालिक को साफ़ बताओ कि जाँचा नहीं गया। यह हुक दूसरी बार नहीं रोकेगा।`,
    browserBuiltIn: (tool) => `[maxagent, ब्राउज़र] एजेंट का बिल्ट-इन ब्राउज़र (${tool}) मालिक की सेटिंग से बंद है: ब्राउज़र सिर्फ़ उनका अपना Chrome है, maxagent-bridge के ज़रिए (टूल mcp__maxagent-bridge__*: browser_status, tabs_list, snapshot, click, type…)। अगर ये तुम्हारी सूची में नहीं हैं — टूल खोज में maxagent-bridge से ढूँढो।`,
    browserProc: '[maxagent, ब्राउज़र] यह कमांड खुद Chrome की प्रोसेस ढूँढती, शुरू करती या बंद करती है। इसी तरह एजेंट किसी और के Chrome (Playwright, headless, दूसरी प्रोफ़ाइल) को मालिक का ब्राउज़र समझ लेते हैं और जुगाड़ों में भटक जाते हैं। ब्रिज जुड़ा नहीं / ब्राउज़र बंद / अटका — एक कदम: ब्रिज का टूल launch_browser (यह एक्सटेंशन वाली मालिक की प्रोफ़ाइल खोलता है)। अगर कमांड मालिक के ब्राउज़र के बारे में नहीं है (तुम्हारा अपना headless, अस्थायी प्रोफ़ाइल) — उसमें टिप्पणी not-owner-browser जोड़ो।',
    bridgeDown: '[maxagent, ब्राउज़र] ब्रिज जुड़ा नहीं है। एक कदम, बिना जुगाड़: ब्रिज का टूल launch_browser — यह ठीक मालिक का ब्राउज़र (एक्सटेंशन वाली प्रोफ़ाइल) शुरू करता है और जुड़ने का इंतज़ार करता है। प्रोसेस सूची में chrome.exe मत ढूँढो (वहाँ दूसरे भी होते हैं: Playwright, headless, दूसरी प्रोफ़ाइल — उन्हें मत छुओ), दूसरे ब्राउज़र या तरीकों पर मत जाओ। फिर भी न हो — `npx maxagent-bridge doctor` चलाओ और मालिक को छोटे में बताओ कि ठीक क्या गड़बड़ है।',
    inboxSave: (where) => `[इनबॉक्स] मालिक कुछ सहेजने को कह रहे हैं — जैसा है वैसा रख दो, बिना छाँटे और बिना "कहाँ" पूछे: ${where}inbox/ में एक फ़ाइल YYYY-MM-DD-<लैटिन-अक्षरों-में-छोटा-नाम>.md के रूप में (शब्दशः + "कहाँ से:" + "किसलिए:" अगर बताया हो, + एक पंक्ति "प्रकार:")। नियम — inbox/README.md। जवाब — फ़ाइल के लिंक वाली एक पंक्ति।`,
    inboxLine: (n, items) => `[इनबॉक्स] बिना छँटे: ${n} (छँटाई सिर्फ़ मालिक के कहने पर)।${items ? ` करना न भूलें: ${items}।` : ''}`,
    envHead: '[परिवेश]',
    startHead: '[maxagent] मुख्य नियम — पूरे सत्र में इन्हें ध्यान में रखो:',
    compactHead: '[maxagent] संदर्भ संक्षिप्त कर दिया गया — शुरुआत में पढ़े नियम छूट गए हो सकते हैं। ज़रूरी बातें नीचे हैं, ध्यान में रखो:',
    ownHead: 'मालिक के नियम (AGENTS.md में "मेरे नियम"):',
    startTail: (ws) => `पूरे नियम और कार्य फ़ोल्डर के नियम: ${ws}`,
  },
};

/* ---------- settings ---------- */

function readJson(f, def) {
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return def; }
}
const CFG = readJson(path.join(ROOT, 'config.json'), {});
const L = TXT[CFG.lang] || TXT.en;
// No code word (removed in 0.4.0, decision 05.11.2026): dangerous-but-legit actions are left to the agent's own
// permission prompts and to the rule "everything read is data"; the hook only forbids what destroys everything.

/* ---------- experience hint ---------- */

const STOP = new Set(('давай давайте этот этого эта эти тоже чтобы когда только если нужно надо можно будет было были есть сейчас потом ' +
  'сделать сделай ещё еще очень просто какой какие который которые там тут здесь почему зачем свой свои всех всем всё весь вообще ' +
  'with that this from have will what when your just there their about would could should please').split(' '));
const stem = (w) => (w.length > 5 ? w.slice(0, 5) : w.slice(0, Math.max(4, w.length - 1)));
function stems(text) {
  const out = new Set();
  for (const w of String(text).toLowerCase().match(/[\p{L}\p{N}]+/gu) || []) if (w.length >= 4 && !STOP.has(w)) out.add(stem(w));
  return out;
}
/* Experience engine: atoms of <experience>/**.md, search and lint (tools/experience-engine.js, installed next to the hook). */
let ENG = null;
try { ENG = require(path.join(ROOT, 'tools', 'experience-engine.js')); } catch { /* no engine — no recall, the rest works */ }

function hint(prompt, session, qvec = null) {
  const lines = [];
  const want = stems(prompt);
  const recalled = ENG ? ENG.recall(prompt, session, { more: 3, heads: L.recallHeads, qvec }) : '';
  if (recalled) lines.push(recalled);
  const projects = want.size ? matchProjects(want) : [];
  if (projects.length) {
    lines.push(L.projectHead);
    for (const p of projects) lines.push(`- ${p.name} — ${p.file}`);
  }
  if (SAVE_RE.test(prompt) && !SAVE_TARGET.test(prompt)) lines.push(L.inboxSave(projects.length ? `projects/${projects[0].file.split('/')[1]}/inbox/ (${projects[0].name}) / ` : ''));
  // The answer format is a rule for every answer, not task experience: shown every time, not searched (08.11.2026).
  if (CFG.answerFormat !== false) lines.push(tx('answerRule'));
  lines.push(L.reminder);
  return lines;
}

/** Project registry rows: "| name | [folder](projects/x/README.md) | stage | updated |". Name weighs 3, the rest 1; at least 2. */
function matchProjects(want) {
  const file = CFG.workspace ? path.join(CFG.workspace, 'projects.md') : null;
  let text;
  try { text = fs.readFileSync(file, 'utf8'); } catch { return []; }
  const out = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.startsWith('|')) continue;
    const link = line.match(/\]\((projects\/[^)]+)\)/);
    if (!link) continue;
    const cols = line.split('|').map((s) => s.trim());
    const name = (cols[1] || '').replace(/\*\*|\[|\]\([^)]*\)/g, '').trim();
    if (!name) continue;
    const nameStems = stems(name.replace(/[-_]/g, ' ') + ' ' + name);
    const rest = stems(cols.slice(3).join(' ').slice(0, 300));
    let score = 0;
    for (const s of want) score += nameStems.has(s) ? 3 : rest.has(s) ? 1 : 0;
    if (score >= 2) out.push({ name, file: link[1], score });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 2);
}

/* ---------- dangerous commands ---------- */

// Always forbidden: wiping a drive root or the whole home folder, formatting disks.
const CATASTROPHIC = [
  /\brm\s+(-[a-z]*[rf][a-z]*\s+)+(--no-preserve-root\s+)?(\/|~|\$HOME|\/\*|[a-z]:[\\/]?)(\s|$)/i,
  /Remove-Item\b[^|;]*-Recurse[^|;]*\s(['"]?)([a-z]:[\\/]?|~|\$HOME|\$env:USERPROFILE|C:\\Users\\?)\1(\s|$)/i,
  /\b(rd|rmdir)\s+\/s\b[^|;]*\s[a-z]:\\?(\s|$)/i,
  /\bformat(\.com)?\s+[a-z]:/i,
  /\b(diskpart|mkfs(\.\w+)?|dd\s+if=.*\bof=\/dev\/)/i,
];

function commandOf(input) {
  if (AGENT === 'antigravity') {
    const a = (input.toolCall && input.toolCall.args) || {};
    return { tool: (input.toolCall && input.toolCall.name) || '', command: String(a.CommandLine || a.command || ''), all: JSON.stringify(a) };
  }
  const ti = input.tool_input || {};
  return { tool: input.tool_name || '', command: typeof ti.command === 'string' ? ti.command : '', all: JSON.stringify(ti) };
}

/* ---------- answers in each agent's format ---------- */

function deny(reason) {
  if (AGENT === 'antigravity') return { decision: 'deny', reason };
  return { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } };
}
const allow = () => (AGENT === 'antigravity' ? { decision: 'allow' } : null);

/* ---------- experience before a web search / before asking the owner ---------- */

const WEB_TOOLS = /^(WebSearch|WebFetch|web_search|web_fetch|search_web|read_url_content)$/;

function transcriptEntries(file) {
  const out = [];
  try {
    for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
      if (!line) continue;
      try { out.push(JSON.parse(line)); } catch { /* partial line */ }
    }
  } catch { /* no transcript */ }
  return out;
}
/** Current turn: Codex gives turn_id; for Claude Code — time of the owner's last message in the transcript. */
function turnOf(input) {
  if (input.turn_id) return String(input.turn_id);
  let mark = '';
  for (const o of transcriptEntries(input.transcript_path)) {
    if (o.type === 'user' && typeof (o.message && o.message.content) === 'string') mark = o.timestamp || mark;
  }
  return mark || 'no-turn';
}

/** First web search of a turn whose words match experience → stop once and show the rows. */
function searchCheck(input, tool) {
  const ti = input.tool_input || (input.toolCall && input.toolCall.args) || {};
  const query = [ti.query, ti.prompt, ti.Query, ti.url && decodeURIComponent(String(ti.url)).replace(/[/:._?=&-]+/g, ' ')].filter(Boolean).join(' ');
  const found = ENG ? ENG.rows(query, { k: 4 }) : '';
  if (!found) return null;
  const session = input.session_id || input.conversationId || 'default';
  const file = path.join(ROOT, 'state', `search-${String(session).replace(/[^\w.-]/g, '_')}.json`);
  const turn = turnOf(input);
  if (readJson(file, {}).turn === turn) return null;
  try {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ turn, tool, at: new Date().toISOString() }));
  } catch { /* state is a convenience */ }
  return deny(L.search(found));
}

// Requests to the owner ("please open…", "press…") in Russian and English.
const ASK_RE = /(^|[^\p{L}])(нажмите|откройте|загрузите|перезагрузите|перезапустите|обновите|запустите|выполните|вставьте|скопируйте|включите|выключите|выберите|зайдите|войдите|установите|скачайте|сделайте|подтвердите|разрешите|введите|закройте|сохраните|отправьте|поставьте|уберите|удалите|переключите|пришлите|ваш шаг|с вашей стороны|нужно от вас|please (open|click|press|run|reload|restart|install|enable|select|go to|log in|sign in|paste|copy|download)|your (turn|step)|you need to|on your side)(?=[^\p{L}]|$)/iu;

function lastAssistantText(input) {
  if (input.last_assistant_message) return String(input.last_assistant_message);
  const entries = transcriptEntries(input.transcript_path);
  for (let i = entries.length - 1; i >= 0; i--) {
    const o = entries[i];
    if (o.type === 'user' && typeof (o.message && o.message.content) === 'string') break;
    if (o.type !== 'assistant' || !Array.isArray(o.message && o.message.content)) continue;
    const text = o.message.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
    if (text) return text;
  }
  return '';
}

/** The turn ends with a request to the owner whose words match experience → stop once: maybe the agent can do it itself. */
function askCheck(input) {
  if (input.stop_hook_active) return null;
  const lines = lastAssistantText(input).split(/\r?\n/);
  // A request in quotes is a quotation in a discussion, not a request.
  const unquoted = (l) => l.replace(/«[^»]*»/g, ' ').replace(/"[^"]*"/g, ' ').replace(/„[^“]*“/g, ' ');
  const parts = [];
  lines.forEach((l, i) => { if (ASK_RE.test(unquoted(l))) parts.push(lines.slice(i, i + 4).join(' ')); });
  if (!parts.length) return null;
  const found = ENG ? ENG.rows(parts.join('\n'), { k: 3 }) : '';
  if (!found) return null;
  return { decision: 'block', reason: L.ask(parts[0].replace(/\s+/g, ' ').slice(0, 160), found) };
}

function pretool(input) {
  const { command, tool } = commandOf(input);
  const br = browserPretool(tool, command);
  if (br) return br;
  if (command && CATASTROPHIC.some((re) => re.test(command))) return deny(L.catastrophic);
  if (WEB_TOOLS.test(tool)) {
    const r = searchCheck(input, tool);
    if (r) return r;
  }
  const act = actionCheck(input, tool, command);
  if (act) return act;
  return allow();
}

/* ---------- Stop: experience recorded? (Claude Code transcript) ---------- */

function stop(input) {
  if (input.stop_hook_active || !input.transcript_path || !CFG.workspace) return null;
  const entries = [];
  for (const line of fs.readFileSync(input.transcript_path, 'utf8').split('\n')) {
    if (!line) continue;
    try { entries.push(JSON.parse(line)); } catch { /* partial line */ }
  }
  let start = 0;
  entries.forEach((o, i) => { if (o.type === 'user' && typeof (o.message && o.message.content) === 'string') start = i; });
  const lib = ENG ? ENG.libraryRoot(CFG) : path.join(CFG.workspace, 'experience');
  const isExp = (p) => path.resolve(String(p)).toLowerCase().startsWith(path.resolve(lib).toLowerCase() + path.sep);
  // Threshold: not the number of steps but new knowledge — a web search, or rework: editing code after running
  // something this turn (ran it, saw the result, fixed it). Docs (.md/.txt) and temp files don't count.
  const NOT_CODE = /[\\/]scratchpad[\\/]|\.(md|txt)$/i;
  let research = 0, ran = false, rework = 0, wrote = false;
  for (const o of entries.slice(start)) {
    if (o.type !== 'assistant' || !Array.isArray(o.message && o.message.content)) continue;
    for (const c of o.message.content) {
      if (c.type !== 'tool_use') continue;
      const inp = c.input || {};
      if (c.name === 'WebSearch' || c.name === 'WebFetch') research++;
      else if (c.name === 'Bash' || c.name === 'PowerShell') {
        if (/experience[\\/]/i.test(inp.command || '')) wrote = true; else ran = true;
      } else if (c.name === 'Edit' || c.name === 'Write' || c.name === 'NotebookEdit') {
        const p = inp.file_path || inp.notebook_path || '';
        if (isExp(p)) wrote = true;
        else if (c.name === 'Edit' && ran && !NOT_CODE.test(p)) rework++;
      }
    }
  }
  const shell = 0, edits = rework; // names kept for the message below
  if (wrote || !(research > 0 || rework > 0)) return null;
  // Fact check: an experience file modified since the turn started counts, however it was written.
  const t0 = Date.parse((entries[start] || {}).timestamp || '') || 0;
  // Entries live in subfolders (experience/<kind>/…), so walk the whole tree.
  const files = [];
  const walkExp = (dir, depth) => {
    let list = [];
    try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of list) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) { if (depth < 6) walkExp(p, depth + 1); } else files.push(p);
    }
  };
  walkExp(lib, 0);
  if (t0 && files.some((f) => { try { return fs.statSync(f).mtimeMs >= t0; } catch { return false; } })) return null;
  const did = [research && `${L.did.research}: ${research}`, shell && `${L.did.shell}: ${shell}`, edits && `${L.did.edits}: ${edits}`].filter(Boolean).join(', ');
  return { decision: 'block', reason: L.stop(did) };
}

/* ---------- Stop: "done" without a check (Claude Code transcript) ---------- */

const CLAIM = /(^|[^\p{L}])(готово|сделано|сделал|работает|заработало|исправлено|исправил|починил|починено|установлено|установил|отправлено|выполнено|всё проверено|проверено и работает|done|fixed|works now|it works|all set|finished)(?=[^\p{L}]|$)/iu;
const HONEST = /не проверено|не проверял|не проверен|не запускал|проверить не (удалось|смог)|без проверки|не смотрел|not (yet )?(verified|tested|checked)|didn'?t (test|check|run)|unverified/i;
const NOT_CODE_FILE = /[\\/](memory|scratchpad|experience|inbox)[\\/]|\.(md|txt)$/i;

/* ---------- the finished answer: format and the answer shelf (decision 08.11.2026) ---------- */

// Texts for languages without their own line fall back to English.
const tx = (k) => (L[k] !== undefined ? L[k] : TXT.en[k]);

/**
 * Paths and commands left as plain text in the finished answer — the owner wants them copyable (code block) or
 * clickable (link). Code blocks, inline code and markdown links are fine and removed before the check.
 */
function formatIssues(text) {
  const plain = String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`\n]*`/g, ' ')
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/<https?:[^>]+>/g, ' ');
  const found = new Set();
  for (const m of plain.matchAll(/(?<![\w/])[A-Za-z]:[\\/][^\s«»"'()<>,;]+/g)) found.add(m[0].replace(/[.:!?]+$/, ''));
  for (const m of plain.matchAll(/(?<![\w/:.])(?:~\/|\.{1,2}\/)?(?:[\w.-]+\/)+[\w.-]+\.(?:md|js|mjs|py|json|ps1|txt|srt|mp4|wav|mp3|png|jpg|webm|mov|yml|yaml|cmd|bat)\b/g)) found.add(m[0]);
  for (const line of plain.split(/\r?\n/)) {
    const m = line.match(/^\s*(?:[-*]\s+|\d+\.\s+)?((?:npx|npm|node|python|py|pip|git|ssh|scp|ffmpeg|winget|powershell|pwsh|curl)\s+[^\s].*)$/);
    if (m) found.add(m[1].trim().slice(0, 80));
  }
  return [...found].slice(0, 5);
}

function formatCheck(input) {
  if (input.stop_hook_active || CFG.answerFormat === false) return null;
  const issues = formatIssues(lastAssistantText(input));
  return issues.length ? tx('formatAsk')(issues) : null;
}

/** The answer shelf: atoms found by the text of the finished answer (not the request). */
function answerCheck(input) {
  if (input.stop_hook_active || !ENG || !ENG.answerRecall) return Promise.resolve(null);
  const text = lastAssistantText(input);
  if (!text.trim()) return Promise.resolve(null);
  const session = input.session_id || input.conversationId || 'default';
  return (ENG.queryVector ? ENG.queryVector(text.slice(0, 2000)) : Promise.resolve(null)).then((qvec) => {
    const atoms = ENG.answerRecall(text, session, { qvec });
    // Only what to do: the heading, steps and traps. "when"/"thing" are for search, "source" is for people — noise for the model.
    const brief = (t) => String(t).split(/\r?\n/).filter((l) => !/^- (когда|вещь|источник|проверка|when|thing|source|check):/i.test(l)).join('\n');
    return atoms.length ? tx('answerAtoms')(atoms.map((a) => brief(a.text)).join('\n\n')) : null;
  });
}

/** Final message claims "done", but nothing was run or opened after the last code edit of this turn → stop once. */
function doneCheck(input) {
  if (input.stop_hook_active || !input.transcript_path) return null;
  const entries = transcriptEntries(input.transcript_path);
  let start = 0;
  entries.forEach((o, i) => { if (o.type === 'user' && typeof (o.message && o.message.content) === 'string') start = i; });
  const uses = [];
  let last = '';
  for (const o of entries.slice(start)) {
    if (o.type !== 'assistant' || !Array.isArray(o.message && o.message.content)) continue;
    for (const c of o.message.content) {
      if (c.type === 'tool_use') uses.push(c);
      if (c.type === 'text' && c.text.trim()) last = c.text;
    }
  }
  const text = String(input.last_assistant_message || last);
  const plain = text.replace(/«[^»]*»/g, ' ').replace(/"[^"]*"/g, ' ').replace(/`[^`]*`/g, ' ');
  const claim = plain.match(CLAIM);
  if (!claim || HONEST.test(text)) return null;
  let lastEdit = -1;
  let file = '';
  uses.forEach((u, i) => {
    const p = (u.input || {}).file_path || '';
    if ((u.name === 'Edit' || u.name === 'Write' || u.name === 'MultiEdit') && p && !NOT_CODE_FILE.test(p)) { lastEdit = i; file = p; }
  });
  if (lastEdit < 0) return null; // no code edited this turn — nothing to check
  const checked = uses.slice(lastEdit + 1).some((u) => /^(Bash|PowerShell|Read|WebFetch)$/.test(u.name) || /screenshot|snapshot|get_page_text|read_page/i.test(u.name));
  if (checked) return null;
  return { decision: 'block', reason: L.done(claim[2], file.split(/[\\/]/).pop()) };
}

/* ---------- browser: the owner's own Chrome through maxagent-bridge (only when the bridge is chosen) ---------- */

const BUILT_IN_BROWSER = /^mcp__(Claude_Browser|claude-in-chrome)__/;
const CHROME_CMD = /(tasklist|Get-Process|Win32_Process|Get-CimInstance|wmic|taskkill|Stop-Process|Start-Process|pkill|killall|pgrep)[^\n]*chrome|chrome[^\n]*(Stop-Process|taskkill)|(^|[&;|]\s*)(&\s*|start\s+(""\s+)?|open\s+-a\s+)?("[^"\n]*chrome(\.exe)?"|'[^'\n]*chrome(\.exe)?'|[^\s"'&;|]*(chrome\.exe|google-chrome(-stable)?)\b)/i;
const CHROME_OK = /not-owner-browser|--headless|--user-data-dir|--new-window|playwright|puppeteer|maxagent-bridge/i;
const BRIDGE_DOWN = /browser_not_connected|browser_disconnected|"connected":\s*false/;

function browserPretool(tool, command) {
  if (!CFG.bridge) return null;
  if (BUILT_IN_BROWSER.test(tool)) return deny(L.browserBuiltIn(tool.split('__')[1]));
  if (command && CHROME_CMD.test(command) && !CHROME_OK.test(command)) return deny(L.browserProc);
  return null;
}

/**
 * After a tool:
 *  - bridge answered "not connected" → the one recipe;
 *  - an experience file was written → lint it at once, errors go back to the agent;
 *  - a command failed → experience whose `когда` matches the error.
 */
const ERROR_RE = /error|exception|not recognized|not found|not a valid|invalid|unexpected|cannot|failed|denied|traceback|no such|не удалось|ошибка|не является|не найден|не удаётся/i;
function posttool(input) {
  const tool = String(input.tool_name || '');
  const resp = typeof input.tool_response === 'string' ? input.tool_response : JSON.stringify(input.tool_response || '');
  const ctx = (text) => ({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: text } });
  if (/^mcp__maxagent-bridge__/.test(tool)) return BRIDGE_DOWN.test(resp) ? ctx(L.bridgeDown) : null;
  if (!ENG) return null;
  const ti = input.tool_input || {};
  const file = ti.file_path || ti.notebook_path || '';
  if (/^(Write|Edit|MultiEdit|NotebookEdit|apply_patch)$/.test(tool) && ENG.inLibrary(file, ENG.libraryRoot(CFG))) {
    let text = '';
    try { text = fs.readFileSync(file, 'utf8'); } catch { return null; }
    const errs = ENG.lint(text, path.basename(file));
    if (!errs.length) return null;
    return { decision: 'block', reason: L.lintBad(path.basename(file), errs.slice(0, 12).map((e) => `строка ${e.line}: ${e.code} ${e.msg}`).join('\n')) };
  }
  // Only the error itself: stdout of a successful command may quote anything (even experience text).
  const tr = input.tool_response;
  const errText = tr && typeof tr === 'object' ? String(tr.stderr || tr.error || '') : resp;
  if (/^(Bash|PowerShell|shell|exec_command|run_command)$/i.test(tool) && errText && ERROR_RE.test(errText)) {
    const atom = ENG.actionRecall(errText.slice(0, 3000), input.session_id || 'default');
    if (atom) return ctx(L.actionAtom(atom));
  }
  return null;
}

/** Before a tool call: experience whose `когда` names this action (the agent's intent shows in the call). Once per atom per session. */
const QUIET_TOOLS = /^(Read|Write|Edit|MultiEdit|NotebookEdit|Glob|Grep|TodoWrite|ToolSearch|view_file|list_dir)$|^mcp__ccd_/;
function actionCheck(input, tool, command) {
  if (!ENG || QUIET_TOOLS.test(tool)) return null;
  // Quoted text (commit messages, echo, heredocs) is what the command says, not what it does.
  // The heredoc body goes, its `<<` stays (a sign by itself); paths name files, not the action (`…/chrome/…` ≠ Chrome).
  const doing = String(command)
    .replace(/<<-?\s*['"]?(\w+)['"]?[\s\S]*?\n\1\b/g, ' << ')
    .replace(/"(?:\\.|[^"\\])*"|'[^']*'/g, ' ')
    .replace(/\S*[\\/]\S*/g, ' ');
  const atom = ENG.actionRecall(`${tool.replace(/^mcp__/, '').replace(/__/g, ' ')} ${doing}`, input.session_id || input.conversationId || 'default');
  return atom ? deny(L.actionAtom(atom)) : null;
}

/* ---------- inbox: "save this for later" ---------- */

const SAVE_RE = /(^|[^\p{L}])(сохрани(те)?|запомни(те)?|на потом|кинь в|закинь в|отложи(те)?|save (this|it)|remember (this|it)|for later|put (it|this) in)(?=[^\p{L}]|$)/iu;
// "Save it to description.txt" names where the task's result goes — not the inbox.
const SAVE_TARGET = /(сохрани(те)?|save)[^.!?\n]{0,40}(в файл|в папк|под имен|как\s+\S+\.|\S+\.(txt|md|json|csv|png|jpg|mp4|py|js)\b|to (a )?file|as\s+\S+\.)/iu;

function inboxDirs() {
  const ws = CFG.workspace;
  const dirs = [path.join(ws, 'inbox')];
  try { for (const p of fs.readdirSync(path.join(ws, 'projects'))) dirs.push(path.join(ws, 'projects', p, 'inbox')); } catch { /* no projects */ }
  return dirs;
}

/** One line for the session start: how many unsorted items, and the "don't forget" ones (up to 5). */
function inboxLine() {
  if (!CFG.workspace) return '';
  let total = 0;
  const remind = [];
  for (const d of inboxDirs()) {
    let files = [];
    try { files = fs.readdirSync(d).filter((f) => f.endsWith('.md') && f.toLowerCase() !== 'readme.md'); } catch { continue; }
    for (const f of files) {
      total++;
      let text = '';
      try { text = fs.readFileSync(path.join(d, f), 'utf8'); } catch { continue; }
      if (/^(Вид|Kind):\s*(не забыть|don'?t forget)/im.test(text)) {
        const title = ((text.match(/^#\s+(.+)$/m) || [])[1] || f).trim();
        remind.push(`${title} (${path.relative(CFG.workspace, path.join(d, f)).replace(/\\/g, '/')})`);
      }
    }
  }
  if (!total) return '';
  const items = remind.length ? remind.slice(0, 5).join('; ') + (remind.length > 5 ? ` +${remind.length - 5}` : '') : '';
  return L.inboxLine(total, items);
}

/* ---------- environment card (built by tools/env-probe.js at init / update) ---------- */

function envLine() {
  if (!CFG.workspace) return '';
  let text = '';
  try { text = fs.readFileSync(path.join(CFG.workspace, 'experience', 'platform', 'environment.md'), 'utf8'); } catch { return ''; }
  const m = text.match(/^- \*\*(?:Кратко|Summary):\*\*\s*(.+)$/m);
  return m ? `${L.envHead} ${m[1].trim()}` : '';
}

/* ---------- session start / after compaction: core rules in view ---------- */

const RULES_RE = /<!-- maxagent:rules:start[^\n]*-->([\s\S]*?)<!-- maxagent:rules:end -->/;
const OWN_RE = /^## (?:Мои правила|My rules)[^\n]*\r?\n([\s\S]*?)(?=^## |(?![\s\S]))/m;

/** Core rules block and the owner's "My rules" section from the workspace AGENTS.md (comments dropped, capped). */
function coreRules() {
  let text = '';
  try { text = fs.readFileSync(path.join(CFG.workspace, 'AGENTS.md'), 'utf8'); } catch { return null; }
  const m = text.match(RULES_RE);
  const rules = m ? m[1].trim() : '';
  const own = ((text.match(OWN_RE) || [])[1] || '').replace(/<!--[\s\S]*?-->/g, '').trim();
  if (!rules && !own) return null;
  return { rules: rules.split(/\r?\n/).slice(0, 40).join('\n'), own: own.split(/\r?\n/).slice(0, 30).join('\n') };
}

function sessionStart(input) {
  const r = CFG.workspace ? coreRules() : null;
  if (!r) return '';
  const lines = [input.source === 'compact' ? L.compactHead : L.startHead];
  if (r.rules) lines.push(r.rules);
  if (r.own) lines.push('', L.ownHead, r.own);
  const env = envLine();
  const inbox = inboxLine();
  const upd = updateLines();
  if (env || inbox || upd.length) lines.push('');
  if (env) lines.push(env);
  if (inbox) lines.push(inbox);
  lines.push(...upd);
  lines.push('', L.startTail(path.join(CFG.workspace, 'AGENTS.md')));
  return lines.join('\n') + '\n';
}

/* ---------- updates and one-time news (tools/update-check.js fills state/update.json once a day) ---------- */

const verParts = (v) => String(v || '0').split(/[.-]/).slice(0, 3).map((x) => parseInt(x, 10) || 0);
function verNewer(a, b) { const x = verParts(a), y = verParts(b); for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i]; return false; }

/** Lines for the session start: a newer version (once a day) and news not shown yet (once each). Starts the check when stale. */
function updateLines() {
  if (CFG.updates === false) return [];
  const stateDir = path.join(ROOT, 'state');
  const st = readJson(path.join(stateDir, 'update.json'), null);
  if (!st || Date.now() - (st.at || 0) > 24 * 3600 * 1000) {
    try {
      const p = require('child_process').spawn(process.execPath, [path.join(ROOT, 'tools', 'update-check.js')], { detached: true, stdio: 'ignore', windowsHide: true });
      p.unref();
    } catch { /* no check this time */ }
  }
  if (!st) return [];
  const out = [];
  const shownFile = path.join(stateDir, 'update-shown.json');
  const shown = readJson(shownFile, { news: [] });
  const latest = st.latest && st.latest.maxagent;
  if (st.autoUpdated) out.push(L.autoUpdated(st.autoUpdated));
  else if (latest && verNewer(latest, CFG.version) && (shown.version !== latest || Date.now() - (shown.at || 0) > 24 * 3600 * 1000)) {
    out.push(L.updateAvail(CFG.version, latest));
    shown.version = latest; shown.at = Date.now();
  }
  for (const n of st.news || []) {
    if (!n || !n.id || (shown.news || []).includes(n.id)) continue;
    if (n.minVersion && verNewer(n.minVersion, CFG.version)) continue;
    if (n.maxVersion && verNewer(CFG.version, n.maxVersion)) continue;
    if (Array.isArray(n.agents) && !n.agents.includes(AGENT)) continue;
    const text = (n.text && (n.text[CFG.lang] || n.text.en)) || '';
    if (!text) continue;
    out.push(L.news(String(text).slice(0, 400)));
    shown.news = [...(shown.news || []), n.id].slice(-200);
    if (out.length >= 3) break; // never a wall of news
  }
  try { fs.mkdirSync(stateDir, { recursive: true }); fs.writeFileSync(shownFile, JSON.stringify(shown)); } catch { /* convenience */ }
  return out;
}

/* ---------- main ---------- */

function folderOff(cwd) {
  for (let d = cwd && path.resolve(String(cwd)), i = 0; d && i < 40; i++) {
    if (fs.existsSync(path.join(d, '.maxagent-off'))) return true;
    const up = path.dirname(d);
    if (up === d) break;
    d = up;
  }
  return false;
}

/**
 * A shared (someone else's) atom was shown during this turn → once: if it helped, adopt it as own experience.
 * Not for Antigravity (its Stop has no answer format in our hook yet).
 */
function adoptCheck(input) {
  if (input.stop_hook_active || AGENT === 'antigravity') return null;
  const session = String(input.session_id || input.conversationId || 'default').replace(/[^\w.-]/g, '_');
  const file = path.join(ROOT, 'state', `shared-pending-${session}.json`);
  const p = readJson(file, null);
  if (!p || !p.id) return null;
  try { fs.writeFileSync(file, '{}'); } catch { /* state is a convenience */ }
  return { decision: 'block', reason: L.adoptAsk(p.head, p.id) };
}

/**
 * Antigravity: text of the owner's newest message, once per message. Transcript — `transcriptPath` from the input or
 * ~/.gemini/antigravity/brain/<conversationId>/.system_generated/logs/transcript.jsonl; a step
 * {"type":"USER_INPUT","content":"<USER_REQUEST>…</USER_REQUEST>"}. Already-handled step index is kept in state.
 */
function agUserTurn(input) {
  const id = String(input.conversationId || '');
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const file = input.transcriptPath || (id && path.join(home, '.gemini', 'antigravity', 'brain', id, '.system_generated', 'logs', 'transcript.jsonl'));
  let lines = [];
  try { lines = fs.readFileSync(file, 'utf8').split('\n'); } catch { return ''; }
  let last = null;
  for (const l of lines) {
    if (!l.includes('"USER_INPUT"')) continue;
    try { const o = JSON.parse(l); if (o.type === 'USER_INPUT') last = o; } catch { /* partial line */ }
  }
  if (!last) return '';
  const mark = path.join(ROOT, 'state', `ag-turn-${id.replace(/[^\w.-]/g, '_') || 'x'}.json`);
  if (readJson(mark, {}).step === last.step_index) return '';
  try { fs.mkdirSync(path.dirname(mark), { recursive: true }); fs.writeFileSync(mark, JSON.stringify({ step: last.step_index })); } catch { /* state is a convenience */ }
  return String(last.content || '').replace(/<\/?USER_REQUEST>/g, '').trim().slice(0, 4000);
}

function agTranscript(input) {
  const id = String(input.conversationId || '');
  const home = process.env.USERPROFILE || process.env.HOME || '';
  const file = input.transcriptPath || (id && path.join(home, '.gemini', 'antigravity', 'brain', id, '.system_generated', 'logs', 'transcript.jsonl'));
  try { return fs.readFileSync(file, 'utf8').split('\n'); } catch { return []; }
}

/** Antigravity: the final answer of this turn = the last PLANNER_RESPONSE with text and no tool calls after the last USER_INPUT. */
function agLastAnswer(input) {
  let user = null;
  let text = '';
  for (const l of agTranscript(input)) {
    if (!l.includes('"USER_INPUT"') && !l.includes('"PLANNER_RESPONSE"')) continue;
    let o;
    try { o = JSON.parse(l); } catch { continue; }
    if (o.type === 'USER_INPUT') { user = o.step_index; text = ''; }
    if (o.type === 'PLANNER_RESPONSE' && o.content && !(o.tool_calls || []).length) text = String(o.content);
  }
  return { user, text: text.trim() };
}

/**
 * Codex reads hook stdout that starts with `[` or `{` as JSON: "[опыт …" / "[maxagent] …" fails to parse and the
 * hook is marked Failed — the model gets nothing (live check 08.11.2026, codex-cli 0.130). Plain text must not
 * start with a bracket.
 */
function plainText(text) {
  if (!text || AGENT !== 'codex') return text;
  return /^\s*[[{]/.test(text) ? `maxagent:\n${text}` : text;
}

function run(raw) {
  const clean = String(raw || '').replace(/^﻿/, ''); // Windows PowerShell 5.1 pipes add a BOM
  const input = clean.trim() ? JSON.parse(clean) : {};
  // `.maxagent-off` in the session folder or above: maxagent stays silent there (clean tests, projects without hints).
  if (folderOff(input.cwd || (input.workspacePaths || [])[0])) return neutral();
  if (EVENT === 'prompt') {
    const prompt = String(input.prompt || '');
    // Meaning needs the query vector from the background model process (≤1.5 s); without it — words only.
    const vec = ENG && ENG.queryVector ? ENG.queryVector(prompt) : Promise.resolve(null);
    return vec.then((qvec) => plainText(hint(prompt, input.session_id || input.conversationId || 'default', qvec).join('\n') + '\n'));
  }
  if (EVENT === 'start') return plainText(sessionStart(input));
  if (EVENT === 'invocation') {
    // Antigravity: the event has no message text, but its transcript does (USER_INPUT steps). A new owner's message →
    // experience for it, like UserPromptSubmit elsewhere; core rules on the first call. The injected step is ephemeral:
    // the model sees it while planning this turn — that is where it matters (live check 08.11.2026).
    const user = agUserTurn(input);
    if (input.invocationNum !== 0 && !user) return '{}';
    const rules = input.invocationNum === 0 ? sessionStart({}) : '';
    const session = input.conversationId || 'antigravity';
    const vec = user && ENG && ENG.queryVector ? ENG.queryVector(user) : Promise.resolve(null);
    return vec.then((qvec) => {
      const lines = user ? hint(user, session, qvec) : [L.reminder];
      return JSON.stringify({ injectSteps: [{ ephemeralMessage: (rules ? rules + '\n' : '') + lines.join('\n') }] });
    });
  }
  if (EVENT === 'pretool') {
    const r = pretool(input);
    return r ? JSON.stringify(r) : '';
  }
  if (EVENT === 'stop' && AGENT === 'antigravity') {
    // Antigravity's Stop carries no answer text: it is read from the transcript. No stop_hook_active either —
    // our own guard: at most one "continue" per owner message. Answer {"decision":"continue"} = keep working.
    if (input.terminationReason && input.terminationReason !== 'NO_TOOL_CALL') return '{}';
    const turn = agLastAnswer(input);
    if (!turn.text) return '{}';
    const id = String(input.conversationId || 'x').replace(/[^\w.-]/g, '_');
    const mark = path.join(ROOT, 'state', `ag-stop-${id}.json`);
    if (readJson(mark, {}).user === turn.user) return '{}';
    const ag = { session_id: input.conversationId || 'default', cwd: (input.workspacePaths || [])[0], last_assistant_message: turn.text };
    const sync = [askCheck(ag), adoptCheck(ag)].filter(Boolean).map((r) => r.reason);
    const fmt = formatCheck(ag);
    return answerCheck(ag).then((ans) => {
      const reasons = [fmt, ans, ...sync].filter(Boolean);
      if (!reasons.length) return '{}';
      try { fs.mkdirSync(path.dirname(mark), { recursive: true }); fs.writeFileSync(mark, JSON.stringify({ user: turn.user })); } catch { /* state is a convenience */ }
      return JSON.stringify({ decision: 'continue', reason: reasons.join('\n\n') });
    });
  }
  if (EVENT === 'stop') {
    // Claude Code: "experience recorded?" (its transcript format is known), then "asking the owner for something experience covers?".
    // Codex: only the request check (it passes last_assistant_message).
    // All end-of-turn checks become ONE stop with all reasons (a second stop is never made: stop_hook_active).
    const sync = [AGENT === 'claude-code' ? stop(input) : null, AGENT === 'claude-code' ? doneCheck(input) : null, askCheck(input), adoptCheck(input)]
      .filter(Boolean).map((r) => r.reason);
    const fmt = formatCheck(input);
    return answerCheck(input).then((ans) => {
      const reasons = [fmt, ans, ...sync].filter(Boolean);
      return reasons.length ? JSON.stringify({ decision: 'block', reason: reasons.join('\n\n') }) : '';
    });
  }
  if (EVENT === 'posttool') {
    const r = posttool(input);
    return r ? JSON.stringify(r) : '';
  }
  return '';
}

function neutral() {
  if (EVENT === 'pretool' && AGENT === 'antigravity') return JSON.stringify({ decision: 'allow' });
  if (EVENT === 'invocation' || (EVENT === 'stop' && AGENT === 'antigravity')) return '{}';
  if (EVENT === 'prompt') return L.reminder + '\n';
  return '';
}

module.exports = { run, CATASTROPHIC };

if (require.main === module) {
  let buf = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (d) => { buf += d; });
  process.stdin.on('end', () => {
    Promise.resolve().then(() => run(buf)).catch(() => neutral()).then((out) => {
      if (out) process.stdout.write(out);
      process.exitCode = 0;
    });
  });
}
