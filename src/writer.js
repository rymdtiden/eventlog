const crypto = require("crypto");
const debug = require("debug");
const EventEmitter = require("events");
const files = require("./files");
const fs = require("fs");
const path = require("path");
const reader = require("./reader");
const time = require("./time");
const { promisify } = require("util");
const { WriteError } = require("./errors");
const writenotifier = require("./writenotifier");
const write = promisify(fs.write);
const close = promisify(fs.close);

function randStr(len) {
  return [...crypto.randomBytes(len)]
    .map(n => Math.floor(n < 248 ? n / 4 : Math.random() * 61))
    .map(n => String.fromCharCode(n + (n > 9 ? (n < 36 ? 55 : 61) : 48)))
    .join("");
}

function writer(filenameTemplate) {
  let writeDescriptor;
  let currentLogfile;
  let log = debug("eventlog:writer");
  let stopped = false;

  function createNewWriteDescriptor() {
    if (stopped) return;

    if (writeDescriptor) {
      ((writeDescriptor, currentLogfile, log) => {
        setImmediate(() => {
          if (stopped) return;
          close(writeDescriptor)
            .then(() => log("Closed logfile: %s", currentLogfile))
            .catch(err => {
              // If we get an error here, that is probably because
              // the logfile was already closed in the makeEnding
              // function. Nothing to worry about.
            });
        });
      })(writeDescriptor, currentLogfile, log);
    }

    currentLogfile = files.logfileForToday(filenameTemplate);
    try {
      fs.mkdirSync(path.dirname(path.resolve(process.cwd(), currentLogfile)), {
        recursive: true
      });
    } catch (err) {
      //
    }
    log = debug("eventlog:writer:" + path.basename(currentLogfile));
    writeDescriptor = fs.openSync(currentLogfile, "a");
    log("Opened logfile for writing: %s", currentLogfile);
  }

  time.on("dateChange", createNewWriteDescriptor);
  createNewWriteDescriptor();

  const internalEmitter = new EventEmitter();
  function eventConsumer(event, meta) {
    if (stopped) false;
    internalEmitter.emit(meta.id, event, meta);
  }

  let stopConsumer;

  files.findLogfiles(filenameTemplate).then(logfiles => {
    if (stopped) return;

    const { consume } = reader(filenameTemplate);

    if (logfiles.length === 0) {
      log(
        "No existing logs found. Starting internal consumer at beginning of history."
      );
      const { stop } = consume(eventConsumer);
      stopConsumer = stop;
    } else {
      const lastLogfile = logfiles[logfiles.length - 1];
      const startReadPos = files.firstPositionInLogfile(
        lastLogfile,
        filenameTemplate
      );

      log("Starting internal consumer at position %d", startReadPos);

      const { stop } = consume(eventConsumer, startReadPos);
      stopConsumer = stop;
    }
  });

  function add(event) {
    if (stopped) false;
    const meta = { id: randStr(32) };

    log("Adding event to log: %O %O", event, meta);

    write(writeDescriptor, JSON.stringify({ event, meta }) + "\n")
      .then(() => writenotifier.emit("write", currentLogfile))
      .catch(err => {
        throw new WriteError();
      });

    const promise = new Promise((resolve, reject) => {
      // Wait until the event we just wrote has been picked up by the
      // eventConsumer() function, i.e. it was read by a different
      // file descriptor, hence successfully written and enumbered.
      internalEmitter.once(meta.id, (event, meta) => resolve(meta));
    });

    return { ...meta, promise, logfile: currentLogfile };
  }

  function stop() {
    if (stopped) return;
    stopped = true;
    close(writeDescriptor);
    time.off("dateChange", createNewWriteDescriptor);
    if (stopConsumer) stopConsumer();
  }

  return { add, stop };
}

module.exports = writer;
