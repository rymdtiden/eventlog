const eventlog = require("../src/eventlog");
const disposableFile = require("disposablefile");
const path = require("path");
const td = require("testdouble");
const { ReadOnlyError } = require("../src/errors");
const { setTimeAndWaitUntilItIsApplied } = require("./helper");

describe("eventlog.js", () => {

	describe("eventlog()", () => {

		it("should export add() and consume() functions", () => {

			const log = eventlog();
			expect(log.add).to.be.a("function");
			expect(log.consume).to.be.a("function");
			log.stop();

		});

		it("should generate a temporary filename if none given", () => {

			const log = eventlog();
			expect(log.filename).to.be.a("string");
			expect(log.filename.length).to.be.above(1);
			log.stop();

		});

		it("should use the given filename, if it was given", () => {

			const filename = path.join(disposableFile.dirSync(), "events-%y-%m-%d.log");
			const log = eventlog({ filename });
			expect(log.filename).to.equal(filename);
			log.stop();

		});

		it("should export non-functioning writer if read only", () => {
			const log = eventlog({ readOnly: true });
			return log.add({ type: "test" })
				.catch(err => err)
				.then(err => {
					expect(err).to.be.instanceof(ReadOnlyError);
				})
				.finally(() => log.stop());
		});

		it("should be able to handle heavy load and date changes", function () {
			this.timeout(30000);
			const testMs = 20000;

			let time = new Date("1979-05-25 12:00:00");

			let stopFn;

			return setTimeAndWaitUntilItIsApplied(time.getFullYear(), time.getMonth() + 1, time.getDate())
			.then(() => new Promise(resolve => {

				const filename = path.join(disposableFile.dirSync(), "events-%y-%m-%d.log");
				const { add, consume, stop } = eventlog({ filename });
				stopFn = stop;

				let popCounter = 0;
				function populate() {
					const { promise, logfile } = add({ type: "test", counter: popCounter });
					promise
						.then(({ pos }) => {
							popCounter++;
							if (pos < 1979070100000000) {

								if (Math.random() < 0.05) {
									time.setDate(time.getDate() + 1);
									setTimeAndWaitUntilItIsApplied(time.getFullYear(), time.getMonth() + 1, time.getDate());
								}

								setImmediate(populate);
							} else {
								resolve();
							}
						});
				}
				populate();

				consume((event, meta) => {
					return Promise.resolve()
						.then(() => {
							if (meta.pos < 1979070100000000) {
							} else {
								resolve();
							}
						});
				});

			}))
			.finally(() => {
				td.reset();
				stopFn();
			});

		});

	});

});
