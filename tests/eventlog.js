const eventlog = require("../src/eventlog");
const disposableFile = require("disposablefile");
const path = require("path");
const { ReadOnlyError } = require("../src/errors");

describe("eventlog.js", () => {

	describe("eventlog()", () => {

		it("should export add() and consume() functions", () => {

			const log = eventlog();
			expect(log.add).to.be.a("function");
			expect(log.consume).to.be.a("function");

		});

		it("should generate a temporary filename if none given", () => {

			const log = eventlog();
			expect(log.filename).to.be.a("string");
			expect(log.filename.length).to.be.above(1);

		});

		it("should use the given filename, if it was given", () => {

			const filename = path.join(disposableFile.dirSync(), "events-%y-%m-%d.log");
			const log = eventlog({ filename });
			expect(log.filename).to.equal(filename);

		});

		it("should export non-functioning writer if read only", () => {
			const log = eventlog({ readOnly: true });
			return log.add({ type: "test" })
				.catch(err => err)
				.then(err => {
					expect(err).to.be.instanceof(ReadOnlyError);
				});
		});

	});

});
