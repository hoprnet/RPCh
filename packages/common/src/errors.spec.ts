import {
  ForbiddenError,
  HttpError,
  NotFoundError,
  UnauthenticatedError,
  UnprocessableEntityError,
} from "./errors";

describe("test error classes", () => {
  describe("HttpError", function () {
    it("should be an instance of Error", function () {
      const error = new HttpError("Generic error", 500);
      expect(error instanceof Error).toBe(true);
    });

    it("should have a status code of 500 by default", function () {
      const error = new HttpError("Generic error");
      expect(error.status).toBe(500);
    });

    it("should have a custom message and status code", function () {
      const error = new HttpError("Custom error", 400);
      expect(error.message).toBe("Custom error");
      expect(error.status).toBe(400);
    });
  });
  describe("NotFoundError", function () {
    it("should be an instance of HttpError", function () {
      const error = new NotFoundError("Resource not found");
      expect(error instanceof HttpError).toBe(true);
    });

    it("should have a status code of 404", function () {
      const error = new NotFoundError("Resource not found");
      expect(error.status).toBe(404);
    });

    it("should have a name of NotFoundError", function () {
      const error = new NotFoundError("Resource not found");
      expect(error.name).toBe("NotFoundError");
    });

    it("should have a message of Resource not found", function () {
      const error = new NotFoundError("Resource not found");
      expect(error.message).toBe("Resource not found");
    });
  });
  describe("ForbiddenError", function () {
    it("should be an instance of HttpError", function () {
      const error = new ForbiddenError("Forbidden");
      expect(error instanceof HttpError).toBe(true);
    });

    it("should have a status code of 403", function () {
      const error = new ForbiddenError("Forbidden");
      expect(error.status).toBe(403);
    });

    it("should have a name of ForbiddenError", function () {
      const error = new ForbiddenError("Forbidden");
      expect(error.name).toBe("ForbiddenError");
    });

    it("should have a message of Forbidden", function () {
      const error = new ForbiddenError("Forbidden");
      expect(error.message).toBe("Forbidden");
    });
  });

  describe("UnauthenticatedError", function () {
    it("should be an instance of HttpError", function () {
      const error = new UnauthenticatedError("Unauthorized");
      expect(error instanceof HttpError).toBe(true);
    });

    it("should have a status code of 401", function () {
      const error = new UnauthenticatedError("Unauthorized");
      expect(error.status).toBe(401);
    });

    it("should have a name of UnauthenticatedError", function () {
      const error = new UnauthenticatedError("Unauthorized");
      expect(error.name).toBe("UnauthenticatedError");
    });

    it("should have a message of Unauthorized", function () {
      const error = new UnauthenticatedError("Unauthorized");
      expect(error.message).toBe("Unauthorized");
    });
  });
  describe("UnprocessableEntityError", function () {
    it("should be an instance of HttpError", function () {
      const error = new UnprocessableEntityError("Unprocessable entity");
      expect(error instanceof HttpError).toBe(true);
    });

    it("should have a status code of 422", function () {
      const error = new UnprocessableEntityError("Unprocessable entity");
      expect(error.status).toBe(422);
    });

    it("should have a name of UnprocessableEntityError", function () {
      const error = new UnprocessableEntityError("Unprocessable entity");
      expect(error.name).toBe("UnprocessableEntityError");
    });

    it("should have a message of Unprocessable entity", function () {
      const error = new UnprocessableEntityError("Unprocessable entity");
      expect(error.message).toBe("Unprocessable entity");
    });
  });
});
