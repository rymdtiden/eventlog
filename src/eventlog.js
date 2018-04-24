const disposableFile = require("disposablefile");
const files = require("./files");
const path = require("path");
const reader = require("./reader");
const { ReadOnlyError } = require("./errors");
const writer = require("./writer");

function eventlog(opts) {
	const filenameTemplate = (opts && opts.filename) || path.join(disposableFile.dirSync(), "events-%y-%m-%d.log");
	const readOnly = (opts && opts.readOnly) ? true : false;

	const { add } = (() => {
		if (readOnly) {
			return { add: () => Promise.reject(new ReadOnlyError()) };
		}
		return writer(filenameTemplate);
	})();

	const { consume } = reader(filenameTemplate);

	return {
		add,
		consume,
		filename: filenameTemplate
	};
}

module.exports = eventlog;
