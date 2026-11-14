'use strict';
// Full cycle in a throwaway home folder: init → doctor → init again → update → uninstall → doctor.
// Never touches the real home: every call passes --home <temp>.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const BIN = path.resolve(__dirname, '..', 'bin', 'maxagent.js');
process.env.MAXAGENT_SKIP_PROBE = '1'; // the environment card is checked once, below, not on every init
let failed = 0;
const check = (cond, name) => {
  console.log(`${cond ? 'OK   ' : 'FAIL '} ${name}`);
  if (!cond) failed++;
};
const run = (...args) => spawnSync(process.execPath, [BIN, ...args], { encoding: 'utf8' });
const read = (f) => fs.readFileSync(f, 'utf8');
const count = (s, sub) => s.split(sub).length - 1;

for (const lang of ['ru', 'en']) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), `maxagent-test-${lang}-`));
  console.log(`\n== ${lang}: ${home}`);

  // Fake agents. Codex already has the owner's own rules; OpenClaw has two agent workspaces.
  fs.mkdirSync(path.join(home, '.claude'));
  fs.mkdirSync(path.join(home, '.codex'));
  const codexOwn = 'My own Codex rules.\r\nKeep answers short.\r\n';
  fs.writeFileSync(path.join(home, '.codex', 'AGENTS.md'), codexOwn);
  fs.mkdirSync(path.join(home, '.gemini'));
  const oc1 = path.join(home, 'openclaw');
  const oc2 = path.join(home, 'openclaw', 'agents', 'helper');
  fs.mkdirSync(oc2, { recursive: true });
  const ocOwn = '# Helper agent\n\nBe nice.\n';
  fs.writeFileSync(path.join(oc2, 'AGENTS.md'), ocOwn);
  fs.mkdirSync(path.join(home, '.openclaw'));
  fs.writeFileSync(path.join(home, '.openclaw', 'openclaw.json'), JSON.stringify({
    agents: { defaults: { workspace: oc1 }, entries: { main: { workspace: oc1 }, helper: { workspace: oc2 } } },
  }));

  const ws = path.join(home, 'maxagent');
  const rulesFiles = [
    path.join(home, '.claude', 'CLAUDE.md'),
    path.join(home, '.codex', 'AGENTS.md'),
    path.join(home, '.gemini', 'AGENTS.md'),
    path.join(oc1, 'AGENTS.md'),
    path.join(oc2, 'AGENTS.md'),
  ];

  // Dry run writes nothing.
  {
    const agentHome = fs.mkdtempSync(path.join(os.tmpdir(), 'maxagent-agent-'));
    const g = spawnSync(process.execPath, [BIN, 'init', '--home', agentHome], { encoding: 'utf8', input: '' });
    check(g.status === 2 && /Ask the owner/.test(g.stdout) && /--extras/.test(g.stdout) && !fs.existsSync(path.join(agentHome, '.maxagent', 'config.json')), 'init without a terminal: nothing installed, the questions go to the agent', g.stdout);
  }
  let r = run('init', '--yes', '--lang', lang, '--home', home, '--dry-run');
  check(r.status === 0, 'dry-run exit 0');
  check(!fs.existsSync(ws) && !fs.existsSync(path.join(home, '.maxagent')), 'dry-run wrote nothing');
  check(read(path.join(home, '.codex', 'AGENTS.md')) === codexOwn, 'dry-run left Codex rules intact');

  r = run('init', '--yes', '--lang', lang, '--home', home);
  check(r.status === 0, 'init exit 0');
  for (const f of ['AGENTS.md', 'experience.md', 'projects.md', 'sync.md', '.gitignore', 'experience/maxagent.md', 'projects/_example/README.md', 'projects/_example/tasks/_TEMPLATE.md']) {
    check(fs.existsSync(path.join(ws, f)), `workspace: ${f}`);
  }
  const allNew = [path.join(home, '.maxagent', 'core', lang, 'AGENTS.core.md'), path.join(home, '.maxagent', 'core', lang, 'injection-baza.md'), path.join(ws, 'AGENTS.md'), path.join(ws, 'experience.md'), path.join(ws, 'experience', 'maxagent.md')];
  check(allNew.every((f) => !/\{\{[A-Z_]+\}\}/.test(read(f))), 'no unfilled {{PLACEHOLDERS}}');
  check(read(path.join(ws, 'AGENTS.md')).includes(path.join(home, '.maxagent', 'core', lang)), 'workspace AGENTS.md points to installed core');
  for (const f of rulesFiles) check(count(read(f), '<!-- maxagent:start') === 1, `one block: ${path.relative(home, f)}`);
  check(read(path.join(home, '.codex', 'AGENTS.md')).startsWith(codexOwn), 'Codex own rules kept at top');
  check(read(path.join(home, '.codex', 'AGENTS.md')).includes('\r\n<!-- maxagent:end -->') || read(path.join(home, '.codex', 'AGENTS.md')).includes('-->\r\n'), 'Codex CRLF line endings kept');
  check(read(path.join(home, '.codex', 'AGENTS.md.maxagent-backup')) === codexOwn, 'Codex backup made');

  r = run('doctor', '--home', home);
  check(r.status === 0, 'doctor exit 0 after init');

  // Experience library: six kinds, template, index built from headers.
  check(['platform', 'tools', 'code', 'agents', 'craft', 'owner'].every((k) => fs.existsSync(path.join(ws, 'experience', k, 'README.md'))) && fs.existsSync(path.join(ws, 'experience', '_template.md')), 'experience: 6 kinds + template');
  check(fs.existsSync(path.join(home, '.maxagent', 'tools', 'experience-index.js')), 'index builder installed offline');
  check(/\[maxagent\]\(experience\/maxagent\.md\)/.test(read(path.join(ws, 'experience.md'))) && !/README|_template/.test(read(path.join(ws, 'experience.md')).split('index:auto:start')[1]), 'index: maxagent row, no README/_template rows');
  // Starter experience from the template: rendered atoms pass lint, every file has an index row.
  r = spawnSync(process.execPath, [path.join(home, '.maxagent', 'tools', 'experience-engine.js'), 'lint', '--all', '--root', path.join(ws, 'experience')], { encoding: 'utf8' });
  check(r.status === 0 && fs.existsSync(path.join(ws, 'experience', '_spec.md')), 'starter experience: spec in place, atoms pass lint', r.stdout);
  check(['tools/git', 'tools/browser', 'platform/trash', 'agents/injections', 'agents/shared-experience'].every((n) => read(path.join(ws, 'experience.md')).includes(`[${n}](experience/${n}.md)`)), 'starter experience: rows in the index');
  fs.writeFileSync(path.join(ws, 'experience', 'tools', 'git.md'), '---\ntitle: Git\ntask: commit only own files\naliases: git, commit, rebase\nverified: test\n---\n# Git\n');
  r = run('index', '--check', '--home', home);
  check(r.status === 1, 'index --check: stale after a new entry');
  r = run('index', '--home', home);
  check(r.status === 0 && /\[tools\/git\]\(experience\/tools\/git\.md\)/.test(read(path.join(ws, 'experience.md'))), 'index: new entry from its header', r.stdout);
  fs.writeFileSync(path.join(ws, 'experience', 'tools', 'bad.md'), '# no header\n');
  r = run('index', '--home', home);
  check(r.status === 1 && /ERROR/.test(r.stdout) && /bad\.md/.test(r.stdout), 'index: entry without a header → ERROR', r.stdout);
  fs.unlinkSync(path.join(ws, 'experience', 'tools', 'bad.md')); // test file created above
  run('index', '--home', home);

  // Inbox and agent tools.
  check(fs.existsSync(path.join(ws, 'inbox', 'README.md')) && !/\{\{/.test(read(path.join(ws, 'inbox', 'README.md'))), 'inbox: README in place, placeholders filled');
  check(['experience-index.js', 'env-probe.js', 'save-clip.ps1'].every((f) => fs.existsSync(path.join(home, '.maxagent', 'tools', f))), 'tools: index, env-probe, save-clip installed');

  // Core rules: built from settings, owner's text around the block kept.
  const wsAgents = path.join(ws, 'AGENTS.md');
  const ruleCount = (read(wsAgents).split(/maxagent:rules:start[^\n]*\n/)[1] || '').split('<!-- maxagent:rules:end')[0].split('\n').filter((l) => /^\d+\. /.test(l)).length;
  check(ruleCount >= 8 && ruleCount <= 12, `core rules: ${ruleCount} items`);
  // Personal words of the author's own workspace, kept out of the source itself (public repository check).
  const personal = new RegExp(['Отче', 'J' + 'eka'].join('|'), 'i');
  check(!personal.test(read(wsAgents)), 'core rules: nothing personal');
  fs.appendFileSync(wsAgents, '- Owner own always-rule.\n');
  const cfgPath = path.join(home, '.maxagent', 'config.json');
  const cfgNow = JSON.parse(read(cfgPath));
  fs.writeFileSync(cfgPath, JSON.stringify({ ...cfgNow, desktop: 2, repo: 'https://example.com/r.git' }));
  r = run('doctor', '--home', home);
  check(/WARN.*(главные правила не совпадают|core rules do not match)/.test(r.stdout), 'doctor: rules out of date with settings → WARN', r.stdout);
  r = run('update', '--home', home);
  const after = read(wsAgents);
  check(/(рабочем столе|desktop) 2/.test(after) && after.includes('https://example.com/r.git') && after.includes('- Owner own always-rule.'), 'update: rules follow settings, owner text kept');
  fs.writeFileSync(cfgPath, JSON.stringify({ ...JSON.parse(read(cfgPath)), desktop: null, repo: '' }));
  run('update', '--home', home);

  // Owner writes experience; second init must not overwrite it nor duplicate blocks.
  const expFile = path.join(ws, 'experience.md');
  fs.appendFileSync(expFile, '| my | own | entry | kept |\n');
  r = run('init', '--yes', '--lang', lang, '--home', home);
  check(r.status === 0, 'second init exit 0');
  check(read(expFile).includes('| my | own | entry | kept |'), 'second init kept owner experience');
  for (const f of rulesFiles) check(count(read(f), '<!-- maxagent:start') === 1, `still one block: ${path.relative(home, f)}`);

  // Workspace moved → update rewrites blocks to the new place.
  const cfgFile = path.join(home, '.maxagent', 'config.json');
  r = run('update', '--home', home);
  check(r.status === 0, 'update exit 0');
  check(read(expFile).includes('| my | own | entry | kept |'), 'update kept owner experience');

  // Broken block → doctor must fail with ERROR.
  const claude = rulesFiles[0];
  const saved = read(claude);
  fs.writeFileSync(claude, 'nothing here\n');
  r = run('doctor', '--home', home);
  check(r.status === 1 && /ERROR/.test(r.stdout), 'doctor fails when a block is missing');
  fs.writeFileSync(claude, saved);

  r = run('uninstall', '--home', home);
  check(r.status === 0, 'uninstall exit 0');
  for (const f of rulesFiles) check(!read(f).includes('maxagent:start'), `block removed: ${path.relative(home, f)}`);
  check(read(path.join(home, '.codex', 'AGENTS.md')) === codexOwn, 'Codex rules restored byte-for-byte');
  check(read(path.join(oc2, 'AGENTS.md')) === ocOwn, 'OpenClaw helper rules restored byte-for-byte');
  check(fs.existsSync(expFile) && read(expFile).includes('| my | own | entry | kept |'), 'workspace kept after uninstall');
  check(JSON.parse(read(cfgFile)).agents.length === 0, 'config: no agents after uninstall');

  fs.rmSync(home, { recursive: true, force: true }); // throwaway test folder created above
}

// Settings: init with answers piped in (as an agent runs it for the owner), then setup changes them.
{
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'maxagent-setup-'));
  fs.mkdirSync(path.join(home, '.claude'));
  const ws = path.join(home, 'mx');
  // --no-extras: the extras question must not install the bridge or the vectors (they live outside the temp home / take minutes).
  const answer = (args, lines) => spawnSync(process.execPath, [BIN, ...args, '--home', home, '--no-extras'], { encoding: 'utf8', input: lines.join('\n') + '\n', env: { ...process.env, MAXAGENT_PIPED: '1' } });
  const cfgOf = () => JSON.parse(read(path.join(home, '.maxagent', 'config.json')));
  const block = (re) => (read(path.join(ws, 'AGENTS.md')).match(re) || [''])[0];
  const RULES = /<!-- maxagent:rules:start[\s\S]*?maxagent:rules:end -->/;
  const SETTINGS = /<!-- maxagent:settings:start -->[\s\S]*?maxagent:settings:end -->/;
  // lang, workspace, agents, repo, bridge, desktop, answer format, trash
  let r = answer(['init'], ['ru', ws, '', '', 'y', '2', 'n', '']);
  let c = cfgOf();
  check(r.status === 0 && c.bridge === true && c.desktop === 2 && c.answerFormat === false && c.trash === true && c.codeword === undefined && !/одов/.test(r.stdout), 'init: answers piped in → settings saved', JSON.stringify(c) + r.stdout.slice(-300));
  check(/рабочем столе 2/.test(block(RULES)) && /maxagent-bridge/.test(block(RULES)) && !/глянуть/.test(block(RULES)) && !/Отвечаю хозяину/.test(block(RULES)) && /Корзину/.test(block(RULES)), 'init: core rules follow the answers');
  check(/рабочий стол 2/.test(block(SETTINGS)) && /Браузерный мост: включено/.test(block(SETTINGS)), 'init: "Settings" section filled', block(SETTINGS));
  check(/npx maxagent-bridge install/.test(r.stdout), 'init: bridge chosen but not installed → install hint');
  const order = ['Адрес закрытого репозитория', 'Браузерный мост', 'Отдельный рабочий стол', 'Ответы агента', 'Удалять только в Корзину'].map((q) => r.stdout.indexOf(q));
  check(order.every((p, i) => p > 0 && (i === 0 || p > order[i - 1])), 'init: questions in the agreed order', order.join(','));

  // setup: repo (- = off), bridge, desktop (0 = none), format, trash
  r = answer(['setup'], ['-', 'n', '0', 'y', 'n']);
  c = cfgOf();
  check(r.status === 0 && c.bridge === false && c.desktop === null && c.answerFormat === true && c.trash === false, 'setup: settings changed', JSON.stringify(c));
  check(!/maxagent-bridge/.test(block(RULES)) && !/глянуть/.test(block(RULES)) && !/Отвечаю хозяину/.test(block(RULES)) && !/Корзину/.test(block(RULES)) && /без окон/.test(block(RULES)), 'setup: core rules rebuilt (no language/format item even with answerFormat on)');
  check(/Браузерный мост: выключен/.test(block(SETTINGS)) && /Корзину: выключено/.test(block(SETTINGS)), 'setup: "Settings" section rebuilt', block(SETTINGS));
  const before = read(path.join(ws, 'AGENTS.md'));
  r = spawnSync(process.execPath, [BIN, 'setup', '--yes', '--home', home], { encoding: 'utf8' });
  check(r.status === 0 && read(path.join(ws, 'AGENTS.md')) === before && cfgOf().trash === false, 'setup --yes: nothing changes');
  r = spawnSync(process.execPath, [BIN, 'setup', '--yes', '--desktop', '3', '--bridge', '--home', home], { encoding: 'utf8' });
  check(cfgOf().desktop === 3 && cfgOf().bridge === true, 'setup flags: --desktop 3 --bridge');

  // update from an older version prints what's new.
  fs.writeFileSync(path.join(home, '.maxagent', 'config.json'), JSON.stringify({ ...cfgOf(), version: '0.2.0' }));
  r = spawnSync(process.execPath, [BIN, 'update', '--home', home], { encoding: 'utf8' });
  check(/Новое в 0\.4\.0/.test(r.stdout) && /Новое в 0\.3\.0/.test(r.stdout) && !/Новое в 0\.2\.0/.test(r.stdout) && /npx maxagent setup/.test(r.stdout), 'update 0.2.0 → 0.4.0: only what is new printed', r.stdout.slice(-400));
  fs.rmSync(home, { recursive: true, force: true }); // throwaway folder created above
}

