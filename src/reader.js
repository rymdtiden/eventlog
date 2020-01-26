const debug = require("debug");
const files = require("./files");
const fs = require("fs");
const { promisify } = require("util");
const promisifyStreamChunks = require("promisify-stream-chunks");
const split2 = require("split2");
const tail = require("./tail");
const open = promisify(fs.open);
const close = promisify(fs.close);

let readerCounter = 0;

function reader(filenameTemplate) {

	const log = debug("eventlog:reader:" + readerCounter);
	readerCounter++;

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

		function eventHandler(stream) {
			let didEnd = false;
			return promisifyStreamChunks(data => {

				log("Loaded data from logfile: %s", data);

				// Stop processing events if we reach ---end
				if (data === "---end" && !didEnd) {
					log("Reached end of file marker.");
					didEnd = true;
					stream.destroy();
				}
				if (didEnd) return Promise.resolve();

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
							);
						}
					})
					.catch(err => log("Error during event processing %o", err))
					.then(() => {
						prevPos = pos;
						pos = pos + 1;
					})
			})
		}

		function readFromLogfile(logfile) {
			pos = files.firstPositionInLogfile(logfile, filenameTemplate);

			let endAppendTimeout;

			let didClose = false;
			function closeCallback() {
				if (didClose) return didClose = true;
				log("Logfile stream closed.");
				if (endAppendTimeout) clearTimeout(endAppendTimeout);
				files.nextExistingLogfile(logfile, filenameTemplate)
					.then(file => {
						if (file) {
							log("Next existing logfile is: %s", file);
							readFromLogfile(file);
						} else {
							log("No existing logfile to continue with.");
						}
					});
			}

			const stream = tail(logfile);
			stream
				.pipe(split2())
				.pipe(eventHandler(stream));
			stream.on("error", err => {
					log("Error in data stream: %o", err);
					closeCallback();
				})
				.on("end", closeCallback)
				.on("close", closeCallback);
			stream.once("sync", () => {

				log("Logfile tail in sync.");

				function appendEndToOldLogfile() {
					endAppendTimeout = setTimeout(() => {
						fs.appendFile(logfile, "---end\n", err => {
							if (err) {
								log("Error when trying to append ---end marker to logfile:");
								log(err);
							}
							log("Did append ---end marker to logfile.");
						});
					}, 5000).unref();
				}

				function lookForNextFile() {

					const todaysLogfile = files.logfileForToday(filenameTemplate);

					if (todaysLogfile !== logfile) {
						
						files.touch(todaysLogfile)
							.then(() => {
								// Today's file exists and it's not this one!
								appendEndToOldLogfile();
							})
							.catch(err => {
								// Could not open today's file. Check for other files newer than the current one:

								files.nextExistingLogfile(logfile, filenameTemplate)
									.then(nextLogfile => {
										if (nextLogfile) {
											appendEndToOldLogfile();
										} else {
											setTimeout(lookForNextFile, 10000);
										}
									})
									.catch(console.log);
							});
					}
				}
				lookForNextFile();

			});
		}

	}

	return { consume };
}

module.exports = reader;
