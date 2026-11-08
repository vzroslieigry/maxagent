'use strict';
// Is somebody working through the bridge right now? The host writes activity.json on every agent call.
// A reload of the extension drops every connected agent and stops tab recordings (a voice-over recording
// was cut this way on 08.11.2026), so updates reload it only when the bridge is quiet.
const fs = require('fs');
const path = require('path');

const QUIET_MS = 10 * 60 * 1000; // no agent call for 10 minutes
const RECORDING_MAX_MS = 3 * 3600 * 1000; // a recording nobody stopped for 3 hours is stale

function bridgeBusy(baseDir, now = Date.now()) {
  let a = null;
  try { a = JSON.parse(fs.readFileSync(path.join(baseDir, 'activity.json'), 'utf8')); } catch { return { busy: false }; }
  const ago = now - (Number(a.lastCall) || 0);
  if (Array.isArray(a.recording) && a.recording.length && ago < RECORDING_MAX_MS) return { busy: true, why: 'recording', minutes: Math.round(ago / 60000) };
  if (ago < QUIET_MS) return { busy: true, why: 'recent', minutes: Math.round(ago / 60000) };
  return { busy: false };
}

module.exports = { bridgeBusy, QUIET_MS };
