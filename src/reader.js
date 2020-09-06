const debug = require("debug");
const EventEmitter = require("events");
const files = require("./files");
const path = require("path");
const promisifyStreamChunks = require("promisify-stream-chunks");
const split2 = require("split2");
const tail = require("./tail");

let instanceCounter = 0;

function reader(filenameTemplate) {
  const thisInstanceNr = instanceCounter;
  instanceCounter++;
  let log = debug("eventlog:reader:" + thisInstanceNr);

  function consume(callback, fromPosition, onSync) {
    const liveMeta = new EventEmitter();

    let stopped = false;
    let nrOfProcessedRowsInCurrentFile;
    let currentLogFile;
    let currentStream = null;
    let pos, prevPos;

    function startFile() {
      return new Promise((resolve, reject) => {
        function waitForFile() {
          if (stopped) return reject(new Error("Consumer was stopped."));
          if (fromPosition) {
            log("Reading from position %d", fromPosition);

            return files.existingLogfileByPosition(fromPosition, filenameTemplate)
              .then(file => {
                if (!file) {
                  throw new Error("No file found.");
                }
                log("Found logfile matching position %s", file);
                return resolve(file);
              })
              .catch(err => {
                log(
                  "Trying to find logfile matching position %d",
                  fromPosition
                );
                setTimeout(waitForFile, 1000);
              });
          } else {
            fromPosition = 0;
            return files.findLogfiles(filenameTemplate).then(allFiles => {
              if (allFiles.length === 0) {
                log("Trying to find logfile to start read.");
                setTimeout(waitForFile, 1000);
              } else {
                log("Found first existing logfile %s", allFiles[0]);
                resolve(allFiles[0]);
              }
            });
          }
        }
        waitForFile();
      })
    }

    function readFromLogfile(logfile) {
      log = debug(
        "eventlog:reader:" + thisInstanceNr + ":" + path.basename(logfile)
      );
      log("Open for reading %s", logfile);

      currentLogFile = logfile;
      pos = files.firstPositionInLogfile(logfile, filenameTemplate);
      liveMeta.emit("open", logfile);
      const { streamMeta, stream } = tail(logfile);
      currentStream = stream;

      let tailSyncCounter = 0;

      function eventHandler() {
        if (stopped) return;

        nrOfProcessedRowsInCurrentFile = 0;
        return promisifyStreamChunks(data => {
          log("Loaded data from logfile: %s", data);

          return Promise.resolve()
            .then(() => JSON.parse(data))
            .then(data => {
              if (pos >= fromPosition) {
                return callback(data.event, {
                  ...data.meta,
                  pos,
                  prevPos
                });
              } else {
                log("E V E N T   R E A D   I N   W R O N G   O R D E R");
                log("pos: %d", pos);
                log("fromPosition: %d", fromPosition);
              }
            })
            .catch(err => log("Error during event processing %o", err))
            .then(() => {
              prevPos = pos;
              pos++;
              nrOfProcessedRowsInCurrentFile++;
            });
        });
      }

      if (!stopped) {
        stream.pipe(split2()).pipe(eventHandler());
      }

      function closeCallback(err) {
        log("Closing connection");
        if (err) {
          liveMeta.emit("error", err);
        }
        liveMeta.emit("close", logfile);
        if (err) {
          stop();
        }
      }

      stream
        .on("error", err => closeCallback(err))
        .on("end", () => closeCallback())
        .on("close", () => closeCallback())
        .on("sync", () => {
          const syncedAtRow = streamMeta.rows;
          const syncedAtTime = new Date().getTime();

          tailSyncCounter++;
          const thisTailSyncNr = tailSyncCounter;

          log("Tail send file sync on row %d", syncedAtRow);
          let lastSyncInfo;

          function nextFile() {
            if (stopped) {
              log("Aborting search for next file, since we have been stoppd.");
              return false;
            }
            if (thisTailSyncNr !== tailSyncCounter) {
              log("There is a newer sync from tail.");
              return false;
            }
            if (currentLogFile !== logfile) {
              log("Log file is not the same anymore.");
              return false;
            }
            if (syncedAtRow !== streamMeta.rows) {
              log("Log reading is not in sync.");
              return false;
            }

            return files
              .nextExistingLogfile(logfile, filenameTemplate)
              .then(filename => {
                const readNextFile = (() => {
                  if (stopped) return false; // We have been stopped.
                  if (thisTailSyncNr !== tailSyncCounter) return false; // There is a newer sync from tail.
                  if (currentLogFile !== logfile) return false; // Nah, we're on the wrong file suddenly...
                  if (syncedAtRow !== streamMeta.rows) return false; // Not in sync anymore...
                  if (nrOfProcessedRowsInCurrentFile !== syncedAtRow)
                    return false; // We are not in sync with event processing.
                  if (filename) {
                    return filename;
                  }
                  return false;
                })();

                log("readNextFile: %s", readNextFile);

                if (readNextFile) {
                  stream.destroy();
                  setImmediate(() => readFromLogfile(readNextFile));
                } else {
                  const syncInfo = {
                    logfile,
                    rows: streamMeta.rows
                  };
                  if (JSON.stringify(syncInfo) !== lastSyncInfo) {
                    log(
                      "Reader in sync with data. calling onSync(" +
                        JSON.stringify(syncInfo) +
                        ")"
                    );
                    if (typeof onSync === "function") {
                      onSync(syncInfo);
                    }
                    lastSyncInfo = JSON.stringify(syncInfo);
                  }
                  setTimeout(nextFile, 300);
                }
              });
          }
          nextFile();
        });
    }

    startFile().then(filename => {
      log("Got our first logfile!");
      readFromLogfile(filename);
    })
      .catch(err => {
        log(err.message);
      });

    function stop() {
      log("stop() called.");
      stopped = true;
      if (currentStream) {
        currentStream.destroy();
      }
      setImmediate(() => liveMeta.removeAllListeners());
    }

    return { liveMeta, stop };
  }

  return { consume };
}

module.exports = reader;
