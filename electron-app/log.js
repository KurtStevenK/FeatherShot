// Append-only log file next to the app's user data, so a failure on a machine without a terminal
// can still be reported: Tray menu → Show Log File.
const fs = require('fs');
const path = require('path');

const MAX_BYTES = 1024 * 1024;
let logPath = null;

function init(dir) {
  logPath = path.join(dir, 'feathershot.log');
  try {
    fs.mkdirSync(dir, { recursive: true });
    if (fs.existsSync(logPath) && fs.statSync(logPath).size > MAX_BYTES) {
      fs.renameSync(logPath, `${logPath}.old`);
    }
  } catch (e) {
    console.error('Could not prepare the log file:', e);
  }
  return logPath;
}

function format(part) {
  if (part instanceof Error) return part.stack || part.message;
  if (typeof part === 'object' && part !== null) {
    try {
      return JSON.stringify(part);
    } catch (e) {
      return String(part);
    }
  }
  return String(part);
}

function log(...parts) {
  const line = `${new Date().toISOString()} ${parts.map(format).join(' ')}`;
  console.log(line);
  if (logPath) fs.appendFile(logPath, `${line}\n`, () => {});
}

function getLogPath() {
  return logPath;
}

module.exports = { init, log, getLogPath };
