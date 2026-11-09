'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Adapters: where each agent keeps its global rules.
 * Verified against official docs on 2026-11-03 (projects/maxagent/sverka-agentov.md).
 * Every adapter returns the list of rules files to carry the maxagent block.
 */
/** Hermes keeps everything in one folder: %LOCALAPPDATA%\\hermes on Windows, ~/.hermes elsewhere; a test home is never redirected. */
function hermesHome(home) {
  const real = path.resolve(home) === path.resolve(require('os').homedir());
  if (real && process.env.HERMES_HOME) return process.env.HERMES_HOME;
  if (real && process.platform === 'win32' && process.env.LOCALAPPDATA) return path.join(process.env.LOCALAPPDATA, 'hermes');
  return path.join(home, '.hermes');
}

const ADAPTERS = {
  'claude-code': {
    title: 'Claude Code',
    detect: (home) => fs.existsSync(path.join(home, '.claude')),
    rulesFiles: (home) => [path.join(home, '.claude', 'CLAUDE.md')],
  },
  codex: {
    title: 'Codex',
    detect: (home) => fs.existsSync(path.join(home, '.codex')),
    // If AGENTS.override.md exists, Codex reads it instead of AGENTS.md.
    rulesFiles: (home) => {
      const override = path.join(home, '.codex', 'AGENTS.override.md');
      return [fs.existsSync(override) ? override : path.join(home, '.codex', 'AGENTS.md')];
    },
  },
  antigravity: {
    title: 'Antigravity',
    detect: (home) => fs.existsSync(path.join(home, '.gemini')),
    // ~/.gemini/AGENTS.md is always active and needs no frontmatter (config/rules/*.md would).
    rulesFiles: (home) => [path.join(home, '.gemini', 'AGENTS.md')],
  },
  hermes: {
    title: 'Hermes',
    detect: (home) => fs.existsSync(path.join(hermesHome(home), 'config.yaml')),
    rulesFiles: () => [], // the plugin puts the rules into the system prompt
  },
  openclaw: {
    title: 'OpenClaw',
    detect: (home) => fs.existsSync(path.join(home, '.openclaw', 'openclaw.json')),
    // No global rules file: every agent has its own workspace with its own AGENTS.md.
    rulesFiles: (home) => {
      const cfgFile = path.join(home, '.openclaw', 'openclaw.json');
      let cfg;
      try {
        cfg = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
      } catch {
        return [];
      }
      const agents = (cfg && cfg.agents) || {};
      const dirs = new Set();
      if (agents.defaults && agents.defaults.workspace) dirs.add(agents.defaults.workspace);
      const entries = agents.entries || {};
      for (const v of Array.isArray(entries) ? entries : Object.values(entries)) {
        if (v && v.workspace) dirs.add(v.workspace);
      }
      return [...dirs].map((d) => path.join(d, 'AGENTS.md'));
    },
  },
};

function detectAgents(home) {
  return Object.keys(ADAPTERS).filter((id) => ADAPTERS[id].detect(home));
}

module.exports = { ADAPTERS, detectAgents, hermesHome };
