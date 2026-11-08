const RU = navigator.language.toLowerCase().startsWith("ru");
const T = RU ? {
  pairTitle: "Агент просит доступ к браузеру",
  pairText: (a) => `<span class="who">${a}</span> хочет работать в этом браузере: видеть вкладки и страницы${""}, а при разрешении — нажимать и вводить текст. Входы в аккаунты остаются вашими.`,
  read: "Только чтение (вкладки, страницы, скриншоты)",
  act: "Чтение и действия (нажатия, ввод, переходы)",
  confirm: "Действия — с моим подтверждением каждого",
  warn: "Разрешайте только агентам, которые вы сами запустили. Если вы не ждали этого окна — нажмите «Запретить».",
  actionTitle: "Подтвердите действие агента",
  actionText: (r) => `<span class="who">${r.agent}</span>: ${r.tool}${r.site ? ` на ${r.site}` : ""}`,
  allow: "Разрешить", deny: "Запретить",
} : {
  pairTitle: "An agent asks for browser access",
  pairText: (a) => `<span class="who">${a}</span> wants to work in this browser: see tabs and pages and, if you allow, click and type. Your sign-ins stay yours.`,
  read: "Read only (tabs, pages, screenshots)",
  act: "Read and act (clicks, typing, navigation)",
  confirm: "Act — but confirm every action with me",
  warn: "Only allow agents you started yourself. If you did not expect this window, press Deny.",
  actionTitle: "Confirm the agent's action",
  actionText: (r) => `<span class="who">${r.agent}</span>: ${r.tool}${r.site ? ` on ${r.site}` : ""}`,
  allow: "Allow", deny: "Deny",
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const id = new URLSearchParams(location.search).get("id");

(async () => {
  const req = (await chrome.storage.local.get(`req:${id}`))[`req:${id}`];
  if (!req) { window.close(); return; }
  const title = document.getElementById("title");
  const body = document.getElementById("body");
  document.getElementById("allow").textContent = T.allow;
  document.getElementById("deny").textContent = T.deny;
  if (req.kind === "pair") {
    title.textContent = T.pairTitle;
    body.innerHTML = `<p>${T.pairText(esc(req.agent))}</p>
      <label><input type="radio" name="r" value="read" checked> ${T.read}</label>
      <label><input type="radio" name="r" value="act"> ${T.act}</label>
      <label><input type="radio" name="r" value="confirm"> ${T.confirm}</label>
      <p class="warn">${T.warn}</p>`;
  } else {
    title.textContent = T.actionTitle;
    body.innerHTML = `<p>${T.actionText({ agent: esc(req.agent), tool: esc(req.tool), site: esc(req.site || "") })}</p>
      ${req.detail ? `<div class="detail">${esc(req.detail)}</div>` : ""}<p class="warn">${T.warn}</p>`;
  }
  const answer = (allow) => {
    const rights = req.kind === "pair" ? document.querySelector('input[name="r"]:checked').value : undefined;
    chrome.runtime.sendMessage({ type: "decision", id, answer: { allow, rights } });
  };
  document.getElementById("allow").onclick = () => answer(true);
  document.getElementById("deny").onclick = () => answer(false);
})();
