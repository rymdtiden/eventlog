eventlog
========

Append-only local data store, made for event sourcing.

All your events will be added to logfiles (for persistent storage),
as JSON blobs (one event/JSON blob per row).

Events are written to logfiles with the current date in the filename, so each
individual logfile will not grow larger than what is needed for one day's
events.

You don't have to keep more than one day of history, if you do not have to
process those events again.

how to use
----------

```
const eventlog = require("eventlog");
const { add, consume } = eventlog("data/events-%y-%m-%d.log");

// To add events to the event log:
add({ type: "someevent", id: 1337, customstuff: "anything you' like!" });

// To consume events:
consume((event, meta) => {
	// Do whatever.
	// Return a promise if you want to block more events.
	// No events will be emitted until the promise resolves/rejects.
});
```

functions
---------

### eventlog(filenamePattern)

Where `filenamePattern` is the path to where logfiles will be written. It must
contain the substrings `%y`, `%m` and `%d`, which will be replaced by the
year, month and day. Example: `data/events-%y-%m-%d.log`

Will return `{ add, consume }`.

Both `add` and `consume` are functions. See documentation for those below.

### add(eventObj)

Where `eventObj` is a json-stringify:able object.

Returns `{ id, logfile, promise }`

* `id` is a unique random string identifying the event you just added.
* `logfile` is the file path to the logfile that the event was written to.
* `promise` is a `Promise` that will resolve when the write to disk is verified
  and the event has been given a position.

The `promise` resolves with this object `{ id, pos, prevPos }`.

* `id` is the same `id` as returned from `add()`.
* `pos` is the position number for this event.
* `prevPos` is the position number for the previous event. If the event is the
  first ever written, `prevPos` will be `undefined`.

### consume(callback, fromPosition)

Where `callback` is the a function to be called for every event. `fromPosition`
is the starting position from where events will be consumed.

The `callback` function will be called with the arguments:
`callback(eventObj, meta);` where `eventObj` is the event that was added with
the `add()` function. `meta` is an object with metadata for the event:
`{ id, pos, prevPos }`.

event positions
---------------

Every event will be enumbered with an unique number, which determines the
order of the events.

Event numbers are 16 digits long. The first four digits are the year of the
event, the next two are the month and the comes to digits which are the day.
The following eight digits are just an incremental number for that day,
starting with `00000000` for every day.

So the first event on 31 of January 1984 is `1984013100000000` and the second
event that day is `1984013100000001`.

limits
------

* Maximum 100 million events per day.

roadmap
-------

* Upload historic logfiles to AWS S3, and streaming events from there when you
  need to replay your history.
* Better support for multiple processes. Today, multipe processes can write to
  the same log without risk for data corruption, as long as the events are 
  small enough (4096 bytes on Linux) and your filsystem is POSIX compatible.
  This is just a rudimentary support for multiple processes working with the
  samt files. We would need a proper locking mechanism to better support
  multiple processes adding events. Multiple processes just reading/consuming
  events is 100% safe already.
  
