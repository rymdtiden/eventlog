[![Build Status](https://semaphoreci.com/api/v1/houseagency/eventstore/branches/master/badge.svg)](https://semaphoreci.com/houseagency/eventstore)

eventstore
==========

This is an event sourcing CQRS framework for nodejs and rabbitmq.
It consists of:

* A server listening to a RabbitMQ queue for event messages. Each event message
  will get a "position number" (which is an uniqe incremental id) and be
  appended to a log/storage file. After properly numbered and stored, the event
  message will be re-published (with the position number) to an AMQP fanout
  exchange.
* A javascript module for publishing new events.
* A javascript module for fetching events.


some generic principles
-----------------------

* The event messages must be JSON.


the server
----------

### get history over http

To download all events messages, just make an HTTP request to the server!
(We don't check HTTP method, path or anything. Just make a request!)

The event messages are JSON blobs separated by line break.


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

* `HISTORY_URL` - Url to the http interface of the server (to get historic
  events).


roadmap
-------

* Different AMQP servers for the consuming queue and the fanout. (For future
  scaling.)
* Rotation of the storage file. Maybe pushing old storage files to AWS S3 or
  such services.

