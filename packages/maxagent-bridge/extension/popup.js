const RU = navigator.language.toLowerCase().startsWith("ru");
const T = RU ? {
  on: "Агенты могут подключаться", off: "Нет связи с maxagent-bridge", stop: "Стоп", resume: "Возобновить",
  agents: "Агенты", noAgents: "Пока никто не подключался.", remove: "Убрать",
  rights: { read: "чтение", act: "действия", confirm: "действия с подтверждением" },
  block: "Запретные сайты (по одному на строку, * — любые символы)", save: "Сохранить", log: "Журнал действий",
  install: "Выполните: npx maxagent-bridge install",
  scriptsH: "Скрипты на страницах",
  scripts: "Разрешить агентам выполнять свой код на страницах без вопроса — один раз для всех вызовов (выключено — спрашивать каждый раз).",
  scriptsWarn: "Режим включён: агент без вопроса видит и делает всё на открытых страницах. Не храните в этом браузере критические доступы — банк, платёжные карты, главная почта, пароли.",
} : {
  on: "Agents can connect", off: "No connection to maxagent-bridge", stop: "Stop", resume: "Resume",
  agents: "Agents", noAgents: "No agent has connected yet.", remove: "Remove",
  rights: { read: "read", act: "act", confirm: "act with confirmation" },
  block: "Blocked sites (one per line, * matches anything)", save: "Save", log: "Action log",
  install: "Run: npx maxagent-bridge install",
  scriptsH: "Page scripts",
  scripts: "Let agents run their own code in pages without asking — once for all calls (off — ask every time).",
  scriptsWarn: "This mode is on: an agent sees and does anything on open pages without asking. Do not keep critical access in this browser — bank, payment cards, main email, passwords.",
};
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function render() {
  const st = await chrome.runtime.sendMessage({ type: "status" });
  const data = await chrome.storage.local.get(["stopped", "agents", "blocklist", "log", "allowScripts"]);
  $("hScripts").textContent = T.scriptsH;
  $("scriptsText").textContent = T.scripts;
  $("scripts").checked = Boolean(data.allowScripts);
  $("scriptsWarn").textContent = data.allowScripts ? T.scriptsWarn : "";
  $("dot").className = "dot" + (st.host.connected ? " on" : "");
  $("host").textContent = st.host.connected ? T.on : `${T.off}${st.host.error ? ` (${st.host.error})` : ""}. ${T.install}`;
  $("stop").textContent = data.stopped ? T.resume : T.stop;
  $("stop").className = data.stopped ? "stopped" : "";
  $("hAgents").textContent = T.agents;
  const agents = data.agents || {};
  $("agents").innerHTML = Object.keys(agents).length ? "" : `<div class="muted">${T.noAgents}</div>`;
  for (const [name, a] of Object.entries(agents)) {
    const row = document.createElement("div");
    row.className = "agent";
    row.innerHTML = `<span><b>${esc(name)}</b> — ${esc(T.rights[a.rights] || a.rights)}${st.agents.includes(name) ? " ●" : ""}</span><button>${T.remove}</button>`;
    row.querySelector("button").onclick = async () => {
      delete agents[name];
      await chrome.storage.local.set({ agents });
      chrome.runtime.sendMessage({ type: "revoke", agent: name });
      render();
    };
    $("agents").appendChild(row);
  }
  $("hBlock").textContent = T.block;
  $("block").value = (data.blocklist || maxagentDefaultBlocklist).join("\n");
  $("saveBlock").textContent = T.save;
  $("hLog").textContent = T.log;
  $("log").innerHTML = (data.log || []).slice(0, 100).map((e) =>
    `<div class="${e.ok ? "" : "bad"}">${esc(e.at.slice(11, 19))} ${esc(e.agent)} ${esc(e.tool)}${e.site || e.to ? " " + esc(e.site || e.to) : ""}${e.error ? " — " + esc(e.error) : ""}${e.note ? " — " + esc(e.note) : ""}</div>`).join("");
}

$("stop").onclick = async () => {
  const { stopped } = await chrome.storage.local.get("stopped");
  await chrome.storage.local.set({ stopped: !stopped });
  render();
};
$("scripts").onchange = async () => {
  await chrome.storage.local.set({ allowScripts: $("scripts").checked });
  render();
};
$("saveBlock").onclick = async () => {
  const list = $("block").value.split("\n").map((s) => s.trim()).filter(Boolean);
  await chrome.storage.local.set({ blocklist: list });
  render();
};

const s = document.createElement("script");
s.src = "policy.js";
s.onload = () => { globalThis.maxagentDefaultBlocklist = globalThis.maxagentPolicy.DEFAULT_BLOCKLIST; render(); };
document.head.appendChild(s);
