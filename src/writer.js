const crypto = require("crypto");
const debug = require("debug");
const EventEmitter = require("events");
const files = require("./files");
const fs = require("fs");
const reader = require("./reader");
const time = require("./time");
const { promisify } = require("util");
const write = promisify(fs.write);
const close = promisify(fs.close);

const log = debug("eventlog:writer");

function randStr(len) {
	return [...crypto.randomBytes(len)]
		.map(n => Math.floor(n < 248 ? n / 4 : Math.random() * 61))
		.map(n => String.fromCharCode(n + (n > 9 ? ( n < 36 ? 55 : 61) : 48)))
		.join("");
}

function makeEnding(fileDescriptor) {
	if (!fileDescriptor) return;
	write(fileDescriptor, "---end\n")
		.then(() => close(fileDescriptor))
		.catch(err => {});
}

function writer(filenameTemplate) {

	let writeDescriptor;
	let currentLogfile;

	function createNewWriteDescriptor() {

		if (writeDescriptor) {
			((writeDescriptor, currentLogfile) => {
				setImmediate(() => {
					close(writeDescriptor)
						.then(() => log("Closed logfile: %s", currentLogfile))
						.catch(err => {
							// If we get an error here, that is probably because
							// the logfile was already closed in the makeEnding
							// function. Nothing to worry about.
						});
				});
			})(writeDescriptor, currentLogfile);
		}

		currentLogfile = files.logfileForToday(filenameTemplate);
		writeDescriptor = fs.openSync(currentLogfile, "a");
		log("Opened logfile for writing: %s", currentLogfile);
	}

	time.on("dateChange", () => {
		makeEnding(writeDescriptor);
		createNewWriteDescriptor();
	});
	createNewWriteDescriptor();

	const internalEmitter = new EventEmitter();
	function eventConsumer(event, meta) {
		internalEmitter.emit(meta.id, event, meta);
	}

	files.findLogfiles(filenameTemplate)
		.then(logfiles => {

			const { consume } = reader(filenameTemplate);

			if (logfiles.length === 0) {
				log("No existing logs found. Starting internal consumer at beginning of history.");
				consume(eventConsumer);

			} else {
				const lastLogfile = logfiles[logfiles.length - 1];
				const startReadPos = files.firstPositionInLogfile(lastLogfile, filenameTemplate);
				
				log("Starting internal consumer at position %d", startReadPos);

				consume(eventConsumer, startReadPos);
			}
		});

	function add(event) {
		const meta = { id: randStr(32) };

		debug("Writing event to log: %o", event);

		write(
			writeDescriptor,
			JSON.stringify({ event, meta }) + "\n"
		)
			.then(() => {})
			.catch(console.log);

		const promise = new Promise((resolve, reject) => {
			// Wait until the event we just wrote has been picked up by the
			// eventConsumer() function, i.e. it was read by a different
			// file descriptor, hence successfully written and enumbered.
			internalEmitter.once(meta.id, (event, meta) => resolve(meta));
		});

		return { ...meta, promise, logfile: currentLogfile };
	}

	return { add };

}

module.exports = writer;
