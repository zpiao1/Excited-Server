class NetworkError extends Error {
  constructor(message, name, status) {
    super(message);
    this.message = message;
    this.name = name;
    this.status = status;
  }
}

class AuthenticationError extends NetworkError {
  constructor(message) {
    super(message ? message : 'You are not authenticated!',
      'AuthenticationError',
      401);
  }
}

class TokenMissingError extends NetworkError {
  constructor(message) {
    super(message ? message : 'No token provided!',
      'TokenMissingError',
      403);
  }
}

class NoPermissionError extends NetworkError {
  constructor(message) {
    super(message ? message : 'You are not permitted!',
      'NoPermissionError',
      403);
  }
}

exports.AuthenticationError = AuthenticationError;
exports.NoPermissionError = NoPermissionError;
exports.TokenMissingError = TokenMissingError;