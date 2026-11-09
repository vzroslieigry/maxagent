#!/usr/bin/env node
'use strict';

const os = require('os');
const path = require('path');
const readline = require('readline');

/**
 * Question/answer over stdin that also works when answers are piped in
 * (an agent running `init` for the owner): lines that arrive before a question
 * is asked are queued instead of lost; end of input answers with the default.
 */
function asker() {
  const rl = readline.createInterface({ input: process.stdin, terminal: process.stdin.isTTY });
  const lines = [];
  const waiting = [];
  let closed = false;
  rl.on('line', (l) => (waiting.length ? waiting.shift()(l) : lines.push(l)));
  rl.on('close', () => {
    closed = true;
    while (waiting.length) waiting.shift()('');
  });
  return {
    question(q) {
      process.stdout.write(q);
      if (lines.length) {
        const l = lines.shift();
        if (!process.stdin.isTTY) process.stdout.write(l + '\n');
        return Promise.resolve(l);
      }
      if (closed) {
        process.stdout.write('\n');
        return Promise.resolve('');
      }
      return new Promise((res) => waiting.push((l) => {
        if (!process.stdin.isTTY) process.stdout.write(l + '\n');
        res(l);
      }));
    },
    close: () => rl.close(),
  };
}
const commands = require('../lib/commands');
const { PKG } = require('../lib/util');

const HELP = `maxagent ${PKG.version}

  npx maxagent init        первая настройка с вопросами / first-time setup
  npx maxagent setup       поменять настройки (репозиторий, мост, стол, формат, Корзина) / change settings
  npx maxagent doctor      что установлено и в порядке ли / health check
  npx maxagent update      обновить регламент и блоки у агентов / update rules and agent blocks
  npx maxagent uninstall   убрать блоки и хуки у агентов (рабочая папка остаётся) / remove agent blocks and hooks (workspace kept)
  npx maxagent index       собрать индекс опыта из шапок (--check — только проверить) / rebuild the experience index (--check to only check)
  npx maxagent bridge      поставить браузерный мост и расширение Chrome / install the browser bridge and Chrome extension
  npx maxagent vectors     поставить поиск опыта по смыслу (~270 МБ) / install meaning search (~270 MB)
  npx maxagent experience list|add <набор>|all|update|mute|unmute|adopt "<id>"|share <папка> --name <имя>|share --check <набор>   общий опыт / shared experience packs
  --all (init: поставить все дополнения / install all extras)  --no-extras (без дополнений / no extras)

  --lang ru|en  --workspace <path>  --agents claude-code,codex,antigravity,openclaw
  --repo <url> (- — выключить / off)  --bridge | --no-bridge  --desktop <N> (0 — нет / none)  --no-answer-format  --no-trash  --no-auto-update
  --yes (без вопросов / no questions)  --dry-run (ничего не писать / write nothing)  --no-hooks
  --home <dir>  (домашняя папка для проверки / home folder override for testing)
`;

function parse(argv) {
  const opts = { cmd: argv[0] };
  // `experience <list|add|update|mute|unmute|adopt> …` — the rest goes to tools/experience-packs.js as is.
  if (argv[0] === 'experience') {
    const h = argv.indexOf('--home');
    opts.rest = argv.slice(1).filter((a, i) => !(h > 0 && (i + 1 === h || i === h)));
    opts.home = path.resolve(h > 0 ? argv[h + 1] : os.homedir());
    return opts;
  }
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    const val = () => argv[++i];
    if (a === '--yes' || a === '-y') opts.yes = true;
    else if (a === '--dry-run') opts.dryRun = true;
    else if (a === '--lang') opts.lang = val();
    else if (a === '--workspace') opts.workspace = val();
    else if (a === '--agents') opts.agents = val();
    else if (a === '--repo') opts.repo = val();
    else if (a === '--home') opts.home = val();
    else if (a === '--no-hooks') opts.noHooks = true;
    else if (a === '--check') opts.check = true;
    else if (a === '--bridge') opts.bridge = true;
    else if (a === '--no-bridge') opts.bridge = false;
    else if (a === '--desktop') opts.desktop = val();
    else if (a === '--no-answer-format') opts.answerFormat = false;
    else if (a === '--answer-format') opts.answerFormat = true;
    else if (a === '--no-trash') opts.trash = false;
    else if (a === '--trash') opts.trash = true;
    else if (a === '--no-auto-update') opts.autoUpdate = false;
    else if (a === '--auto-update') opts.autoUpdate = true;
    else if (a === '--all') opts.all = true;
    else if (a === '--no-extras') opts.noExtras = true;
    else {
      opts.bad = a;
    }
  }
  opts.home = path.resolve(opts.home || os.homedir());
  return opts;
}

async function main() {
  const opts = parse(process.argv.slice(2));
  const io = {
    out: (s) => process.stdout.write(s + '\n'),
    rl: asker,
  };
  if (!opts.cmd || opts.cmd === 'help' || opts.cmd === '--help' || opts.cmd === '-h') {
    io.out(HELP);
    return 0;
  }
  if (opts.bad) {
    io.out(`? ${opts.bad}\n\n${HELP}`);
    return 2;
  }
  const fn = commands[opts.cmd];
  if (!fn) {
    io.out(`Неизвестная команда / Unknown command: ${opts.cmd}\n\n${HELP}`);
    return 2;
  }
  return fn(opts, io);
}

main().then(
  (code) => process.exit(code || 0),
  (err) => {
    process.stderr.write(`maxagent: ${err && err.message ? err.message : err}\n`);
    process.exit(1);
  },
);