// Environment card on this very machine (once): summary line, markers kept, hand-written notes around kept.
{
  const ws = fs.mkdtempSync(path.join(os.tmpdir(), 'maxagent-env-'));
  const card = path.join(ws, 'experience', 'platform', 'environment.md');
  fs.mkdirSync(path.dirname(card), { recursive: true });
  fs.writeFileSync(card, '# Env\n\n<!-- env:auto:start -->\nold\n<!-- env:auto:end -->\n\n## Pitfalls\n- my own note\n');
  const r = spawnSync(process.execPath, [path.resolve(__dirname, '..', 'tools', 'env-probe.js'), ws, '--lang', 'en'], { encoding: 'utf8' });
  const text = read(card);
  check(r.status === 0 && /^- \*\*Summary:\*\* .+Node v\d+/m.test(text) && !/\nold\n/.test(text) && text.includes('- my own note'), 'env-probe: summary written, block replaced, own notes kept', r.stdout + text.slice(0, 300));
  fs.rmSync(ws, { recursive: true, force: true }); // throwaway folder created above
}

/* ---------- self-update decisions (tools/update-check.js) ---------- */
{
  const U = require('../tools/update-check.js');
  const cfg = { version: '0.5.0', autoUpdate: true };
  check(U.plan(cfg, { maxagent: '0.5.12', bridge: '0.5.12' }).action === 'install', 'self-update: newer patch, same number for both → installs itself');
  check(U.plan(cfg, { maxagent: '0.6.0', bridge: '0.6.0' }).action === 'install', 'self-update: newer minor → installs itself');
  check(U.plan(cfg, { maxagent: '1.0.0', bridge: '1.0.0' }).action === 'ask', 'self-update: a new major version waits for the owner');
  check(U.plan(cfg, { maxagent: '0.5.12', bridge: '0.5.0' }).action === 'none', 'self-update: agent and bridge numbers differ → wait for both');
  check(U.plan({ ...cfg, autoUpdate: false }, { maxagent: '0.5.12', bridge: '0.5.12' }).action === 'ask', 'self-update off → only tells');
  check(U.plan(cfg, { maxagent: '0.5.0', bridge: '0.5.0' }).action === 'none', 'self-update: same version → nothing');
  const att = (repo) => ({ attestations: [{ predicateType: 'https://slsa.dev/provenance/v1', bundle: { dsseEnvelope: { payload: Buffer.from(JSON.stringify({ predicate: { buildDefinition: { externalParameters: { workflow: { repository: repo } } } } })).toString('base64') } } }] });
  check(U.provenanceRepo(att('https://github.com/vzroslieigry/maxagent')) === 'https://github.com/vzroslieigry/maxagent', 'provenance: our repository read from the attestation');
  check(U.provenanceRepo(att('https://github.com/someone/fork')) !== 'https://github.com/vzroslieigry/maxagent' && U.provenanceRepo({ attestations: [] }) === null, 'provenance: a fork or no attestation is not ours');
}

