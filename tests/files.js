const disposableFile = require("disposablefile");
const files = require("../src/files");
const { now } = require("../src/time");
const path = require("path");
const { touch, findLogfiles, nextExistingLogfile, logfileForDate } = files;
const fs = require("fs");
const { promisify } = require("util");
const writeFile = promisify(fs.writeFile);
const {
  InvalidYearError,
  InvalidMonthError,
  InvalidDayError
} = require("../src/errors");

describe("files.js()", () => {
  describe("filenameTemplateInfo()", () => {
    it("should extract everything needed to identify eventlog files", () => {
      expect(
        files.filenameTemplateInfo("./data/eventlogs/%y/%m/%d.log")
      ).to.deep.equal({
        baseDir: "./data/eventlogs",
        yPos: 17,
        mPos: 22,
        dPos: 25,
        firstMatch: "%y",
        secondMatch: "%m",
        thirdMatch: "%d",
        matchSubstrings: [
          {
            start: 0,
            length: 17,
            str: "./data/eventlogs/"
          },
          {
            start: 21,
            length: 1,
            str: "/"
          },
          {
            start: 24,
            length: 1,
            str: "/"
          },
          {
            start: 27,
            length: 4,
            str: ".log"
          }
        ]
      });

      expect(
        files.filenameTemplateInfo("/mnt/disk/eventlogs/%d-%m-%y.log")
      ).to.deep.equal({
        baseDir: "/mnt/disk/eventlogs",
        yPos: 26,
        mPos: 23,
        dPos: 20,
        firstMatch: "%d",
        secondMatch: "%m",
        thirdMatch: "%y",
        matchSubstrings: [
          {
            start: 0,
            length: 20,
            str: "/mnt/disk/eventlogs/"
          },
          {
            start: 22,
            length: 1,
            str: "-"
          },
          {
            start: 25,
            length: 1,
            str: "-"
          },
          {
            start: 30,
            length: 4,
            str: ".log"
          }
        ]
      });
    });
  });

  describe("firstPositionInLogfile()", () => {
    expect(
      files.firstPositionInLogfile("event-2019-01-31.log", "event-%y-%m-%d")
    ).to.equal(2019013100000000);
  });

  describe("logfileDate()", () => {
    it("should return false on files not matching the template", () => {
      expect(
        files.logfileDate("event-2019-01-01.txt", "event-%y-%m-%d.log")
      ).to.equal(false);
    });

    it("should return false on dates that never existed", () => {
      expect(
        files.logfileDate("event-2019-13-01.txt", "event-%y-%m-%d.log")
      ).to.equal(false);
      expect(
        files.logfileDate("event-2019-12-32.txt", "event-%y-%m-%d.log")
      ).to.equal(false);
      expect(
        files.logfileDate("event-2019-02-29.txt", "event-%y-%m-%d.log")
      ).to.equal(false);
    });

    it("should return false on dates that never existed", () => {
      expect(
        files.logfileDate("event-2019-01-32.log", "event-%y-%m-%d.log")
      ).to.equal(false);
      expect(
        files.logfileDate("event-2019-02-29.log", "event-%y-%m-%d.log")
      ).to.equal(false);
      expect(
        files.logfileDate("event-2019-03-32.log", "event-%y-%m-%d.log")
      ).to.equal(false);
      expect(
        files.logfileDate("event-2019-04-31.log", "event-%y-%m-%d.log")
      ).to.equal(false);
      expect(
        files.logfileDate("event-2019-05-32.log", "event-%y-%m-%d.log")
      ).to.equal(false);
      expect(
        files.logfileDate("event-2019-06-31.log", "event-%y-%m-%d.log")
      ).to.equal(false);
      expect(
        files.logfileDate("event-2019-07-32.log", "event-%y-%m-%d.log")
      ).to.equal(false);
      expect(
        files.logfileDate("event-2019-08-32.log", "event-%y-%m-%d.log")
      ).to.equal(false);
      expect(
        files.logfileDate("event-2019-09-31.log", "event-%y-%m-%d.log")
      ).to.equal(false);
      expect(
        files.logfileDate("event-2019-10-32.log", "event-%y-%m-%d.log")
      ).to.equal(false);
      expect(
        files.logfileDate("event-2019-11-31.log", "event-%y-%m-%d.log")
      ).to.equal(false);
      expect(
        files.logfileDate("event-2019-12-32.log", "event-%y-%m-%d.log")
      ).to.equal(false);
      expect(
        files.logfileDate("event-2019-13-01.log", "event-%y-%m-%d.log")
      ).to.equal(false);
    });

    it("should return proper dates on %y %m %d order", () => {
      expect(
        files.logfileDate("event-2019-02-28.log", "event-%y-%m-%d.log")
      ).to.deep.equal({ year: 2019, month: 2, day: 28 });
    });

    it("should consider logfiles with dates in the future to be invalid", () => {
      const template = "data/%y/events-%d-%m.log";
      const currentTime = now();
      const filename =
        "data/" + (new Date().getFullYear() + 1) + "/events-31-01.log";
      expect(files.logfileDate(filename, template)).to.equal(false);
    });
  });

  describe("logfileForDate()", () => {
    it("should generate log filenames with has parseable dates", () => {
      const template = "events-%y-%m-%d";
      const filename = files.logfileForDate(1999, 5, 1, template);
      expect(files.logfileDate(filename, template)).to.deep.equal({
        year: 1999,
        month: 5,
        day: 1
      });
    });
    it("should generate log filenames with has parseable dates", () => {
      const template = "data/%y/events-%d-%m.log";
      const filename = files.logfileForDate(1999, 5, 1, template);
      expect(files.logfileDate(filename, template)).to.deep.equal({
        year: 1999,
        month: 5,
        day: 1
      });
    });
    it("should generate log filenames with has parseable dates", () => {
      const template = "events-%d-%m-%y.log";
      const filename = files.logfileForDate(1999, 5, 1, template);
      expect(files.logfileDate(filename, template)).to.deep.equal({
        year: 1999,
        month: 5,
        day: 1
      });
    });
    it("should throw error if year is invalid", () => {});
  });

  describe("findLogfiles()", () => {
    it("should return files with %y-%m-%d template in order", () => {
      return disposableFile.dir().then(tmpDir => {
        return touch(path.join(tmpDir, "events-2012-01-31.log"))
          .then(() => touch(path.join(tmpDir, "events-123-01-02.log")))
          .then(() => touch(path.join(tmpDir, "events-1979-05-25.log")))
          .then(() => touch(path.join(tmpDir, "event-1234-02-03.log")))
          .then(() => touch(path.join(tmpDir, "events-2016-08-21.log")))
          .then(() => touch(path.join(tmpDir, "events-1234-03-04.lo")))
          .then(() => touch(path.join(tmpDir, "events-1234-0-05.log")))
          .then(() => touch(path.join(tmpDir, "events-1984-02-04.log")))
          .then(() => touch(path.join(tmpDir, "events-1234-04-5.log")))
          .then(() => touch(path.join(tmpDir, "totally-unrelated.txt")))

          .then(() => findLogfiles(path.join(tmpDir, "events-%y-%m-%d.log")))
          .then(files => {
            expect(files).to.deep.equal([
              path.join(tmpDir, "events-1979-05-25.log"),
              path.join(tmpDir, "events-1984-02-04.log"),
              path.join(tmpDir, "events-2012-01-31.log"),
              path.join(tmpDir, "events-2016-08-21.log")
            ]);
          });
      });
    });

    it("should return files with %m-%y-%d template in order", () => {
      return disposableFile.dir().then(tmpDir => {
        return touch(path.join(tmpDir, "events-01-2012-31.log"))
          .then(() => touch(path.join(tmpDir, "events-01-123-02.log")))
          .then(() => touch(path.join(tmpDir, "events-05-1979-25.log")))
          .then(() => touch(path.join(tmpDir, "event-02-1234-03.log")))
          .then(() => touch(path.join(tmpDir, "events-08-2016-21.log")))
          .then(() => touch(path.join(tmpDir, "events-03-1234-04.lo")))
          .then(() => touch(path.join(tmpDir, "events-0-1234-05.log")))
          .then(() => touch(path.join(tmpDir, "events-02-1984-04.log")))
          .then(() => touch(path.join(tmpDir, "events-05-1234-5.log")))
          .then(() => touch(path.join(tmpDir, "totally-unrelated.txt")))

          .then(() => findLogfiles(path.join(tmpDir, "events-%m-%y-%d.log")))
          .then(files => {
            expect(files).to.deep.equal([
              path.join(tmpDir, "events-05-1979-25.log"),
              path.join(tmpDir, "events-02-1984-04.log"),
              path.join(tmpDir, "events-01-2012-31.log"),
              path.join(tmpDir, "events-08-2016-21.log")
            ]);
          });
      });
    });

    it("should return files with %d-%y-%m template in order", () => {
      return disposableFile.dir().then(tmpDir => {
        return touch(path.join(tmpDir, "events-31-2012-01.log"))
          .then(() => touch(path.join(tmpDir, "events-02-123-01.log")))
          .then(() => touch(path.join(tmpDir, "events-25-1979-05.log")))
          .then(() => touch(path.join(tmpDir, "event-03-1234-02.log")))
          .then(() => touch(path.join(tmpDir, "events-21-2016-08.log")))
          .then(() => touch(path.join(tmpDir, "events-04-1234-03.lo")))
          .then(() => touch(path.join(tmpDir, "events-05-1234-0.log")))
          .then(() => touch(path.join(tmpDir, "events-04-1984-02.log")))
          .then(() => touch(path.join(tmpDir, "events-5-1234-05.log")))
          .then(() => touch(path.join(tmpDir, "totally-unrelated.txt")))

          .then(() => findLogfiles(path.join(tmpDir, "events-%d-%y-%m.log")))
          .then(files => {
            expect(files).to.deep.equal([
              path.join(tmpDir, "events-25-1979-05.log"),
              path.join(tmpDir, "events-04-1984-02.log"),
              path.join(tmpDir, "events-31-2012-01.log"),
              path.join(tmpDir, "events-21-2016-08.log")
            ]);
          });
      });
    });

    it("should return files with %m-%d-%y template in order", () => {
      return disposableFile.dir().then(tmpDir => {
        return touch(path.join(tmpDir, "events-01-31-2012.log"))
          .then(() => touch(path.join(tmpDir, "events-01-02-123.log")))
          .then(() => touch(path.join(tmpDir, "events-05-25-1979.log")))
          .then(() => touch(path.join(tmpDir, "event-02-03-1234.log")))
          .then(() => touch(path.join(tmpDir, "events-08-21-2016.log")))
          .then(() => touch(path.join(tmpDir, "events-03-04-1234.lo")))
          .then(() => touch(path.join(tmpDir, "events-0-05-1234.log")))
          .then(() => touch(path.join(tmpDir, "events-02-04-1984.log")))
          .then(() => touch(path.join(tmpDir, "events-05-5-1234.log")))
          .then(() => touch(path.join(tmpDir, "totally-unrelated.txt")))

          .then(() => findLogfiles(path.join(tmpDir, "events-%m-%d-%y.log")))
          .then(files => {
            expect(files).to.deep.equal([
              path.join(tmpDir, "events-05-25-1979.log"),
              path.join(tmpDir, "events-02-04-1984.log"),
              path.join(tmpDir, "events-01-31-2012.log"),
              path.join(tmpDir, "events-08-21-2016.log")
            ]);
          });
      });
    });

    it("should return files with %d-%m-%y template in order", () => {
      return disposableFile.dir().then(tmpDir => {
        return touch(path.join(tmpDir, "events-31-01-2012.log"))
          .then(() => touch(path.join(tmpDir, "events-02-01-123.log")))
          .then(() => touch(path.join(tmpDir, "events-25-05-1979.log")))
          .then(() => touch(path.join(tmpDir, "event-03-02-1234.log")))
          .then(() => touch(path.join(tmpDir, "events-21-08-2016.log")))
          .then(() => touch(path.join(tmpDir, "events-04-03-1234.lo")))
          .then(() => touch(path.join(tmpDir, "events-05-0-1234.log")))
          .then(() => touch(path.join(tmpDir, "events-04-02-1984.log")))
          .then(() => touch(path.join(tmpDir, "events-5-05-1234.log")))
          .then(() => touch(path.join(tmpDir, "totally-unrelated.txt")))

          .then(() => findLogfiles(path.join(tmpDir, "events-%d-%m-%y.log")))
          .then(files => {
            expect(files).to.deep.equal([
              path.join(tmpDir, "events-25-05-1979.log"),
              path.join(tmpDir, "events-04-02-1984.log"),
              path.join(tmpDir, "events-31-01-2012.log"),
              path.join(tmpDir, "events-21-08-2016.log")
            ]);
          });
      });
    });
  });

  describe("nextExistingLogfile()", () => {
    it("should resolve logfile the date, and if that does not exist, nearest logfile in future", () => {
      return disposableFile.dir().then(tmpDir => {
        return touch(path.join(tmpDir, "events-2012-01-31.log"))
          .then(() => touch(path.join(tmpDir, "events-123-01-02.log")))
          .then(() => touch(path.join(tmpDir, "events-1979-05-25.log")))
          .then(() => touch(path.join(tmpDir, "event-1234-02-03.log")))
          .then(() => touch(path.join(tmpDir, "events-2016-08-21.log")))
          .then(() => touch(path.join(tmpDir, "events-1234-03-04.lo")))
          .then(() => touch(path.join(tmpDir, "events-1234-0-05.log")))
          .then(() => touch(path.join(tmpDir, "events-1984-02-04.log")))
          .then(() => touch(path.join(tmpDir, "events-1234-04-5.log")))
          .then(() => touch(path.join(tmpDir, "totally-unrelated.txt")))

          .then(() => {
            return nextExistingLogfile(
              logfileForDate(
                2012,
                1,
                30,
                path.join(tmpDir, "events-%y-%m-%d.log")
              ),
              path.join(tmpDir, "events-%y-%m-%d.log")
            );
          })
          .then(file => {
            expect(file).to.equal(path.join(tmpDir, "events-2012-01-31.log"));
          })

          .then(() => {
            return nextExistingLogfile(
              logfileForDate(
                2012,
                1,
                31,
                path.join(tmpDir, "events-%y-%m-%d.log")
              ),
              path.join(tmpDir, "events-%y-%m-%d.log")
            );
          })
          .then(file => {
            expect(file).to.equal(path.join(tmpDir, "events-2016-08-21.log"));
          })

          .then(() => {
            return nextExistingLogfile(
              logfileForDate(
                1977,
                4,
                15,
                path.join(tmpDir, "events-%y-%m-%d.log")
              ),
              path.join(tmpDir, "events-%y-%m-%d.log")
            );
          })
          .then(file => {
            expect(file).to.equal(path.join(tmpDir, "events-1979-05-25.log"));
          })

          .then(() => {
            return nextExistingLogfile(
              logfileForDate(
                1979,
                5,
                24,
                path.join(tmpDir, "events-%y-%m-%d.log")
              ),
              path.join(tmpDir, "events-%y-%m-%d.log")
            );
          })
          .then(file => {
            expect(file).to.equal(path.join(tmpDir, "events-1979-05-25.log"));
          })

          .then(() => {
            return nextExistingLogfile(
              logfileForDate(
                1979,
                5,
                25,
                path.join(tmpDir, "events-%y-%m-%d.log")
              ),
              path.join(tmpDir, "events-%y-%m-%d.log")
            );
          })
          .then(file => {
            expect(file).to.equal(path.join(tmpDir, "events-1984-02-04.log"));
          })

          .then(() => touch(path.join(tmpDir, "events-31-2012-01.log")))
          .then(() => touch(path.join(tmpDir, "events-02-123-01.log")))
          .then(() => touch(path.join(tmpDir, "events-25-1979-05.log")))
          .then(() => touch(path.join(tmpDir, "event-03-1234-02.log")))
          .then(() => touch(path.join(tmpDir, "events-21-2016-08.log")))
          .then(() => touch(path.join(tmpDir, "events-04-1234-03.lo")))
          .then(() => touch(path.join(tmpDir, "events-05-1234-0.log")))
          .then(() => touch(path.join(tmpDir, "events-04-1984-02.log")))
          .then(() => touch(path.join(tmpDir, "events-5-1234-04.log")))

          .then(() => {
            return nextExistingLogfile(
              logfileForDate(
                2012,
                1,
                30,
                path.join(tmpDir, "events-%d-%y-%m.log")
              ),
              path.join(tmpDir, "events-%d-%y-%m.log")
            );
          })
          .then(file => {
            expect(file).to.equal(path.join(tmpDir, "events-31-2012-01.log"));
          })

          .then(() => {
            return nextExistingLogfile(
              logfileForDate(
                2012,
                1,
                31,
                path.join(tmpDir, "events-%d-%y-%m.log")
              ),
              path.join(tmpDir, "events-%d-%y-%m.log")
            );
          })
          .then(file => {
            expect(file).to.equal(path.join(tmpDir, "events-21-2016-08.log"));
          })

          .then(() => {
            return nextExistingLogfile(
              logfileForDate(
                1977,
                4,
                15,
                path.join(tmpDir, "events-%d-%y-%m.log")
              ),
              path.join(tmpDir, "events-%d-%y-%m.log")
            );
          })
          .then(file => {
            expect(file).to.equal(path.join(tmpDir, "events-25-1979-05.log"));
          })

          .then(() => {
            return nextExistingLogfile(
              logfileForDate(
                1979,
                5,
                24,
                path.join(tmpDir, "events-%d-%y-%m.log")
              ),
              path.join(tmpDir, "events-%d-%y-%m.log")
            );
          })
          .then(file => {
            expect(file).to.equal(path.join(tmpDir, "events-25-1979-05.log"));
          })

          .then(() => {
            return nextExistingLogfile(
              logfileForDate(
                1979,
                5,
                26,
                path.join(tmpDir, "events-%d-%y-%m.log")
              ),
              path.join(tmpDir, "events-%d-%y-%m.log")
            );
          })
          .then(file => {
            expect(file).to.equal(path.join(tmpDir, "events-04-1984-02.log"));
          });
      });
    });
  });
});
