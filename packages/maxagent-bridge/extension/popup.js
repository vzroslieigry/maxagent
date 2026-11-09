const RU = navigator.language.toLowerCase().startsWith("ru");
const T = RU ? {
  on: "Агенты могут подключаться", off: "Нет связи с maxagent-bridge", stop: "Стоп", resume: "Возобновить",
  agents: "Агенты", noAgents: "Пока никто не подключался.", remove: "Убрать", grants: "Загрузка файлов разрешена",
  rights: { read: "чтение", act: "действия", confirm: "действия с подтверждением" },
  block: "Запретные сайты (по одному на строку, * — любые символы)", save: "Сохранить", log: "Журнал действий",
  install: "Выполните: npx maxagent-bridge install",
} : {
  on: "Agents can connect", off: "No connection to maxagent-bridge", stop: "Stop", resume: "Resume",
  agents: "Agents", noAgents: "No agent has connected yet.", remove: "Remove", grants: "File upload allowed",
  rights: { read: "read", act: "act", confirm: "act with confirmation" },
  block: "Blocked sites (one per line, * matches anything)", save: "Save", log: "Action log",
  install: "Run: npx maxagent-bridge install",
};
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

async function render() {
  const st = await chrome.runtime.sendMessage({ type: "status" });
  const data = await chrome.storage.local.get(["stopped", "agents", "blocklist", "log", "uploadGrants"]);
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
      const left = Object.fromEntries(Object.entries(data.uploadGrants || {}).filter(([k]) => k.split("\n")[0] !== name));
      await chrome.storage.local.set({ agents, uploadGrants: left });
      chrome.runtime.sendMessage({ type: "revoke", agent: name });
      render();
    };
    $("agents").appendChild(row);
  }
  const grants = data.uploadGrants || {};
  $("hGrants").textContent = T.grants;
  $("hGrants").hidden = !Object.keys(grants).length;
  $("grants").innerHTML = "";
  for (const key of Object.keys(grants)) {
    const [agent, site] = key.split("\n");
    const row = document.createElement("div");
    row.className = "agent";
    row.innerHTML = `<span><b>${esc(agent)}</b> — ${esc(site)}</span><button>${T.remove}</button>`;
    row.querySelector("button").onclick = async () => {
      delete grants[key];
      await chrome.storage.local.set({ uploadGrants: grants });
      render();
    };
    $("grants").appendChild(row);
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
$("saveBlock").onclick = async () => {
  const list = $("block").value.split("\n").map((s) => s.trim()).filter(Boolean);
  await chrome.storage.local.set({ blocklist: list });
  render();
};

const s = document.createElement("script");
s.src = "policy.js";
s.onload = () => { globalThis.maxagentDefaultBlocklist = globalThis.maxagentPolicy.DEFAULT_BLOCKLIST; render(); };
document.head.appendChild(s);
