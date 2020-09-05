const debug = require("debug");
const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const time = require("./time");
const {
  InvalidYearError,
  InvalidMonthError,
  InvalidDayError,
  TimeIsInFutureError
} = require("./errors");
const log = debug("eventlog:files");

const open = promisify(fs.open);
const close = promisify(fs.close);
const stat = promisify(fs.stat);
const readdir = promisify(fs.readdir);
const mkdir = promisify(fs.mkdir);

function findLogfiles(filenameTemplate) {
  log("Recursively searching for existing log files...");
  const { baseDir } = filenameTemplateInfo(filenameTemplate);

  const dateFileMap = {};

  function recursiveFileSearch(dir) {
    return readdir(dir)
      .then(files => {
        return files.reduce((promise, file) => {
          return promise
            .then(() => stat(path.join(dir, file)))
            .then(stat => {
              if (stat.isDirectory()) {
                return recursiveFileSearch(path.join(dir, file));
              } else if (stat.isFile()) {
                const date = logfileDate(
                  path.join(dir, file),
                  filenameTemplate
                );
                //, path.join(dir, file), typeof date);
                if (date !== false) {
                  dateFileMap[
                    date.year * 10000 + date.month * 100 + date.day
                  ] = path.join(dir, file);
                }
              }
            })
            .catch(() => {});
        }, Promise.resolve());
      })
      .catch(err => {
        if (err.code !== "ENOENT") {
          throw err;
        }
      });
  }

  return recursiveFileSearch(baseDir).then(() =>
    Object.keys(dateFileMap)
      .sort()
      .map(key => dateFileMap[key])
  );
}

function filenameTemplateInfo(filenameTemplate) {
  const ySplit = filenameTemplate.split("%y");
  const mSplit = filenameTemplate.split("%m");
  const dSplit = filenameTemplate.split("%d");
  if (ySplit.length !== 2 || mSplit.length !== 2 || dSplit.length !== 2) {
    throw new Error("The filenameTemplate must contain %y %m and %d once.");
  }

  const yPos = ySplit[0].length;
  const mPos = mSplit[0].length;
  const dPos = dSplit[0].length;

  const yOrder =
    yPos < mPos && yPos < dPos
      ? 1
      : yPos < mPos && yPos > dPos
      ? 2
      : yPos > mPos && yPos < dPos
      ? 2
      : 3;
  const mOrder =
    mPos < yPos && mPos < dPos
      ? 1
      : mPos < yPos && mPos > dPos
      ? 2
      : mPos > yPos && mPos < dPos
      ? 2
      : 3;
  const dOrder =
    dPos < yPos && dPos < mPos
      ? 1
      : dPos < yPos && dPos > mPos
      ? 2
      : dPos > yPos && dPos < mPos
      ? 2
      : 3;

  const firstMatch = yOrder === 1 ? "%y" : mOrder === 1 ? "%m" : "%d";
  const secondMatch = yOrder === 2 ? "%y" : mOrder === 2 ? "%m" : "%d";
  const thirdMatch = yOrder === 3 ? "%y" : mOrder === 3 ? "%m" : "%d";

  const matchSubstrings = [
    {
      start: 0,
      length: filenameTemplate.indexOf(firstMatch)
    },
    {
      start: filenameTemplate.indexOf(firstMatch) + 2,
      length:
        filenameTemplate.indexOf(secondMatch) -
        filenameTemplate.indexOf(firstMatch) -
        2
    },
    {
      start: filenameTemplate.indexOf(secondMatch) + 2,
      length:
        filenameTemplate.indexOf(thirdMatch) -
        filenameTemplate.indexOf(secondMatch) -
        2
    },
    {
      start: filenameTemplate.indexOf(thirdMatch) + 2,
      length: filenameTemplate.length - filenameTemplate.indexOf(thirdMatch) - 2
    }
  ].map(match => {
    return {
      ...match,
      str: filenameTemplate.substr(match.start, match.length)
    };
  });

  const baseDir = path.dirname(
    filenameTemplate.split(firstMatch)[0] + "alfredwashere"
  );

  return {
    matchSubstrings: matchSubstrings.map(substr => {
      return {
        start: substr.start + (yPos < substr.start ? 2 : 0),
        length: substr.length,
        str: substr.str
      };
    }),
    yPos,
    mPos: mPos + (yPos < mPos ? 2 : 0),
    dPos: dPos + (yPos < dPos ? 2 : 0),
    firstMatch,
    secondMatch,
    thirdMatch,
    baseDir
  };
}

function logfileDate(filename, filenameTemplate) {
  const templateInfo = filenameTemplateInfo(filenameTemplate);

  const substrsMatching = templateInfo.matchSubstrings.reduce(
    (valid, substr) =>
      valid && filename.substr(substr.start, substr.length) === substr.str,
    true
  );

  if (!substrsMatching) return false;

  const yearStr = filename.substr(templateInfo.yPos, 4);
  const monthStr = filename.substr(templateInfo.mPos, 2);
  const dayStr = filename.substr(templateInfo.dPos, 2);

  try {
    const { year, month, day } = validatedDate(yearStr, monthStr, dayStr);
    return { year, month, day };
  } catch (err) {
    return false;
  }
}

