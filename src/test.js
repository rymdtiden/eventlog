const crypto = require("crypto");

/*
function randStr(len) {
	const a = c => {
		const b = [ ...(c || []), ...([...crypto.randomBytes(1)].filter(n => n < 62))];
		return b.length < len ? a(b) : b;
	}
	return a()
		.map(nr => String.fromCharCode(48 + nr + (nr > 9 ? 7 : 0) + (nr > 35 ? 6 : 0))).join("")
}
*/

console.log(randStr(1000000).split("")
	.reduce((acc, char) => {
		acc[char] = (acc[char] || 0) + 1;
		return acc;
	}, {}));

