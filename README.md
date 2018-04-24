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

limits
------

* Maximum 100 million events per day.

Roadmap
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
  
