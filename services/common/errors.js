class AppError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

const ErrorCodes = {
  INVALID_REQUEST: "INVALID_REQUEST",
  INVALID_RULES: "INVALID_RULES",
  SHEET_NOT_FOUND: "SHEET_NOT_FOUND",
  SPLIT_COLUMN_NOT_FOUND: "SPLIT_COLUMN_NOT_FOUND",
  NO_SPLIT_KEYS: "NO_SPLIT_KEYS",
  FILE_WRITE_CONFLICT: "FILE_WRITE_CONFLICT"
};

module.exports = {
  AppError,
  ErrorCodes
};
