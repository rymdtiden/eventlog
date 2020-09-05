const disposableFile = require("disposablefile");
const files = require("../src/files");
const { logfileForToday } = files;
const fs = require("fs");
const { setTimeAndWaitUntilItIsApplied } = require("./helper");
const path = require("path");
const reader = require("../src/reader");
const td = require("testdouble");
const writer = require("../src/writer");

describe("reader.js", () => {
  describe("consume()", () => {
    it("should be able to start reading from non-existing directory", () => {
      const dir = path.join(disposableFile.dirSync(), "foo", "bar");
      const filenameTemplate = path.join(dir, "events-%y-%m-%d.log");

      const { consume } = reader(filenameTemplate);

      const log = [];
      const { promise, stop } = consume((event, meta) => {
        log.push({ event, meta });
      });
      return promise
        .then(() => new Promise(resolve => setTimeout(resolve, 50)))
        .then(() => {
          const { add, stop } = writer(filenameTemplate);
          return add({ type: "justatest" }).promise.then(stop);
        })
        .then(() => new Promise(resolve => setTimeout(resolve, 50)))
        .then(() => {
          expect(log.length).to.equal(1);
          expect(log[0].event.type).to.equal("justatest");
          expect(log[0].meta.pos).to.be.a("number");
          expect(log[0].meta.prevPos).to.be.an("undefined");
        })
        .finally(() => stop());
    });

    it("should read all events from an existing logfile and be able to continue", function() {
      this.timeout(10000);
      const filenameTemplate = path.join(
        disposableFile.dirSync(),
        "events%y%m%d.log"
      );
      const { add, stop } = writer(filenameTemplate);
      return add({ type: "first" })
        .promise.then(() => add({ type: "second" }).promise)
        .then(() => add({ type: "third" }).promise)
        .then(() => add({ type: "fourth" }).promise)
        .then(() => add({ type: "fifth" }).promise)
        .then(() => {
          const { consume } = reader(filenameTemplate);
          const log = [];

          const { stop } = consume((event, meta) => log.push({ event, meta }));

          return new Promise(resolve => setTimeout(resolve, 100))
            .then(() => {
              expect(log[0].event.type).to.equal("first");
              expect(log[1].event.type).to.equal("second");
              expect(log[2].event.type).to.equal("third");
              expect(log[3].event.type).to.equal("fourth");
              expect(log[4].event.type).to.equal("fifth");

              expect(log[0].meta.prevPos).to.be.an("undefined");
              expect(log[1].meta.prevPos).to.equal(log[0].meta.pos);
              expect(log[2].meta.prevPos).to.equal(log[1].meta.pos);
              expect(log[3].meta.prevPos).to.equal(log[2].meta.pos);
              expect(log[4].meta.prevPos).to.equal(log[3].meta.pos);

              expect(log.length).to.equal(5);

              return new Promise(resolve => setTimeout(resolve, 100));
            })
            .then(() => add({ type: "sixth" }).promise)
            .then(() => add({ type: "seventh" }).promise)
            .then(() => add({ type: "eighth" }).promise)
            .then(() => new Promise(resolve => setTimeout(resolve, 100)))
            .then(() => {
              expect(log[5].event.type).to.equal("sixth");
              expect(log[6].event.type).to.equal("seventh");
              expect(log[7].event.type).to.equal("eighth");
            })
            .finally(() => stop());
        })
        .finally(() => stop());
    });

    it("should process all historic logfiles in correct order", function() {
      this.timeout(20000);

      let stopReader0, stopReader1;

      return setTimeAndWaitUntilItIsApplied(1979, 5, 25)
        .then(() => {
          const filenameTemplate = path.join(
            disposableFile.dirSync(),
            "events%y%m%d.log"
          );

          const { add, stop } = writer(filenameTemplate);
          return add({ type: "ett" })
            .promise.then(() => add({ type: "två" }).promise)
            .then(() => add({ type: "tre" }).promise)
            .then(() => setTimeAndWaitUntilItIsApplied(1980, 8, 21))
            .then(() => add({ type: "fyra" }).promise)
            .then(() => add({ type: "fem" }).promise)
            .then(() => add({ type: "sex" }).promise)
            .then(() => setTimeAndWaitUntilItIsApplied(1984, 2, 4))
            .then(() => add({ type: "sju" }).promise)
            .then(() => setTimeAndWaitUntilItIsApplied(1987, 5, 22))
            .then(() => add({ type: "åtta" }).promise)
            .then(() => add({ type: "nio" }).promise)
            .then(() => setTimeAndWaitUntilItIsApplied(2012, 1, 31))
            .then(() => add({ type: "tio" }).promise)
            .then(() => add({ type: "elva" }).promise)
            .then(() => add({ type: "tolv" }).promise)
            .then(() => add({ type: "tretton" }).promise)
            .then(() => add({ type: "fjorton" }).promise)
            .then(() => setTimeAndWaitUntilItIsApplied(2016, 8, 21))
            .then(() => add({ type: "femton" }).promise)
            .then(() => add({ type: "sexton" }).promise)
            .then(() => setTimeAndWaitUntilItIsApplied())
            .then(() => td.reset())
            .then(() => files.findLogfiles(filenameTemplate))
            .then(files => files.map(file => path.basename(file)))
            .then(files => {
              expect(files).to.deep.equal([
                "events19790525.log",
                "events19800821.log",
                "events19840204.log",
                "events19870522.log",
                "events20120131.log",
                "events20160821.log",
                path.basename(logfileForToday(filenameTemplate))
              ]);
            })
            .then(() => {
              const { consume } = reader(filenameTemplate);
              const log = [];

              return new Promise(resolve => {
                const { stop } = consume(
                  (event, meta) => {
                    log.push(event.type);
                  },
                  0,
                  resolve
                );
                stopReader0 = stop;
              })
                .then(() => {
                  expect(log).to.deep.equal([
                    "ett",
                    "två",
                    "tre",
                    "fyra",
                    "fem",
                    "sex",
                    "sju",
                    "åtta",
                    "nio",
                    "tio",
                    "elva",
                    "tolv",
                    "tretton",
                    "fjorton",
                    "femton",
                    "sexton"
                  ]);
                })
                .then(() => new Promise(resolve => setTimeout(resolve, 10000)));
            })
            .then(() => add({ type: "sjutton" }).promise)
            .then(() => add({ type: "arton" }).promise)
            .then(() => add({ type: "nitton" }).promise)
            .then(() => add({ type: "tjugio" }).promise)
            .then(() => {
              const { consume } = reader(filenameTemplate);
              const log = [];

              return new Promise(resolve => {
                const { stop } = consume(
                  (event, meta) => {
                    log.push(event.type);
                  },
                  0,
                  resolve
                );
                stopReader1 = stop;
              }).then(() => {
                expect(log).to.deep.equal([
                  "ett",
                  "två",
                  "tre",
                  "fyra",
                  "fem",
                  "sex",
                  "sju",
                  "åtta",
                  "nio",
                  "tio",
                  "elva",
                  "tolv",
                  "tretton",
                  "fjorton",
                  "femton",
                  "sexton",
                  "sjutton",
                  "arton",
                  "nitton",
                  "tjugio"
                ]);
              });
            })
            .finally(() => {
              stop();
            });
        })
        .finally(() => {
          stopReader0();
          stopReader1();
        });
    });

    it("500000 events should be no problem in half a minute", function() {
      this.timeout(30000);
      const filenameTemplate = path.join(
        disposableFile.dirSync(),
        "events%y%m%d.log"
      );
      const nr = 500000;
      const str = [...Array(nr)]
        .map(
          (_, index) =>
            '{ "event": { "type": "test" }, "meta": { "id": "test' +
            index +
            '" } }\n'
        )
        .join("");

      fs.appendFileSync(logfileForToday(filenameTemplate), str);

      const { consume } = reader(filenameTemplate);
      let counter = 0;
      return new Promise((resolve, reject) => {
        const { stop } = consume(
          (event, meta) => {
            counter++;
          },
          0,
          resolve
        );
      }).then(() => {
        expect(counter).to.equal(nr);
      });
    });

    it("should read from the position we ask for", function() {
      this.timeout(30000);

      let stopReader0,
        stopReader1,
        stopReader2,
        stopReader3,
        stopReader4,
        stopReader5;

      return setTimeAndWaitUntilItIsApplied(1979, 5, 25).then(() => {
        const filenameTemplate = path.join(
          disposableFile.dirSync(),
          "events%y%m%d.log"
        );

        const { add, stop } = writer(filenameTemplate);
        return add({ type: "ett" })
          .promise.then(() => add({ type: "två" }).promise)
          .then(() => add({ type: "tre" }).promise)
          .then(() => setTimeAndWaitUntilItIsApplied(1980, 8, 21))
          .then(() => add({ type: "fyra" }).promise)
          .then(() => add({ type: "fem" }).promise)
          .then(() => add({ type: "sex" }).promise)
          .then(() => setTimeAndWaitUntilItIsApplied(1984, 2, 4))
          .then(() => add({ type: "sju" }).promise)
          .then(() => setTimeAndWaitUntilItIsApplied(1987, 5, 22))
          .then(() => add({ type: "åtta" }).promise)
          .then(() => add({ type: "nio" }).promise)
          .then(() => setTimeAndWaitUntilItIsApplied(2012, 1, 31))
          .then(() => add({ type: "tio" }).promise)
          .then(() => add({ type: "elva" }).promise)
          .then(() => add({ type: "tolv" }).promise)
          .then(() => add({ type: "tretton" }).promise)
          .then(() => add({ type: "fjorton" }).promise)
          .then(() => setTimeAndWaitUntilItIsApplied(2016, 8, 21))
          .then(() => add({ type: "femton" }).promise)
          .then(() => add({ type: "sexton" }).promise)
          .then(() => setTimeAndWaitUntilItIsApplied())
          .then(() => td.reset())
          .then(() => {
            const { consume } = reader(filenameTemplate);
            const log = [];
            const filesLog = [];

            return new Promise(resolve => {
              const { stop, liveMeta } = consume(
                (event, meta) => {
                  log.push(event.type);
                },
                1979052500000001,
                resolve
              );

              liveMeta.on("open", file => filesLog.push(path.basename(file)));

              stopReader0 = stop;
            }).then(() => {
              expect(filesLog).to.deep.equal([
                "events19790525.log",
                "events19800821.log",
                "events19840204.log",
                "events19870522.log",
                "events20120131.log",
                "events20160821.log",
                path.basename(logfileForToday(filenameTemplate))
              ]);
              expect(log).to.deep.equal([
                "två",
                "tre",
                "fyra",
                "fem",
                "sex",
                "sju",
                "åtta",
                "nio",
                "tio",
                "elva",
                "tolv",
                "tretton",
                "fjorton",
                "femton",
                "sexton"
              ]);
            });
          })
          .then(() => {
            const { consume } = reader(filenameTemplate);
            const log = [];
            const filesLog = [];

            return new Promise(resolve => {
              const { stop, liveMeta } = consume(
                (event, meta) => {
                  log.push(event.type);
                },
                1980082100000000,
                resolve
              );
              liveMeta.on("open", file => filesLog.push(path.basename(file)));
              stopReader1 = stop;
            }).then(() => {
              expect(filesLog).to.deep.equal([
                "events19800821.log",
                "events19840204.log",
                "events19870522.log",
                "events20120131.log",
                "events20160821.log",
                path.basename(logfileForToday(filenameTemplate))
              ]);
              expect(log).to.deep.equal([
                "fyra",
                "fem",
                "sex",
                "sju",
                "åtta",
                "nio",
                "tio",
                "elva",
                "tolv",
                "tretton",
                "fjorton",
                "femton",
                "sexton"
              ]);
            });
          })
          .then(() => {
            const { consume } = reader(filenameTemplate);
            const log = [];
            const filesLog = [];

            return new Promise(resolve => {
              const { stop, liveMeta } = consume(
                (event, meta) => {
                  log.push(event.type);
                },
                1980082100000003,
                resolve
              );
              liveMeta.on("open", file => filesLog.push(path.basename(file)));
              stopReader2 = stop;
            }).then(() => {
              expect(filesLog).to.deep.equal([
                "events19800821.log",
                "events19840204.log",
                "events19870522.log",
                "events20120131.log",
                "events20160821.log",
                path.basename(logfileForToday(filenameTemplate))
              ]);
              expect(log).to.deep.equal([
                "sju",
                "åtta",
                "nio",
                "tio",
                "elva",
                "tolv",
                "tretton",
                "fjorton",
                "femton",
                "sexton"
              ]);
            });
          })
          .then(() => {
            const { consume } = reader(filenameTemplate);
            const log = [];
            const filesLog = [];

            return new Promise(resolve => {
              const { stop, liveMeta } = consume(
                (event, meta) => {
                  log.push(event.type);
                },
                1982122400001234,
                resolve
              );
              liveMeta.on("open", file => filesLog.push(path.basename(file)));
              stopReader3 = stop;
            }).then(() => {
              expect(filesLog).to.deep.equal([
                "events19840204.log",
                "events19870522.log",
                "events20120131.log",
                "events20160821.log",
                path.basename(logfileForToday(filenameTemplate))
              ]);
              expect(log).to.deep.equal([
                "sju",
                "åtta",
                "nio",
                "tio",
                "elva",
                "tolv",
                "tretton",
                "fjorton",
                "femton",
                "sexton"
              ]);
            });
          })
          .then(() => {
            const { consume } = reader(filenameTemplate);
            const log = [];
            const filesLog = [];

            return new Promise(resolve => {
              const { stop, liveMeta } = consume(
                (event, meta) => {
                  log.push(event.type);
                },
                2012013100000000,
                resolve
              );
              liveMeta.on("open", file => filesLog.push(path.basename(file)));
              stopReader4 = stop;
            }).then(() => {
              expect(filesLog).to.deep.equal([
                "events20120131.log",
                "events20160821.log",
                path.basename(logfileForToday(filenameTemplate))
              ]);
              expect(log).to.deep.equal([
                "tio",
                "elva",
                "tolv",
                "tretton",
                "fjorton",
                "femton",
                "sexton"
              ]);
            });
          })
          .then(() => {
            const { consume } = reader(filenameTemplate);
            const log = [];
            const filesLog = [];

            return new Promise(resolve => {
              const { stop, liveMeta } = consume(
                (event, meta) => {
                  log.push(event.type);
                },
                2020010100000000,
                resolve
              );
              liveMeta.on("open", file => filesLog.push(path.basename(file)));
              stopReader5 = stop;
            }).then(() => {
              expect(filesLog).to.deep.equal([
                path.basename(logfileForToday(filenameTemplate))
              ]);
              expect(log).to.deep.equal([]);
            });
          })
          .finally(() => {
            try {
              stopReader0();
              stopReader1();
              stopReader2();
              stopReader3();
              stopReader4();
              stopReader5();
            } catch (err) {}
          });
      });
    });
  });
});
