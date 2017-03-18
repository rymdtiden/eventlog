const amqp = require('amqplibup');
const exec = require('child_process').exec;
const fs = require('fs');
const http = require('http');
const Promise = require('bluebird');

const amqpHost = process.env.AMQPHOST || 'localhost';
const exchangeName = process.env.EXCHANGENAME || 'events';
const httpPort = process.env.PORT || 80;
const queueName = process.env.EVENTS || 'events';
const storageFile = process.env.STORAGEFILE || './storage';

function countStorageLines() {
	return new Promise((resolve, reject) => {
		fs.exists(storageFile, exists => {
			if (!exists) return resolve(0);
			exec('wc -l "' + storageFile + '"', (err, lines) => {
				if (err) return reject(err);
				resolve(lines);
			});
		});
	});
}

countStorageLines()
.then(lines => {

	let position = lines;
	
	amqp('amqp://' + amqpHost, conn => {
		conn.createChannel((err, ch) => {

			if (err) return console.error('Failed to create channel:', err.message);

			ch.prefetch(1);
			ch.assertExchange(exchangeName, 'fanout', { durable: true })
			ch.assertQueue(queueName, { durable: true });
			ch.consume(queueName, msg => {

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
					
					try {
						fs.appendFileSync(storageFile, stringified + "\n");
					} catch (err) {
						// Something went wrong.
						// Make data undefined, so we can return an error.
						delete data;
					}

					ch.publish(
						exchangeName,
						'',
						new Buffer(stringified),
						{
							correlationId: msg.properties.correlationId
						}
					);
				}

				// If there is a replyTo in the message, then reply with the position:
				if (msg.properties.replyTo) {

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
			console.log('Consuming queue:', queueName);

		});
	});

	const server = http.createServer((req, res) => {
		fs.exists(storageFile, exists => {
			const stream = fs.createReadStream(storageFile);
			stream.on('open', () => stream.pipe(res));
			stream.on('error', () => res.end());
		});
	});
	server.listen(httpPort);

})
.catch(err => {
	console.error(err);
	process.exit(1);
});

