const amqplibup = require('amqplibup');
const config = require('./config');
const EventEmitter = require('events');
const Promise = require('bluebird');

let connection;
let channel;
let replyToQueue = 'reply.' + randStr();

class ReplyEmitter extends EventEmitter {}
const replyEmitter = new ReplyEmitter();

let logger = { log: () => { } };
if (process.env.DEBUG) logger = console;

function init() {
	console.log('init()');
	return new Promise((resolve, reject) => {
		amqplibup('amqp://' + config.amqpHost, conn => {
			logger.log('Connection created.');

			conn.createChannel((err, ch) => {
				logger.log('Channel created.');
				connection = conn;
				channel = ch;
				channel.assertQueue(replyToQueue, { exclusive: true }, () => {
					channel.consume(replyToQueue, msg => {
						if (msg != null) {
							let content = msg.content.toString();
							replyEmitter.emit(msg.properties.correlationId, content);
						}
					});
				});

				resolve();
			});
		});
	});
}

function randStr() {
	return (new Date()).getTime().toString(36) + Math.random().toString(36).substring(7);
}

function add(event) {

	correlationId = randStr();

	return init()
	.then(() => {
		return new Promise((resolve, reject) => {

			replyEmitter.once(correlationId, pos => {
				if (pos == -1) return reject(new Error('Error storing event.'));
				if (/^[0-9]$/.test(pos)) {
					resolve(parseInt(pos));
				}
			});

			channel.assertQueue('events', { durable: true });
			channel.sendToQueue(
				'events',
				new Buffer(JSON.stringify(event)),
				{
					correlationId: correlationId,
					replyTo: replyToQueue
				}
			);

			setTimeout(() => {
				reject(new Error('Timeout storing event.'));
			}, 5000);
		});
	})
	.then(pos => {
	});
}

module.exports = {
	add
}
