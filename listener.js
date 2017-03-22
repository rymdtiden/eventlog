const replicator = require('./replicator');

class Listener {

	constructor(fromPos, callback) {
		this.nextPos = fromPos;
		this.callback = callback;
	}

	_next() {
		replicator.getPosition(this.nextPos)
		.then(msg => {
			return this.callback(msg);
		})
		.then(() => {
			setImmediate(() => {
				this.nextPos++;
				this._next();
			});
		});
	}

}

function listen(fromPos, callback) {
	const listener = new Listener(fromPos, callback);
	setImmediate(() => { listener._next(); });
	return listener;
}

module.exports = {
	listen
};