/* ---------- migration of AGENTS.md installed by 0.5.12 (the "read the package rules at the start" line), added template files ---------- */
{
  // The 0.5.12 template of AGENTS.md (commit bd95cbc) with {{CORE}}, the rules and the settings still to fill in.
  // The installer expands {{CORE}} to path.join(home, '.maxagent', 'core', lang), so the path has mixed slashes: ...\core\ru/AGENTS.core.md
  const OLD_TPL = {
  ru: [
    "# Правила рабочей папки",
    "",
    "Этот файл принадлежит вам: пакет его не перезаписывает — кроме блока «Главные правила» между метками, который собирается из ваших настроек. Агент читает файл в начале каждой задачи вместе с регламентом пакета; главные правила и раздел «Мои правила» хук показывает ему в начале сессии и после сжатия памяти.",
    "",
    "## Главные правила — всегда перед глазами",
    "",
    "<!-- maxagent:rules:start -->",
    "<!-- maxagent:rules:end -->",
    "",
    "## Регламент пакета",
    "",
    "Перед любой задачей прочитай `{{CORE}}/AGENTS.core.md` и выполни раздел «Старт любой задачи».",
    "",
    "## Настройки (поменять — `npx maxagent setup`)",
    "",
    "<!-- maxagent:settings:start -->",
    "{{SETTINGS}}",
    "<!-- maxagent:settings:end -->",
    "",
    "## Мои правила",
    "",
    "<!-- Здесь — ваши личные правила для агентов, в том числе свои пункты «всегда»: хук показывает этот раздел вместе с главными правилами. Если они противоречат регламенту пакета, действуют ваши.",
    "Пример:",
    "- Отвечай коротко.",
    "- Перед покупкой всегда показывай сумму и жди подтверждения.",
    "-->",
  ].join('\n') + '\n',
  en: [
    "# Workspace rules",
    "",
    "This file is yours: the package never overwrites it — except the \"Core rules\" block between the markers, which is built from your settings. The agent reads this file at the start of every task together with the package rules; the hook shows it the core rules and the \"My rules\" section at session start and after the context is compacted.",
    "",
    "## Core rules — always in view",
    "",
    "<!-- maxagent:rules:start -->",
    "<!-- maxagent:rules:end -->",
    "",
    "## Package rules",
    "",
    "Before any task, read `{{CORE}}/AGENTS.core.md` and follow the \"Start of every task\" section.",
    "",
    "## Settings (change with `npx maxagent setup`)",
    "",
    "<!-- maxagent:settings:start -->",
    "{{SETTINGS}}",
    "<!-- maxagent:settings:end -->",
    "",
    "## My rules",
    "",
    "<!-- Your personal rules for agents go here, including your own \"always\" items: the hook shows this section together with the core rules. If they conflict with the package rules, yours win.",
    "Example:",
    "- Keep answers short.",
    "- Before any purchase, always show the total and wait for confirmation.",
    "-->",
  ].join('\n') + '\n',
  };
  const T = {
    ru: { head: '## Справка о пакете', intro: 'Здесь — только критически важное для любого агента', oldIntro: 'вместе с регламентом пакета', oldStart: 'Старт любой задачи', mine: '## Мои правила', always: ['Перед любой задачей прочитай', 'Перед любой задачей всегда прочитай'], manual: /уберите её сами/ },
    en: { head: '## Package reference', intro: 'Only what is critical for any agent lives here', oldIntro: 'together with the package rules', oldStart: 'Start of every task', mine: '## My rules', always: ['Before any task, read', 'Before any task, always read'], manual: /remove it yourself/ },
  };
  const ownRules = '- My own always-rule, kept.\n- Second own line.\n';

  /** A home as 0.5.12 left it: old AGENTS.md (own lines in "My rules"), no platform/trash.md (the owner deleted it), no agents/projects.md, config version 0.5.12. */
  const oldInstall = (lang, eol) => {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), `maxagent-migrate-${lang}-`));
    fs.mkdirSync(path.join(home, '.claude'));
    run('init', '--yes', '--lang', lang, '--home', home);
    const ws = path.join(home, 'maxagent');
    const file = path.join(ws, 'AGENTS.md');
    const cur = read(file);
    const rulesBlock = cur.match(/<!-- maxagent:rules:start[\s\S]*?maxagent:rules:end -->/)[0];
    const settingsBlock = cur.match(/<!-- maxagent:settings:start -->[\s\S]*?maxagent:settings:end -->/)[0];
    const old = (OLD_TPL[lang]
      .replace('{{CORE}}', () => path.join(home, '.maxagent', 'core', lang))
      .replace('<!-- maxagent:rules:start -->\n<!-- maxagent:rules:end -->', () => rulesBlock)
      .replace('<!-- maxagent:settings:start -->\n{{SETTINGS}}\n<!-- maxagent:settings:end -->', () => settingsBlock)) + ownRules;
    fs.writeFileSync(file, old.replace(/\r?\n/g, eol));
    fs.rmSync(path.join(ws, 'experience', 'platform', 'trash.md'), { force: true }); // throwaway test file: the "owner deleted" atom
    fs.rmSync(path.join(ws, 'experience', 'agents', 'projects.md'), { force: true }); // throwaway test file: 0.5.12 had none
    const cfgFile = path.join(home, '.maxagent', 'config.json');
    fs.writeFileSync(cfgFile, JSON.stringify({ ...JSON.parse(read(cfgFile)), version: '0.5.12' }, null, 2) + '\n');
    return { home, ws, file };
  };
  const mineOf = (text, lang) => text.slice(text.indexOf(T[lang].mine));
  const warnLines = (out) => out.split('\n').filter((l) => /WARN/.test(l));

  for (const [lang, eol] of [['ru', '\n'], ['en', '\r\n']]) {
    const tr = T[lang];
    const label = `${lang} ${eol === '\r\n' ? 'CRLF' : 'LF'}`;
    console.log(`\n== migration ${label}`);
    const o = oldInstall(lang, eol);
    const beforeBuf = fs.readFileSync(o.file);
    const before = beforeBuf.toString('utf8');
    const corePath = before.match(/`([^`\r\n]*AGENTS\.core\.md)`/)[1];
    check(before.includes(tr.oldStart) && before.includes(tr.oldIntro) && /[\\/]core[\\/][a-z]+\/AGENTS\.core\.md$/.test(corePath), `${label}: test setup is the old 0.5.12 file (mixed slashes in the path)`, corePath);
    let r = run('doctor', '--home', o.home);
    check(warnLines(r.stdout).some((l) => /AGENTS\.md/.test(l) && /(регламент|rules)/.test(l)), `${label}: doctor on the old file warns about the start line (dCoreStart)`, r.stdout);

    // a) update replaces the "read the rules at the start" line with the reference
    r = run('update', '--home', o.home);
    const after = read(o.file);
    check(r.status === 0, `${label}: update exit 0`, r.stdout);
    check(after.includes(tr.head) && after.includes(`\`${corePath}\``) && !after.includes(tr.oldStart) && !after.includes(tr.oldIntro) && after.includes(tr.intro), `${label}: update: reference instead of "start of every task", same core path, new intro`, after.slice(0, 900));
    // b) the copy next to it is the old file, byte for byte
    const backup = o.file + '.maxagent-backup';
    check(fs.existsSync(backup) && fs.readFileSync(backup).equals(beforeBuf), `${label}: AGENTS.md.maxagent-backup equals the old file byte for byte`);
    // c) "My rules" untouched, line endings kept
    check(mineOf(after, lang) === mineOf(before, lang) && mineOf(after, lang).endsWith(ownRules.replace(/\n/g, eol)), `${label}: "My rules" byte for byte`);
    check(eol === '\n' ? !/\r/.test(after) : !/(^|[^\r])\n/.test(after), `${label}: line endings kept (${eol === '\n' ? 'LF' : 'CRLF'})`);
    // d) the atom the owner deleted stays deleted, the atom new in this version appears
    check(!fs.existsSync(path.join(o.ws, 'experience', 'platform', 'trash.md')), `${label}: platform/trash.md did not come back`);
    check(fs.existsSync(path.join(o.ws, 'experience', 'agents', 'projects.md')), `${label}: agents/projects.md appeared (new in 0.6.0)`);
    // e) a second update changes nothing
    const mtime = (f) => (fs.existsSync(f) ? fs.statSync(f).mtimeMs : -1);
    const backupTime = mtime(backup);
    r = run('update', '--home', o.home);
    check(fs.readFileSync(o.file).equals(Buffer.from(after)) && mtime(backup) === backupTime && fs.readFileSync(backup).equals(beforeBuf), `${label}: second update: AGENTS.md and the copy unchanged`);
    check(!fs.existsSync(path.join(o.ws, 'experience', 'platform', 'trash.md')), `${label}: second update: trash.md still absent`);
    r = run('doctor', '--home', o.home);
    check(r.status === 0 && !warnLines(r.stdout).some((l) => /AGENTS\.md/.test(l)), `${label}: doctor after the migration: no warning about the start line`, r.stdout);
    fs.rmSync(o.home, { recursive: true, force: true }); // throwaway home created above
  }

  // f) the line changed by the owner is not recognised: nothing is touched, update says what to do, doctor warns
  for (const [lang, eol] of [['ru', '\n'], ['en', '\r\n']]) {
    const tr = T[lang];
    const label = `${lang} ${eol === '\r\n' ? 'CRLF' : 'LF'}`;
    console.log(`\n== migration, line changed by the owner ${label}`);
    const o = oldInstall(lang, eol);
    const edited = read(o.file).replace(tr.always[0], tr.always[1]);
    check(edited !== read(o.file), `${label}: test setup: the owner's word "always" added`);
    fs.writeFileSync(o.file, edited);
    const editedBuf = fs.readFileSync(o.file);
    let r = run('update', '--home', o.home);
    check(fs.readFileSync(o.file).equals(editedBuf) && !fs.existsSync(o.file + '.maxagent-backup'), `${label}: changed line: AGENTS.md untouched, no copy made`);
    check(tr.manual.test(r.stdout), `${label}: changed line: update prints agentsMigrateManual`, r.stdout);
    r = run('doctor', '--home', o.home);
    check(warnLines(r.stdout).some((l) => tr.manual.test(l)), `${label}: changed line: doctor warns (dCoreStart)`, r.stdout);
    fs.rmSync(o.home, { recursive: true, force: true }); // throwaway home created above
  }

  // g) a fresh init with the new code: the new text, all template files, no migration copy
  for (const lang of ['ru', 'en']) {
    const tr = T[lang];
    const home = fs.mkdtempSync(path.join(os.tmpdir(), `maxagent-fresh-${lang}-`));
    fs.mkdirSync(path.join(home, '.claude'));
    run('init', '--yes', '--lang', lang, '--home', home);
    const text = read(path.join(home, 'maxagent', 'AGENTS.md'));
    check(text.includes(tr.head) && text.includes(tr.intro) && !text.includes(tr.oldStart) && !text.includes(tr.oldIntro), `${lang}: fresh init: new AGENTS.md text`);
    check(fs.existsSync(path.join(home, 'maxagent', 'experience', 'agents', 'projects.md')) && fs.existsSync(path.join(home, 'maxagent', 'experience', 'platform', 'trash.md')), `${lang}: fresh init: agents/projects.md and the other template files`);
    check(!fs.existsSync(path.join(home, 'maxagent', 'AGENTS.md.maxagent-backup')), `${lang}: fresh init: no migration copy`);
    fs.rmSync(home, { recursive: true, force: true }); // throwaway home created above
  }
}

