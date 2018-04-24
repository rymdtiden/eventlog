const td = require("testdouble");
const time = require("../src/time");
const { setTimeAndWaitUntilItIsApplied } = require("./helper");

describe("time.js", () => {

	describe(".on(\"dateChange\")", () => {

		it("should run callback when day changes", function () {
			this.timeout = 10000;

			return setTimeAndWaitUntilItIsApplied(1979, 5, 25)
				.then(() => {

					setTimeout(() => {
						td.when(time.now()).thenReturn({ year: 1984, month: 2, day: 4 });
					}, 100);

					return new Promise(resolve => time.once("dateChange", resolve))
						.then(times => {
							expect(times).to.deep.equal({
								oldTime: { year: 1979, month: 5, day: 25 },
								newTime: { year: 1984, month: 2, day: 4 }
							});
						})
						.finally(() => td.reset());
				})
		});

	});

});
