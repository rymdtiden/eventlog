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

module.exports = {
	InvalidYearError,
	InvalidMonthError,
	InvalidDayError,
	ReadOnlyError
};
