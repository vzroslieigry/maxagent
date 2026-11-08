#!/usr/bin/env node
'use strict';

const HELP = `maxagent-bridge — browser hands for AI agents

  npx maxagent-bridge install     install the host, extension files and MCP for found agents
  npx maxagent-bridge doctor      check installation and whether the browser is connected
  npx maxagent-bridge uninstall   remove host registration and MCP entries
  npx maxagent-bridge reload      make the running extension re-read its files (install does this itself)

  --agents claude-code,codex,antigravity   --no-agents   --dry-run   --home <dir> (testing; skips the registry)

  (internal) maxagent-bridge host            — started by Chrome
  (internal) maxagent-bridge mcp --agent X   — started by an agent
`;

function parse(argv) {
  const o = { cmd: argv[0] };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--dry-run') o.dryRun = true;
    else if (a === '--force') o.force = true;
    else if (a === '--agents') o.agents = argv[++i] || '';
    // PowerShell 5.1 drops an empty "" argument, so "--agents ''" cannot mean "none" there — use this flag.
    else if (a === '--no-agents') o.agents = '';
    else if (a === '--agent') o.agent = argv[++i];
    else if (a === '--home') { o.home = argv[++i]; o.registry = false; }
    else if (a === '--no-registry') o.registry = false;
  }
  return o;
}

async function main() {
  const o = parse(process.argv.slice(2));
  const out = (s) => process.stdout.write(s + '\n');
  if (o.cmd === 'host') return require('../lib/host').runHost(); // Chrome passes the origin as an argument; Chrome itself enforces allowed_origins
  if (o.cmd === 'mcp') return require('../lib/mcp').runMcp({ agent: o.agent || 'agent' });
  const inst = require('../lib/install');
  if (o.cmd === 'install') return inst.install(o, out);
  if (o.cmd === 'uninstall') return inst.uninstall(o, out);
  if (o.cmd === 'doctor') return inst.doctor(o, out);
  if (o.cmd === 'reload') return inst.reload(o, out);
  out(HELP);
  return o.cmd ? 2 : 0;
}

main().then((code) => {
  if (typeof code === 'number') process.exit(code);
}, (e) => {
  process.stderr.write(`maxagent-bridge: ${e.message || e}\n`);
  process.exit(1);
});
