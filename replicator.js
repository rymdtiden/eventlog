const amqplibup = require('amqplibup');
const config = require('./config');
const EventEmitter = require('events');
const fs = require('fs');
const levelup = require('levelup');
const Promise = require('bluebird');
const promisifyStreamChunks = require('promisify-stream-chunks');
const request = require('request');
const split = require('split');

let logger = { log: () => { } };
if (process.env.DEBUG) logger = console;

const bytepos = 0;
const index = [];

class IncomingEmitter extends EventEmitter {}
const incomingEmitter = new IncomingEmitter();

let highestPosition = -1;

const storage = '/tmp/eventreplicator';
const init = new Promise((resolve, reject) => {

	levelup(
		storage,
		{
			keyEncoding: 'utf8',
			valueEncoding: 'json',
			sync: false
		},
		(err, db) => {

			if (err) return reject(err);

			function addToDb(data, callback) {

				logger.log('addToDb', data);

				db.put(
					data.pos + '',
					data,
					{
						keyEncoding: 'utf8',
						valueEncoding: 'json',
						sync: false
					},
					err => {
						if (err) {
							logger.log('addToDb err:', err);
						} else {
							incomingEmitter.emit(data.pos + '', data);
							if (data.pos > highestPosition) {
								highestPosition = data.pos;
							}
						}
						callback(err);
					}
				);
			}

			let firstConnect = true;
			function fetchHttpHistory() {
				let error = false;
				logger.log('Fetching history from', config.historyUrl);
				request(config.historyUrl)
				.on('error', err => {
					logger.log('Error fetching history:', err);
					error = err;
					setTimeout(fetchHttpHistory, 2000);
				})
				.pipe(split(JSON.parse, null, { trailing: false }))
				.pipe(promisifyStreamChunks(chunk => {
					
					return new Promise((resolve, reject) => {

						addToDb(
							chunk,
							err => {
								if (err) return reject(err);
								resolve();
							}
						);

					});

				}))
				.on('finish', () => {
					if (!error) resolve(db);
				});
			}

			amqplibup('amqp://' + config.amqpHost, conn => {
				conn.createChannel((err, ch) => {
					connection = conn;
					channel = ch;
					channel.assertQueue('', { exclusive: true }, (err, q) => {
						queue = q.queue;
						channel.assertExchange(config.exchangeName, 'fanout', { durable: true })
						channel.bindQueue(queue, config.exchangeName, ''); // Bind to events exchange.

						if (firstConnect) {
							// We should have a binded queue before we start
							// to fetch the http history, to avoid glitches.
							fetchHttpHistory();
							firstConnect = false;
						}

						channel.consume(queue, msg => {
							if (msg !== null) {
								let content;
								try {
									content = JSON.parse(msg.content.toString());
								} catch (err) {
									channel.ack(msg);
									return;
								}

								addToDb(
									content,
									err => {
										if (err) {
											console.error('Unhandled error:', err);
										}
										channel.ack(msg);
									}
								);
							}
						});
					});
				});
			});
		}
	);
});

function getPosition(position) {
	return init
	.then(db => {
		return new Promise((resolve, reject) => {
			
			let listener; 
			if (position > highestPosition) {
				listener = data => {
					resolve(data);
				};
				incomingEmitter.once(position + '', listener);
			}

			db.get(
				position + '',
				{
					fillCache: false,
					keyEncoding: 'utf8',
					valueEncoding: 'json',
				},
				(err, value) => {
					if (err) {
						// Don't do anything. We have a listener waiting for
						// the position to be emitted!
						return;
					}
					if (typeof listener !== 'undefined') {
						incomingEmitter.removeListener(position + '', listener);
					}
					resolve(value);
				}
			);
		});
	});
}

module.exports = {
	getPosition
};

