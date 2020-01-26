const disposableFile = require("disposablefile");
const fs = require("fs");
const { setTimeAndWaitUntilItIsApplied } = require("./helper");
const path = require("path");
const td = require("testdouble");
const time = require("../src/time");
const writer = require("../src/writer");

describe("writer.js", () => {

	describe("add()", () => {

		it("should return a hash, a time, a logfile and a promise", () => {
			const { add } = writer(disposableFile.fileSync({ name: "events-%y-%m-%d.log" }));
			const { id, promise, logfile } = add({ type: "dummyevent" })
			expect(id).to.be.a("string");
			expect(promise.then).to.be.a("function");
		});

		it("should return a promise which should resolve with pos and prevPos", () => {
			const { add } = writer(disposableFile.fileSync({ name: "events-%y-%m-%d.log" }));
			const { promise } = add({ type: "dummyevent" })
			return promise
				.then(meta => {
					const { id, pos, prevPos } = meta;
					expect(id).to.be.a("string");
				});
		});

		it("should write event to file", () => {
			const { add } = writer(disposableFile.fileSync({ name: "events-%y-%m-%d.log" }));
			const { logfile, id, promise } = add({ type: "dummyevent" })
			return promise
				.then(meta => {
					const data = JSON.parse(fs.readFileSync(logfile, "utf8").trim());
					expect(data).to.deep.equal({
						event: { type: "dummyevent" },
						meta: { id }
					});
				});
		});

		it("should switch write destination on date changes", () => {
			const filenameTemplate = disposableFile.fileSync({ name: "events-%y-%m-%d.log" });
			const { add } = writer(filenameTemplate);
			return setTimeAndWaitUntilItIsApplied(1979, 5, 25)
				.then(() => {
					const { logfile, id, promise } = add({ type: "dummyevent" })
					expect(logfile.substr(-22)).to.equal("/events-1979-05-25.log");
					td.reset();
					return setTimeAndWaitUntilItIsApplied(1984, 2, 4);
				})
				.then(() => {
					const { logfile, id, promise } = add({ type: "anotherdummy" })
					expect(logfile.substr(-22)).to.equal("/events-1984-02-04.log");
					return id
				})
				.then(id => new Promise(resolve => setTimeout(() => resolve(id), 50)))
				.then(id => {
					const filename = path.join(path.dirname(filenameTemplate), "events-1984-02-04.log");
					const rawdata = fs.readFileSync(
						filename,
						"utf8"
					).trim();
					const data = JSON.parse(rawdata);
					expect(data).to.deep.equal({
						event: { type: "anotherdummy" },
						meta: { id }
					});
				})
				.finally(() => td.reset());
		});

	});

});
