const amqplibup = require('amqplibup');
const config = require('./config');
const EventEmitter = require('events');
const Promise = require('bluebird');
const request = require('request');
const rx = require('rxjs/Rx');
const split = require('split');

let connection;
let channel;

let queue = 'eventlistener.' + randStr();

let logger = { log: () => { } };
if (process.env.DEBUG) logger = console;

function randStr() {
	return (new Date()).getTime().toString(36) + Math.random().toString(36).substring(7);
}

let _init;
function init() {
	if (typeof _init === 'undefined') {
		_init = new Promise((resolve, reject) => {
			amqplibup('amqp://' + config.amqpHost, conn => {
				logger.log('Listener connection created.');

				conn.createChannel((err, ch) => {
					logger.log('Listener channel created.');
					connection = conn;
					channel = ch;
					channel.assertQueue(queue, { exclusive: true }, (err, q) => {
						channel.bindQueue(queue, config.exchangeName, '');
					});

					resolve();
				});
			});
		});
	}
	return _init;
}

function listen(fromPos, callback) {
	if (typeof fromPos === 'function') {
		callback = fromPos;
		delete fromPos;
	}

	logger.log('listen(' + fromPos + ')');

	
	return rx.Observable.fromPromise(init())
	.flatMap(() => {
		
		const historyStream = request(config.historyUrl)
			.pipe(split(JSON.parse, null, { trailing: false }));

		const dataPauser = new rx.Subject();
		console.log(dataPauser);
		console.log(dataPauser.next);
		dataPauser.next(true);

		rx.Observable.zip(
			rx.Observable.merge(
				rx.Observable.fromEvent(historyStream, 'data').pausableBuffered(dataPauser).flatMap(msg => {
					dataPauser.next(false);
					callback(msg)
					.then(() => dataPauser.next(true));
				}),
				rx.fromEvent(historyStream, 'error').flatMap(err => {
					throw(err);
				})
			),
			rx.fromEvent(historyStream, 'close')
		)

	}).toPromise();

}

module.exports = {
	listen
};
