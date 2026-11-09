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
  check(ruleCount >= 10 && ruleCount <= 14, `core rules: ${ruleCount} items`);
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
  const answer = (args, lines) => spawnSync(process.execPath, [BIN, ...args, '--home', home], { encoding: 'utf8', input: lines.join('\n') + '\n', env: { ...process.env, MAXAGENT_PIPED: '1' } });
  const cfgOf = () => JSON.parse(read(path.join(home, '.maxagent', 'config.json')));
  const block = (re) => (read(path.join(ws, 'AGENTS.md')).match(re) || [''])[0];
  const RULES = /<!-- maxagent:rules:start[\s\S]*?maxagent:rules:end -->/;
  const SETTINGS = /<!-- maxagent:settings:start -->[\s\S]*?maxagent:settings:end -->/;
  // lang, workspace, agents, repo, bridge, desktop, answer format, trash
  let r = answer(['init'], ['ru', ws, '', '', 'y', '2', 'n', '']);
  let c = cfgOf();
  check(r.status === 0 && c.bridge === true && c.desktop === 2 && c.answerFormat === false && c.trash === true && c.codeword === undefined && !/одов/.test(r.stdout), 'init: answers piped in → settings saved', JSON.stringify(c) + r.stdout.slice(-300));
  check(/рабочем столе 2/.test(block(RULES)) && /maxagent-bridge/.test(block(RULES)) && !/глянуть/.test(block(RULES)) && /Корзину/.test(block(RULES)), 'init: core rules follow the answers');
  check(/рабочий стол 2/.test(block(SETTINGS)) && /Браузерный мост: включено/.test(block(SETTINGS)), 'init: "Settings" section filled', block(SETTINGS));
  check(/npx maxagent-bridge install/.test(r.stdout), 'init: bridge chosen but not installed → install hint');
  const order = ['Адрес закрытого репозитория', 'Браузерный мост', 'Отдельный рабочий стол', 'Ответы агента', 'Удалять только в Корзину'].map((q) => r.stdout.indexOf(q));
  check(order.every((p, i) => p > 0 && (i === 0 || p > order[i - 1])), 'init: questions in the agreed order', order.join(','));

  // setup: repo (- = off), bridge, desktop (0 = none), format, trash
  r = answer(['setup'], ['-', 'n', '0', 'y', 'n']);
  c = cfgOf();
  check(r.status === 0 && c.bridge === false && c.desktop === null && c.answerFormat === true && c.trash === false, 'setup: settings changed', JSON.stringify(c));
  check(!/maxagent-bridge/.test(block(RULES)) && /глянуть/.test(block(RULES)) && !/Корзину/.test(block(RULES)) && /без окон/.test(block(RULES)), 'setup: core rules rebuilt');
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
  check(U.plan(cfg, { maxagent: '0.5.9', bridge: '0.5.9' }).action === 'install', 'self-update: newer patch, same number for both → installs itself');
  check(U.plan(cfg, { maxagent: '0.6.0', bridge: '0.6.0' }).action === 'install', 'self-update: newer minor → installs itself');
  check(U.plan(cfg, { maxagent: '1.0.0', bridge: '1.0.0' }).action === 'ask', 'self-update: a new major version waits for the owner');
  check(U.plan(cfg, { maxagent: '0.5.9', bridge: '0.5.0' }).action === 'none', 'self-update: agent and bridge numbers differ → wait for both');
  check(U.plan({ ...cfg, autoUpdate: false }, { maxagent: '0.5.9', bridge: '0.5.9' }).action === 'ask', 'self-update off → only tells');
  check(U.plan(cfg, { maxagent: '0.5.0', bridge: '0.5.0' }).action === 'none', 'self-update: same version → nothing');
  const att = (repo) => ({ attestations: [{ predicateType: 'https://slsa.dev/provenance/v1', bundle: { dsseEnvelope: { payload: Buffer.from(JSON.stringify({ predicate: { buildDefinition: { externalParameters: { workflow: { repository: repo } } } } })).toString('base64') } } }] });
  check(U.provenanceRepo(att('https://github.com/vzroslieigry/maxagent')) === 'https://github.com/vzroslieigry/maxagent', 'provenance: our repository read from the attestation');
  check(U.provenanceRepo(att('https://github.com/someone/fork')) !== 'https://github.com/vzroslieigry/maxagent' && U.provenanceRepo({ attestations: [] }) === null, 'provenance: a fork or no attestation is not ours');
}

console.log(failed ? `\n${failed} FAILED` : '\nALL OK');
process.exit(failed ? 1 : 0);
