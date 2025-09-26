import { Request, Response, NextFunction } from "express";
import {
  optionalJwtAuth,
  AuthenticatedRequest,
} from "../../src/middleware/jwtAuth";
import { JWTService } from "../../src/utils/jwt";

describe("Optional JWT Authentication Middleware", () => {
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

  describe("optionalJwtAuth middleware", () => {
    it("should continue without user info when no Authorization header", () => {
      optionalJwtAuth(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it("should continue without user info when invalid Authorization header format", () => {
      mockReq.headers = {
        authorization: "InvalidFormat token123",
      };

      optionalJwtAuth(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it("should continue without user info when empty token", () => {
      mockReq.headers = {
        authorization: "Bearer ",
      };

      optionalJwtAuth(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it("should continue without user info when invalid token", () => {
      mockReq.headers = {
        authorization: "Bearer invalid.jwt.token",
      };

      optionalJwtAuth(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it("should set user info and continue when valid token provided", () => {
      // Create a valid token
      const tokenPayload = {
        userId: "optional-test-123",
        email: "optional@example.com",
        roles: ["user"],
      };

      const { accessToken } = JWTService.generateTokenPair(tokenPayload);

      mockReq.headers = {
        authorization: `Bearer ${accessToken}`,
      };

      optionalJwtAuth(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockReq.user).toEqual({
        userId: "optional-test-123",
        email: "optional@example.com",
        roles: ["user"],
      });
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });

    it("should gracefully handle any authentication errors", () => {
      // Test with a malformed token that might cause unexpected errors
      mockReq.headers = {
        authorization: "Bearer malformed-token-that-causes-errors",
      };

      optionalJwtAuth(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      // Should continue without user info, never throw or return error responses
      expect(mockReq.user).toBeUndefined();
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
      expect(mockRes.json).not.toHaveBeenCalled();
    });
  });

  describe("Optional authentication flow", () => {
    it("should handle mixed scenarios in a single request flow", () => {
      // First, test with no token
      optionalJwtAuth(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );
      expect(mockReq.user).toBeUndefined();

      // Reset mocks
      jest.clearAllMocks();

      // Then test with valid token
      const tokenPayload = {
        userId: "flow-test-456",
        email: "flow@example.com",
        roles: ["user", "premium"],
      };

      const { accessToken } = JWTService.generateTokenPair(tokenPayload);

      mockReq.headers = {
        authorization: `Bearer ${accessToken}`,
      };

      optionalJwtAuth(
        mockReq as AuthenticatedRequest,
        mockRes as Response,
        mockNext
      );

      expect(mockReq.user).toBeDefined();
      expect(mockReq.user?.userId).toBe("flow-test-456");
      expect(mockReq.user?.email).toBe("flow@example.com");
      expect(mockReq.user?.roles).toEqual(["user", "premium"]);
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
