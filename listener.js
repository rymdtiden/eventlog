'use strict';

const replicator = require('./replicator');

let logger = { log: () => { } };
if (process.env.DEBUG) logger = console;

class Listener {

	constructor(fromPos, callback) {
		this.nextPos = fromPos;
		this.callback = callback;
	}

	_next() {
		replicator.getPosition(this.nextPos)
		.then(msg => {
			logger.log('Listener got msg from replicator: pos#' + msg.pos);
			this.callback(msg)
			.then(() => {
				logger.log('Listener handler resolved for pos#' + msg.pos);
				setImmediate(() => {
					this.nextPos++;
					this._next();
				});
			});
		});
	}

}

function listen(fromPos, callback) {
	logger.log('Listener started at position:', fromPos);
	const listener = new Listener(fromPos, callback);
	setImmediate(() => { listener._next(); });
	return listener;
}

module.exports = {
	listen
};
