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
  
