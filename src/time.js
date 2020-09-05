const debug = require("debug");
const log = debug("eventlog:time");
const EventEmitter = require("events");

function dateFromPosition(position) {
  if (
    !position ||
    typeof position !== "number" ||
    position % 1 !== 0 ||
    position < 1970010100000000
  ) {
    return { year: 1970, month: 1, day: 1 };
  }
  const year = parseInt(("" + position).substr(0, 4));
  const month = parseInt(("" + position).substr(4, 2));
  const day = parseInt(("" + position).substr(6, 2));
  return { year, month, day };
}

function now() {
  const date = new Date();
  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  };
}

const time = new EventEmitter();
time.setMaxListeners(0);
time.dateFromPosition = dateFromPosition;
time.now = now;

(() => {
  const { year, month, day } = time.now();
  let currentYear = year;
  let currentMonth = month;
  let currentDay = day;

  setInterval(() => {
    const { year, month, day } = time.now();
    if (year !== currentYear || month !== currentMonth || day !== currentDay) {
      const previousYear = currentYear;
      const previousMonth = currentMonth;
      const previousDay = currentDay;
      currentYear = year;
      currentMonth = month;
      currentDay = day;

      log(
        "Date change identified %d-%d-%d => %d-%d-%d",
        previousYear,
        previousMonth,
        previousDay,
        year,
        month,
        day
      );

      time.emit("dateChange", {
        newTime: { year, month, day },
        oldTime: { year: previousYear, month: previousMonth, day: previousDay }
      });
    }
  }, 100).unref();
})();

module.exports = time;
