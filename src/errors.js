class InvalidYearError extends Error {
	constructor() {
		super("Year is invalid.");
	}
}

class InvalidMonthError extends Error {
	constructor() {
		super("Month is invalid.");
	}
}

class InvalidDayError extends Error {
	constructor() {
		super("Day is invalid.");
	}
}

class ReadOnlyError extends Error {
	constructor() {
		super("This event log is read only.");
	}
}

class TimeIsInFutureError extends Error {
	constructor() {
		super("Time is in future.");
	}
}

class WriteError extends Error {
	constructor() {
		super("An error occured while writing event to logfile.");
	}
}

module.exports = {
	InvalidYearError,
	InvalidMonthError,
	InvalidDayError,
	ReadOnlyError,
	TimeIsInFutureError,
	WriteError
};
