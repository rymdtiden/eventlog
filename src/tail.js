const debug = require("debug");
const EventEmitter = require("events");
const fs = require("fs");
const path = require("path");
const stream = require("stream");
const { Readable } = require("stream");
const writenotifier = require("./writenotifier");

function tail(filename) {

	const log = debug("eventlog:tail:" + path.basename(filename));

	const fd = fs.openSync(filename, "r");
	log("Opened file %s.", filename);

	const chunkSize = 16 * 1024; // 16 kb
	let paused;

	const signals = new EventEmitter();
	signals.on("requestMoreData", size => {
		if (paused || readable.destroyed) return;
		const buf = Buffer.alloc(size || chunkSize);
		fs.read(fd, buf, 0, chunkSize, null, (err, bytesRead, buf) => {
			if (err) {
				log("Tail error %o", err);
				readable.destroy(err);
			}
			if (!bytesRead) return readable.emit("sync");
			log("Read %d bytes.", bytesRead);
			const data = buf.slice(0, bytesRead);
			paused = readable.push(data) ? false : true;
			if (paused) log("Underlying buffer full. Pausing.");
			if (!paused) signals.emit("requestMoreData");
		});
	});
	signals.on("hasMoreData", () => {
		if (!paused) signals.emit("requestMoreData");
	});

	const readable = new Readable({
		read(size) {
			log("Requested %d bytes more data.", size);
			if (paused) {
				log("Underlying buffer not full anymore. Resuming.");
				paused = false;
			}
			signals.emit("requestMoreData", size);
		}
	});

	readable.on("close", () => {
		log("Closed file %s.", filename);
		fs.close(fd, () => {});
		fs.unwatchFile(filename);
		writenotifier.off("write", writeNotificationHandler);
	});

	const watcher = fs.watch(filename, { persistent: false }, (eventType, filename) => {
		log("File changed.");
		signals.emit("hasMoreData");
	});
	fs.watchFile(filename, { interval: 100, persistent: false }, (eventType, filename) => {
		log("File changed.");
		signals.emit("hasMoreData");
	});

	function writeNotificationHandler() {
		signals.emit("hasMoreData");
	}

	writenotifier.on("write", writeNotificationHandler);

	return readable;

}

module.exports = tail
