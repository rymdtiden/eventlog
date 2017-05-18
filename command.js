'use strict';

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

let _init;
function init() {
	logger.log('init()');
	if (typeof _init === 'undefined') {
		_init = new Promise((resolve, reject) => {
			amqplibup('amqp://' + config.amqpHost, conn => {
				logger.log('Command connection created.');

				conn.createChannel((err, ch) => {
					logger.log('Command channel created.');
					connection = conn;
					channel = ch;
					channel.assertQueue(replyToQueue, { exclusive: true }, () => {
						logger.log('Reply queue asserted, now start consuming!');
						channel.consume(
							replyToQueue,
							msg => {
								if (msg != null) {
									let content = msg.content.toString();
									logger.log('Command got reply for pos#' + content);
									replyEmitter.emit(msg.properties.correlationId, content);
								}
								channel.ack(msg);
							},
							{
								noAck: false
							},
							(err, ok) => {
								logger.log('Reply queue consumer started.');
								resolve();
							}
						);
					});
				});
			});
		});
	}
	return _init;
}

function randStr() {
	return (new Date()).getTime().toString(36) + Math.random().toString(36).substring(7);
}

function add(event) {

	const correlationId = randStr();

	return init()
	.then(() => {
		return new Promise((resolve, reject) => {

			logger.log('Registering reply listener for correlation id:', correlationId);

			const replyListener = msg => {
				logger.log('Got reply to correlationId', correlationId + ':', msg);
				if (msg == '-1') {
					replyEmitter.removeListener(correlationId, replyListener);
					return reject(new Error('Error storing event.'));
				}
				if (/^[0-9]+$/.test(msg)) {
					replyEmitter.removeListener(correlationId, replyListener);
					return resolve(parseInt(msg));
				}
			};

			replyEmitter.on(correlationId, replyListener);

			channel.assertQueue(
				'events',
				{
					durable: true
				}
			);
			logger.log('sending to queue');
			channel.sendToQueue(
				'events',
				new Buffer(JSON.stringify(event)),
				{
					correlationId: correlationId,
					persistent: true,
					replyTo: replyToQueue
				}
			);

			setTimeout(() => {
				replyEmitter.removeListener(correlationId, replyListener);
				reject(new Error('Timeout storing event.'));
			}, 5000);
		});
	})
	.then(pos => {
		return pos;
	});
}

module.exports = {
	add
}
