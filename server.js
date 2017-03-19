const amqp = require('amqplibup');
const config = require('./config');
const exec = require('child_process').exec;
const fs = require('fs');
const http = require('http');
const Promise = require('bluebird');

function countStorageLines() {
	return new Promise((resolve, reject) => {
		fs.exists(config.storageFile, exists => {
			if (!exists) return resolve(0);
			exec('wc -l "' + config.storageFile + '"', (err, lines) => {
				if (err) return reject(err);
				resolve(lines);
			});
		});
	});
}

let logger = { log: () => { } };
if (config.debugEnabled) logger = console;

countStorageLines()
.then(lines => {

	let position = lines;
	
	amqp('amqp://' + config.amqpHost, conn => {
		logger.log('Connected!');

		conn.createChannel((err, ch) => {
			logger.log('Created channel.');

			if (err) return logger.log('Failed to create channel:', err.message);

			ch.prefetch(1);
			ch.assertExchange(config.exchangeName, 'fanout', { durable: true })
			ch.assertQueue(config.queueName, { durable: true });
			ch.consume(config.queueName, msg => {
				logger.log('Incoming message.');

				// Try to parse the message:
				let data;
				try {
					data = JSON.parse(msg.content.toString());
				} catch (err) {
					// JSON is broken.
					// console.log(err);

				}

				// If the message was parseable:
				if (typeof data !== 'undefined') {

					// Add position to the data:
					data = {
						pos: position++,
						time: (new Date()).toISOString(),
						event: data
					};
					
					let stringified = JSON.stringify(data);

					logger.log('The message:', stringified);
					
					try {
						fs.appendFileSync(config.storageFile, stringified + "\n");
					} catch (err) {
						// Something went wrong.
						// Make data undefined, so we can return an error.
						delete data;
					}

					ch.publish(
						config.exchangeName,
						'',
						new Buffer(stringified),
						{
							correlationId: msg.properties.correlationId
						}
					);
				}

				// If there is a replyTo in the message, then reply with the position:
				if (msg.properties.replyTo) {

					logger.log('Message has replyTo.');

					let reply;
					if (typeof data !== 'undefined') {
						response = data.pos.toString();
					} else {
						response = -1; // -1 means error!
					}

					ch.sendToQueue(
						msg.properties.replyTo,
						new Buffer(response.toString()),
						{
							correlationId: msg.properties.correlationId
						}
					);

				}

				//
				// Ack message:
				ch.ack(msg);
			});
			console.log('Consuming queue:', config.queueName);

		});
	});

	const server = http.createServer((req, res) => {
		fs.exists(config.storageFile, exists => {
			const stream = fs.createReadStream(config.storageFile);
			stream.on('open', () => stream.pipe(res));
			stream.on('error', () => res.end());
		});
	});
	server.listen(config.httpPort);

})
.catch(err => {
	console.error(err);
	process.exit(1);
});