function firstPositionInLogfile(filename, filenameTemplate) {
  const { year, month, day } = logfileDate(filename, filenameTemplate);
  return year * 1000000000000 + month * 10000000000 + day * 100000000;
}

function existingLogfileByPosition(position, filenameTemplate) {
  const logfile = logfileForPosition(position, filenameTemplate);
  return findLogfiles(filenameTemplate).then(files => {
    if (files.length === 0) return;
    if (files.indexOf(logfile) !== -1) {
      return logfile;
    } else {
      return nextExistingLogfile(logfile, filenameTemplate);
    }
  });
}

function validatedDate(year, month, day) {
  year = parseInt(year);
  month = parseInt(month);
  day = parseInt(day);

  if (!("" + year).match(/^[0-9]{4}$/)) throw new InvalidYearError();
  if (!("" + month).match(/^[0-9]{1,2}$/)) throw new InvalidMonthError();
  if (!("" + day).match(/^[0-9]{1,2}$/)) throw new InvalidDayError();

  if (year < 1970 || year > 9999) throw new InvalidYearError();
  if (month < 1 || month > 12) throw new InvalidMonthError();
  if (
    day < 1 ||
    day >
      [
        31,
        (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0 ? 29 : 28,
        31,
        30,
        31,
        30,
        31,
        31,
        30,
        31,
        30,
        31
      ][month - 1]
  )
    throw new InvalidDayError();

  // A logfile for a day in the future should not be considered valid,
  // since that cannot be a log of something that has happened (because it is in the future):
  const currentTime = time.now();
  if (year > currentTime.year) {
    // console.log(year, month, day, currentTime);
    throw new TimeIsInFutureError();
  }
  if (year === currentTime.year && month > currentTime.month)
    throw new TimeIsInFutureError();
  if (
    year === currentTime.year &&
    month === currentTime.month &&
    day > currentTime.day
  )
    throw new TimeIsInFutureError();

  return { year, month, day };
}

function logfileForDate(y, m, d, filenameTemplate) {
  const { year, month, day } = validatedDate(y, m, d);
  const templateInfo = filenameTemplateInfo(filenameTemplate);
  return (
    templateInfo.matchSubstrings[0].str +
    (templateInfo.firstMatch === "%y"
      ? year
      : ("00" + (templateInfo.firstMatch === "%m" ? month : day)).slice(-2)) +
    templateInfo.matchSubstrings[1].str +
    (templateInfo.secondMatch === "%y"
      ? year
      : ("00" + (templateInfo.secondMatch === "%m" ? month : day)).slice(-2)) +
    templateInfo.matchSubstrings[2].str +
    (templateInfo.thirdMatch === "%y"
      ? year
      : ("00" + (templateInfo.thirdMatch === "%m" ? month : day)).slice(-2)) +
    templateInfo.matchSubstrings[3].str
  );
}

function logfileForPosition(position, filenameTemplate) {
  const { year, month, day } = time.dateFromPosition(position);
  return logfileForDate(year, month, day, filenameTemplate);
}

function logfileForToday(filenameTemplate) {
  const { year, month, day } = time.now();
  return logfileForDate(year, month, day, filenameTemplate);
}

function nextExistingLogfile(afterLogfile, filenameTemplate) {
  // TODO: If there are just a few days between current date and the
  // afterLogfile date, we should probably just check for the files that
  // could be in between, instead of scanning the entire directory tree.

  let date;
  try {
    date = logfileDate(afterLogfile, filenameTemplate);
  } catch (err) {
    log(
      "Invalid afterLogfile when trying to nextExistingLogfile(): %s",
      afterLogfile
    );
    log("Current date: %o", time.now());
    return Promise.resolve();
  }
  log("Looking for first logfile from %o", date);
  const { year, month, day } = date;
  return findLogfiles(filenameTemplate).then(logfiles => {
    const dateFileMap = logfiles.reduce((dateFileMap, logfile) => {
      const filedate = logfileDate(logfile, filenameTemplate);
      if (
        filedate.year > year ||
        (filedate.year === year && filedate.month > month) ||
        (filedate.year === year &&
          filedate.month === month &&
          filedate.day > day)
      ) {
        return {
          ...dateFileMap,
          [filedate.year * 10000 + filedate.month * 100 + filedate.day]: logfile
        };
      }
      return dateFileMap;
    }, {});
    return dateFileMap[Object.keys(dateFileMap).sort()[0]];
  });
}

function touch(filename) {
  log("Creating file %s", filename);
  return mkdir(path.dirname(path.resolve(process.cwd(), filename)), {
    recursive: true
  })
    .then(() => open(filename, "a"))
    .then(fileDescriptor => close(fileDescriptor));
}

module.exports = {
  existingLogfileByPosition,
  filenameTemplateInfo,
  findLogfiles,
  firstPositionInLogfile,
  logfileDate,
  logfileForDate,
  logfileForToday,
  nextExistingLogfile,
  touch
};
