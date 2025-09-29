import { Request, Response, NextFunction } from "express";
import { jwtAuth, AuthenticatedRequest } from "../../src/middleware/jwtAuth";
import { JWTService } from "../../src/utils/jwt";
import {
  describe,
  it,
  expect,
  beforeEach,
  afterAll,
  beforeAll,
} from "@jest/globals";
describe("JWT Authentication Middleware", () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe("jwtAuth middleware", () => {
    it("should reject request without Authorization header", () => {
      jwtAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "Authorization header is required",
        code: "MISSING_AUTH_HEADER",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject request with invalid Authorization header format", () => {
      mockReq.headers = {
        authorization: "InvalidFormat token123",
      };

      jwtAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid authorization header format. Use 'Bearer <token>'",
        code: "INVALID_AUTH_FORMAT",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject request with empty token", () => {
      mockReq.headers = {
        authorization: "Bearer ",
      };

      jwtAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "Token is required",
        code: "MISSING_TOKEN",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject request with invalid token", () => {
      mockReq.headers = {
        authorization: "Bearer invalid.jwt.token",
      };

      jwtAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "Invalid access token",
        code: "INVALID_TOKEN",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should accept request with valid token and set user info", () => {
      // Create a valid token
      const tokenPayload = {
        userId: "test-user-123",
        email: "test@example.com",
        roles: ["user"],
      };

      const { accessToken } = JWTService.generateTokenPair(tokenPayload);

      mockReq.headers = {
        authorization: `Bearer ${accessToken}`,
      };

      jwtAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockReq.user).toEqual({
        userId: "test-user-123",
        email: "test@example.com",
        roles: ["user"],
      });
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it("should reject request with refresh token (wrong token type)", () => {
      // Create a refresh token and try to use it with access middleware
      const baseTokenPayload = {
        userId: "test-user-123",
        email: "test@example.com",
        roles: ["user"],
      };

      const { refreshToken } = JWTService.generateTokenPair(baseTokenPayload);

      mockReq.headers = {
        authorization: `Bearer ${refreshToken}`,
      };

      jwtAuth(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "Token type mismatch. Expected access token",
        code: "INVALID_TOKEN_TYPE",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
