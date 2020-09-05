const debug = require("debug");
const disposableFile = require("disposablefile");
const files = require("./files");
const path = require("path");
const reader = require("./reader");
const { ReadOnlyError } = require("./errors");
const writer = require("./writer");

function eventlog(opts) {
  const filenameTemplate =
    (opts && opts.filename) ||
    path.join(disposableFile.dirSync(), "events-%y-%m-%d.log");

  const log = debug("eventlog:" + path.basename(filenameTemplate));

  const readOnly = opts && opts.readOnly ? true : false;

  const { add, stop } = (() => {
    if (readOnly) {
      log("Starting read-only eventlog.");

      return {
        add: () => Promise.reject(new ReadOnlyError()),
        stop: () => {}
      };
    }

    log("Starting read-write eventlog.");

    return writer(filenameTemplate);
  })();

  // Store the writer's stop function and all readers' stop functions in this
  // array, to be called when eventlog's stop function runs:
  const stopFns = [stop];

  const { consume } = reader(filenameTemplate);

  return {
    add,
    consume: (...args) => {
      const r = consume(...args);
      stopFns.push(r.stop);
      return r;
    },
    filename: filenameTemplate,
    stop: () => {
      log("Stopping.");
      stopFns.forEach(fn => fn());
    }
  };
}

module.exports = eventlog;
