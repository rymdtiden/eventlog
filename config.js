module.exports = {
	amqpHost: process.env.AMQPHOST || 'localhost',
	debugEnabled: process.env.DEBUG ? true : false,
	exchangeName: process.env.EXCHANGENAME || 'events',
	httpPort: process.env.PORT || 80,
	queueName: process.env.EVENTS || 'events',
	storageFile: process.env.STORAGEFILE || './storage'
}


