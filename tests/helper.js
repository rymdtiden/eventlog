const td = require("testdouble");
const time = require("../src/time");

function setTimeAndWaitUntilItIsApplied(year, month, day) {

	const date = new Date();
	if (typeof year === "undefined") year = date.getUTCFullYear();
	if (typeof month === "undefined") month = date.getUTCMonth() + 1;
	if (typeof day === "undefined") day = date.getUTCDate();
 
	const { y, m, d } = time.now();
	if (y === year && m === month && d === day) return Promise.resolve();

	const promise = new Promise(resolve => {
		time.once("dateChange", resolve);
		td.reset();
		td.replace(time, "now");
		td.when(time.now()).thenReturn({ year, month, day });
	});

	return promise
		.then(date => {
			return new Promise(resolve => setTimeout(() => resolve(date), 100))
				.then(() => date);
		});
}

module.exports = {
	setTimeAndWaitUntilItIsApplied
};
