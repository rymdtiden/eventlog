const cp = require('child_process');
const expect = require('chai').expect;
const fs = require('fs');
const td = require('testdouble');

const util = require('../util');

describe('Unit:', () => {

	describe('countStorageLines', () => {

		let _exists, _exec;

		before(() => {
			_exists = fs.exists;
			fs.exists = td.function('fs exists');

			_exec = cp.exec;
			cp.exec = td.function('child process exec');
		});

		after(() => {
			fs.exists = _exists;
			cp.exec = _exec;
		});

		it('should resolve a number on "[random space] [number] [filepath]"', () => {
			td.when(fs.exists(td.matchers.anything()))
				.thenCallback(true);

			td.when(cp.exec(td.matchers.anything()))
				.thenCallback(null, '   57 ./sdf');

			return util.countStorageLines()
				.then(lines => expect(lines).to.equal(57))
		});

		it('should resolve a number on "[number] [filepath]"', () => {
			td.when(fs.exists(td.matchers.anything()))
				.thenCallback(true);

			td.when(cp.exec(td.matchers.anything()))
				.thenCallback(null, '76 ./sdf');

			return util.countStorageLines()
				.then(lines => expect(lines).to.equal(76))
		});

		it('should resolve a number on "[number]"', () => {
			td.when(fs.exists(td.matchers.anything()))
				.thenCallback(true);

			td.when(cp.exec(td.matchers.anything()))
				.thenCallback(null, '72343');

			return util.countStorageLines()
				.then(lines => expect(lines).to.equal(72343))
		});

		it('should resolve a number on non-existing', () => {
			td.when(fs.exists(td.matchers.anything()))
				.thenCallback(false);

			return util.countStorageLines()
				.then(lines => expect(lines).to.equal(0))
		});

		it('should reject on failure', () => {
			td.when(fs.exists(td.matchers.anything()))
				.thenCallback(true);

			td.when(cp.exec(td.matchers.anything()))
				.thenCallback(new Error('The Right Error'));

			return util.countStorageLines()
				.then(() => {
					throw new Error('Should not happen');
				})
				.catch(err => expect(err.message).to.equal('The Right Error'));
		});

		it('should reject on non-number result', () => {
			td.when(fs.exists(td.matchers.anything()))
				.thenCallback(true);

			td.when(cp.exec(td.matchers.anything()))
				.thenCallback(null, 'Some other response');

			return util.countStorageLines()
				.then(() => {
					throw new Error('Should not happen');
				})
				.catch(err => expect(err.message).to.equal('No parsable lines in wc command'));
		});

	});

});
