/**
 *   Om:
 *    1. sync från tail
 *    2. antalet lästa rader i tail är samma som antalet processade
 *    3. det finns en nyare fil
 *    4. inget hänt på 100 ms.
 *   I sådana fall gå vidare till nästa fil.
 */

const debug = require("debug");
const EventEmitter = require("events");
const files = require("./files");
const fs = require("fs");
const { promisify } = require("util");
const promisifyStreamChunks = require("promisify-stream-chunks");
const split2 = require("split2");
const tail = require("./tail");
const time = require("./time");
const open = promisify(fs.open);
const close = promisify(fs.close);
const path = require("path");

function reader(filenameTemplate) {
	let log = debug("eventlog:reader");

	function consume(callback, fromPosition, onSync) {
		const liveMeta = new EventEmitter();

		let currentLogFile;
		let currentStream;
		let currentStreamMeta;
		let nextFile;
		let nrOfProcessedRowsInCurrentFile;
		let stopped = false;
		let syncedAtRow;
		let syncedAtTime;

		let pos, prevPos;
		if (typeof fromPosition === "undefined") fromPosition = 0;

		const promise = files
			.existingLogfileByPosition(fromPosition, filenameTemplate)
			.then(file => {
				if (file) return file;
				const newLogfile = files.logfileForToday(filenameTemplate);
				return files.touch(newLogfile).then(() => newLogfile);
			})
			.then(logfile => {
				readFromLogfile(logfile);
			});

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

		function nextFileWatcher() {
			if (stopped) return;

			const logfile = currentLogFile;
			const todaysLogfile = files.logfileForToday(filenameTemplate);

			// Kommer inte det här att bli typ en miljard lyssnare efter ett tag?
			if (logfile === todaysLogfile) time.on("dateChange", nextFileWatcher);

			files.nextExistingLogfile(logfile, filenameTemplate).then(file => {
				if (stopped) return;
				if (logfile === currentLogFile) {
					nextFile = file;
					endOfFileCheck();
					if (nextFile) {
						setTimeout(nextFileWatcher, 5000).unref();
					} else {
						setTimeout(nextFileWatcher, 300).unref();
					}
				}
			});
		}

		function readFromLogfile(logfile) {
			log = debug("eventlog:reader:" + path.basename(logfile));
			log("Start reading %s", logfile);

			pos = files.firstPositionInLogfile(logfile, filenameTemplate);

			nextFile = null;

			let didClose = false;
			function closeCallback() {
				if (didClose) return (didClose = true);
				liveMeta.emit("close", logfile);
				log("Logfile stream closed.");
			}

			liveMeta.emit("open", logfile);
			const { streamMeta, stream } = tail(logfile);
			currentStream = stream;
			currentStreamMeta = streamMeta;
			currentLogFile = logfile;
			nextFileWatcher();

			stream.pipe(split2()).pipe(eventHandler());

			stream
				.on("error", err => {
					log("Error in data stream: %o", err);
					closeCallback();
				})
				.on("end", closeCallback)
				.on("close", closeCallback);

			stream.on("sync", () => {
				syncedAtRow = streamMeta.rows;
				syncedAtTime = new Date().getTime();

				endOfFileCheck();
			});
		}

		function readFromNextFile() {
			log("readFromNextFile!!!");
			if (!currentStream || stopped) return;
			const logfile = nextFile;
			currentStream.destroy();
			currentStream = null;
			readFromLogfile(logfile);
		}

		let lastSync = "";

		function endOfFileCheck() {

			const timeDiff = new Date().getTime() - syncedAtTime;
			if (
				syncedAtRow === currentStreamMeta.rows &&
				syncedAtRow === nrOfProcessedRowsInCurrentFile
			) {
				if (nextFile) {
					log("endOfFileCheck timeDiff %d", timeDiff);

					if (timeDiff < 100) {
						setTimeout(endOfFileCheck, 110 - timeDiff).unref();
					} else {
						readFromNextFile();
					}
				} else if (typeof onSync === "function") {
					if (timeDiff < 100) {
						setTimeout(endOfFileCheck, 110 - timeDiff).unref();
					} else {
						const syncInfo = {
							file: currentLogFile,
							rows: syncedAtRow
						};
						if (JSON.stringify(syncInfo) !== lastSync) {
							lastSync = JSON.stringify(syncInfo);
							onSync(syncInfo);
						}
					}
				}
			}
		}

		function stop() {
			if (stopped) return;
			stopped = true;

			if (!currentStream) return;
			currentStream.destroy();
			currentStream = null;

			setImmediate(() => liveMeta.removeAllListeners());
		}

		return { liveMeta, stop, promise };
	}

	return { consume };
}

module.exports = reader;
