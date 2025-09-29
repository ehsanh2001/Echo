import { Request, Response, NextFunction } from "express";
import {
  jwtRefreshAuth,
  AuthenticatedRequest,
} from "../../src/middleware/jwtAuth";
import { JWTService } from "../../src/utils/jwt";
import {
  describe,
  it,
  expect,
  beforeEach,
  afterAll,
  beforeAll,
} from "@jest/globals";
describe("JWT Refresh Authentication Middleware", () => {
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

  describe("jwtRefreshAuth middleware", () => {
    it("should reject request without Authorization header", () => {
      jwtRefreshAuth(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

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

      jwtRefreshAuth(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

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

      jwtRefreshAuth(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "Token is required",
        code: "MISSING_TOKEN",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should accept request with valid refresh token and set user info", () => {
      // Create a valid refresh token
      const baseTokenPayload = {
        userId: "refresh-user-123",
        email: "refresh@example.com",
        roles: ["user"],
      };

      const { refreshToken } = JWTService.generateTokenPair(baseTokenPayload);

      mockReq.headers = {
        authorization: `Bearer ${refreshToken}`,
      };

      jwtRefreshAuth(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockReq.user).toEqual({
        userId: "refresh-user-123",
        email: "refresh@example.com",
        roles: ["user"],
      });
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it("should reject request with 'access' token (wrong token type)", () => {
      // Create an access token and try to use it with refresh middleware
      const baseTokenPayload = {
        userId: "test-user-123",
        email: "test@example.com",
        roles: ["user"],
      };

      const { accessToken } = JWTService.generateTokenPair(baseTokenPayload);

      mockReq.headers = {
        authorization: `Bearer ${accessToken}`,
      };

      jwtRefreshAuth(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "Token type mismatch. Expected refresh token",
        code: "INVALID_TOKEN_TYPE",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it("should reject request with expired refresh token", () => {
      // Create an expired refresh token
      const expiredTokenPayload = {
        userId: "expired-user-123",
        email: "expired@example.com",
        roles: ["user"],
      };

      const expiredToken = JWTService.generateExpiredToken(
        expiredTokenPayload,
        "refresh"
      );

      mockReq.headers = {
        authorization: `Bearer ${expiredToken}`,
      };

      jwtRefreshAuth(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: false,
        message: "Refresh token has expired",
        code: "TOKEN_EXPIRED",
      });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
