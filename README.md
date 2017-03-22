[![Build Status](https://semaphoreci.com/api/v1/houseagency/eventstore/branches/master/badge.svg)](https://semaphoreci.com/houseagency/eventstore)

rabbit-eventstore
=================

This is an event sourcing CQRS framework for nodejs and rabbitmq.
It consists of:

* A server listening to a RabbitMQ queue for event messages. Each event message
  will get a "position number" (which is an uniqe incremental id) and be
  appended to a log/storage file. After properly numbered and stored, the event
  message will be re-published (with the position number) to an AMQP fanout
  exchange.
* A javascript module for publishing new events. ("The command.")
* A javascript module for fetching events. ("The listener.")


some generic principles
-----------------------

* The event messages must be JSON.


the server
----------

### get history over http

To download all events messages, just make an HTTP request to the server!
(We don't check HTTP method, path or anything. Just make a request!)

The event messages are JSON blobs separated by line break.


the listener
------------

The listener will fetch historic events from the position you give, and listen
to new events. They will come in strict order!

```javascript
const listener = require('rabbit-eventstore/listener');

// Start fetching events from position 50:
listener.listen(50, msg => {
  console.log('Incoming event:', msg);
});

// Start fetching events from the beginning of time:
listener.listen(0, msg => {
  console.log('Incoming event:', msg);
});

// Just fetch new events (from now on):
listener.listen(msg => {
  console.log('Incoming event:', msg);
});
```

If you are returning a promise from them listen callback, the next message will
not be fetched until you resolve the promise.


environment vars
----------------

### for the server and the javascript modules

* `AMQPHOST` - The domain/hostname/ip to connect to. Default is `localhost`.
* `DEBUG` - Set to something truthy to output debug messages to stdout.
* `EXCHANGENAME` - The AMQP exchange to publish to. Default is `events`.
* `QUEUENAME` - The AMQP queue to consume. Default is `events`.

### for the server only

* `PORT` - Listen on this port for http requests. Default is `80`.
* `STORAGEFILE` - The file path to save event messages to. Default is `./storage`.

### for the consumer javascript module

* `HISTORYURL` - Url to the http interface of the server (to get historic
  events). Default is `http://localhost/`.


roadmap
-------

* Different AMQP servers for the consuming queue and the fanout. (For future
  scaling.)
* Rotation of the storage file. Maybe pushing old storage files to AWS S3 or
  such services.

