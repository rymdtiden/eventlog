[![Build Status](https://semaphoreci.com/api/v1/houseagency/eventstore/branches/master/badge.svg)](https://semaphoreci.com/houseagency/eventstore)

eventstore
==========

Listens to a RabbitMQ queue for event messages. Each event message will get
a "position number" (which is an uniqe incremental id) and be appended to a
log/storage file. After properly numbered and stored, the event message will
be published (with the position number) to an AMQP fanout exchange.

The event messages must be JSON.

If an event messages has a `replyTo` property, the position number will be
returned back, or `-1` will be returned if there was an error (like broken
JSON).


get history over http
---------------------

To download all events messages, just make an HTTP request!
(We don't check HTTP method, path or anything. Just make a request!)

The event messages are JSON blobs separated by line break.


environment vars
----------------

* `AMQPHOST` - The domain/hostname/ip to connect to. Default is `localhost`.
* `EXCHANGENAME` - The AMQP exchange to publish to. Default is `events`.
* `PORT` - Listen on this port for http requests. Default is `80`.
* `QUEUENAME` - The AMQP queue to consume. Default is `events`.
* `STORAGEFILE` - The file path to save event messages to. Default is `./storage`.


roadmap
-------

* Different AMQP servers for the consuming queue and the fanout. (For future
  scaling.)
* Rotation of the storage file. Maybe pushing old storage files to AWS S3 or
  such services.

