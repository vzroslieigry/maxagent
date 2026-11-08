'use strict';

const os = require('os');
const path = require('path');
const crypto = require('crypto');

const HOST_NAME = 'com.maxagent.bridge';

/** Base folder. MAXAGENT_BRIDGE_HOME overrides it (tests); Chrome starts the host without arguments, so env is the only way. */
function base(home) {
  if (process.env.MAXAGENT_BRIDGE_HOME) return path.resolve(process.env.MAXAGENT_BRIDGE_HOME);
  return path.join(home || os.homedir(), '.maxagent-bridge');
}

/**
 * Local channel between the host and MCP servers. No TCP port at all:
 *  - Windows: a named pipe whose name is derived from this user's base folder;
 *  - macOS/Linux: a unix socket inside the base folder (folder is 0700).
 */
function channel(baseDir) {
  if (process.platform === 'win32') {
    const tag = crypto.createHash('sha256').update(baseDir.toLowerCase()).digest('hex').slice(0, 16);
    return `\\\\.\\pipe\\maxagent-bridge-${tag}`;
  }
  return path.join(baseDir, 'bridge.sock');
}

function keyFile(baseDir, agent) {
  return path.join(baseDir, 'keys', `${String(agent).replace(/[^\w.-]/g, '_')}.key`);
}

module.exports = { HOST_NAME, base, channel, keyFile };
