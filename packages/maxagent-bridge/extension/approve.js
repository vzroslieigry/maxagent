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
  once: "Разрешить", page: "Разрешить для этой страницы", site: (h) => `Разрешить для сайта ${h}`,
  scriptsWarn: "Агент выполнит свой код на странице: он видит и делает всё на ней. «Для страницы» — без вопросов на этой странице до закрытия браузера, «для сайта» — всегда на этом сайте (убрать — в окне расширения). Где разрешаете без вопроса — не храните в этом браузере критические доступы: банк, платёжные карты, главная почта, пароли.",
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
  once: "Allow", page: "Allow for this page", site: (h) => `Allow for site ${h}`,
  scriptsWarn: "The agent will run its own code in the page: it sees and does anything there. \"For this page\" — no questions on this page until the browser closes, \"for site\" — always on this site (remove in the extension popup). Where you allow without asking, do not keep critical access in this browser: bank, payment cards, main email, passwords.",
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
      ${req.detail ? `<div class="detail">${esc(req.detail)}</div>` : ""}<p class="warn">${req.tool === "evaluate" ? T.scriptsWarn : T.warn}</p>`;
    // Page scripts come in long series (a voice-over polls every few seconds): three ways to allow, one to deny.
    if (req.tool === "evaluate") {
      document.getElementById("allow").textContent = T.once;
      let last = document.getElementById("allow");
      for (const [scope, label] of [["page", T.page], ["site", req.site ? T.site(req.site) : ""]]) {
        if (!label) continue;
        const b = document.createElement("button");
        b.textContent = label;
        b.onclick = () => chrome.runtime.sendMessage({ type: "decision", id, answer: { allow: true, scope } });
        last.after(b); last = b;
      }
    }
  }
  const answer = (allow) => {
    const rights = req.kind === "pair" ? document.querySelector('input[name="r"]:checked').value : undefined;
    chrome.runtime.sendMessage({ type: "decision", id, answer: { allow, rights } });
  };
  document.getElementById("allow").onclick = () => answer(true);
  document.getElementById("deny").onclick = () => answer(false);
})();