/* ---------- the skills shelf passes the package's own lint; update does not claim "untouched" ---------- */
{
  const eng = require('../tools/experience-engine.js');
  for (const lang of ['ru', 'en']) {
    const home = fs.mkdtempSync(path.join(os.tmpdir(), `maxagent-shelf-${lang}-`));
    const plug = fs.mkdtempSync(path.join(os.tmpdir(), `maxagent-plugins-${lang}-`));
    fs.mkdirSync(path.join(home, '.claude'));
    // A fake plugin home: s1 — the first phrase boils down to one stem ("OEE with…"), s2 — a long name and description.
    const skills = path.join(plug, '.claude', 'plugins', 'marketplaces', 'm', 'plugins', 'pluginpluginpluginpluginpluginpluginplug', 'skills');
    fs.mkdirSync(path.join(skills, 's1'), { recursive: true });
    fs.mkdirSync(path.join(skills, 's2'), { recursive: true });
    fs.writeFileSync(path.join(skills, 's1', 'SKILL.md'), `---\nname: s1\ndescription: OEE with ${'x'.repeat(95)}rest. Tracks equipment effectiveness for plants.\n---\nbody\n`);
    const long = 'Handles quarterly financial reconciliation across ledgers and subsidiaries with careful validation. Produces detailed variance reports for every cost center and highlights anomalies automatically. Integrates with spreadsheets, exports summaries to presentations, and keeps an audit trail of every adjustment made. Supports multiple currencies, rounding policies, intercompany eliminations, and tax adjustments for regional offices. Use it whenever the user mentions closing the books, month end, accruals, or consolidation workflows in any department.';
    fs.writeFileSync(path.join(skills, 's2', 'SKILL.md'), `---\nname: ${'abcdefghijklmnopqrstuvwxyzabcdefghijklmn'}\ndescription: ${long}\n---\nbody\n`);
    run('init', '--yes', '--lang', lang, '--home', home, '--workspace', path.join(home, 'maxagent'), '--agents', 'claude-code', '--no-bridge', '--desktop', '0', '--no-auto-update');
    const root = path.join(home, 'maxagent', 'experience');
    const env = { ...process.env, MAXAGENT_SKILLS_HOME: plug };
    const sc = spawnSync(process.execPath, [path.join(home, '.maxagent', 'tools', 'experience-skills.js'), 'scan'], { encoding: 'utf8', env });
    check(sc.status === 0, `${lang}: skills shelf: scan exit 0`, sc.stderr);
    const lint = spawnSync(process.execPath, [path.join(home, '.maxagent', 'tools', 'experience-engine.js'), 'lint', '--all', '--root', root], { encoding: 'utf8', env });
    check(lint.status === 0 && /ошибок нет/.test(lint.stdout), `${lang}: skills shelf: lint --all without errors`, lint.stdout.slice(-500));
    const shelf = read(path.join(root, 'skills', 'claude-plugins.md'));
    const a1 = shelf.split(/\n(?=### )/).find((x) => /\/s1 /.test(x.split('\n')[0]));
    check(!!a1, `${lang}: skills shelf: the atom s1 is there`);
    const parts = ((a1 || '').match(/^- когда: (.*)$/m) || [, ''])[1].split(/\s+·\s+/);
    check(parts.length > 0 && parts.every((p) => p.trim().split(/\s+/).length < 2 || new Set(eng.stems(p)).size > 1), `${lang}: skills shelf: no part of "когда" boils down to one stem`, parts.join(' | '));
    check(shelf.split(/\n(?=### )/).every((x) => x.length <= eng.MAX_ATOM), `${lang}: skills shelf: no atom longer than ${eng.MAX_ATOM}`);
    const up = run('update', '--home', home);
    check(up.status === 0 && !/не тронута|untouched/.test(up.stdout), `${lang}: update does not claim the workspace is untouched`, up.stdout.slice(0, 400));
    fs.rmSync(home, { recursive: true, force: true }); // throwaway home created above
    fs.rmSync(plug, { recursive: true, force: true }); // throwaway plugin home created above
  }
}

console.log(failed ? `\n${failed} FAILED` : '\nALL OK');
process.exit(failed ? 1 : 0);
