const debug = require("debug");
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

let readerCounter = 0;

function reader(filenameTemplate) {

	const readerId = readerCounter; // Unique id for this reader.
	const log = debug("eventlog:reader:" + readerId);
	readerCounter++;

	let nrOfProcessedRowsInCurrentFile;

	function consume(callback, fromPosition) {

		let pos, prevPos;
		if (typeof fromPosition === "undefined") fromPosition = 0;

		return files.existingLogfileByPosition(fromPosition, filenameTemplate)
			.then(file => {
				if (file) return file;
				const newLogfile = files.logfileForToday(filenameTemplate);
				return files.touch(newLogfile)
					.then(() => newLogfile);
			})
			.then(logfile => {
				readFromLogfile(logfile);
			})

		function eventHandler() {
			nrOfProcessedRowsInCurrentFile = 0;
			return promisifyStreamChunks(data => {

				log("Loaded data from logfile: %s", data);

				return Promise.resolve()
					.then(() => JSON.parse(data))
					.then(data => {
						if (pos >= fromPosition) {
							return callback(
								data.event,
								{
									...(data.meta),
									pos,
									prevPos
								}
							)
						}
					})
					.catch(err => log("Error during event processing %o", err))
					.then(() => {
						prevPos = pos;
						pos++;
						nrOfProcessedRowsInCurrentFile++;
					})
			})
		}

		function readFromLogfile(logfile) {
			const log = debug("eventlog:reader:" + readerId + ":" + path.basename(logfile));

			log("Start reading %s", logfile);
			pos = files.firstPositionInLogfile(logfile, filenameTemplate);

			let endAppendTimeout;

			let didClose = false;
			function closeCallback() {
				if (didClose) return didClose = true;
				log("Logfile stream closed.");
			}

			const { streamMeta, stream } = tail(logfile);
			stream
				.pipe(split2())
				.pipe(eventHandler());

			stream.on("error", err => {
					log("Error in data stream: %o", err);
					closeCallback();
				})
				.on("end", closeCallback)
				.on("close", closeCallback);

			let lock = false;
			function checkNext() {

				if (lock) return log("checkNext() - Locked.");
				lock = true;
				log("checkNext()");

				const todaysLogfile = files.logfileForToday(filenameTemplate);
				log(todaysLogfile);
				if (todaysLogfile !== logfile) {
					log("Not today.");

					files.nextExistingLogfile(logfile, filenameTemplate)
						.then(file => {
							if (file) {
								log("Next existing logfile is: %s", file);
								stream.destroy();
								time.off("dateChange", checkNext);
								stream.off("sync", checkNext);
								readFromLogfile(file);
							} else {
								log("No existing logfile to continue with.");
							}
							log("Drop lock.");
							lock = false;
						});
				} else {
					lock = false;
				}
			}

			time.on("dateChange", checkNext);
			stream.on("sync", checkNext);

		}

	}

	return { consume };
}

module.exports = reader;
