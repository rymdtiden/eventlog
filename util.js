'use strict';

const config = require('./config');
const cp = require('child_process');
const fs = require('fs');
const Promise = require('bluebird');

function countStorageLines() {
	return new Promise((resolve, reject) => {
		fs.exists(config.storageFile, exists => {
			if (!exists) return resolve(0);

			cp.exec('wc -l "' + config.storageFile + '"', (err, lines) => {
				if (err) return reject(err);

				const match = /([0-9]+)/.exec(lines);

				if (match !== null && match.length > 0) {
					return resolve(parseInt(match[1], 10));
				}

				return reject(new Error('No parsable lines in wc command'));
			});
		});
	});
}

module.exports = {
	countStorageLines
};
