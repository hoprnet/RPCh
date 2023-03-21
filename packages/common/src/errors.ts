export class HttpError extends Error {
  public status: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = this.constructor.name;
    this.status = status ?? 500;
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class NotFoundError extends HttpError {
  constructor(message = "Not Found") {
    super(message, 404);
  }
}

export class ForbiddenError extends HttpError {
  constructor(message = "Unauthorized") {
    super(message, 403);
  }
}

export class UnauthenticatedError extends HttpError {
  constructor(message = "Unauthenticated") {
    super(message, 401);
  }
}

export class UnprocessableEntityError extends HttpError {
  constructor(message = "Unknown failure") {
    super(message, 422);
  }
}
