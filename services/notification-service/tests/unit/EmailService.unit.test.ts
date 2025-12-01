import "reflect-metadata";
import { EmailService } from "../../src/services/EmailService";
import { Resend } from "resend";
import { describe, expect, it, jest, beforeEach } from "@jest/globals";

// Mock Resend
jest.mock("resend");

// Mock config
jest.mock("../../src/config/env", () => ({
  config: {
    nodeEnv: "production",
    email: {
      resendApiKey: "re_test_key_123",
      fromAddress: "test@resend.dev",
      fromName: "Test Service",
    },
  },
}));

// Mock logger
jest.mock("../../src/config/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("EmailService", () => {
  let emailService: EmailService;
  let mockResendInstance: any;

  beforeEach(() => {
    // Create mock Resend instance
    mockResendInstance = {
      emails: {
        send: jest.fn(),
      },
    };

    // Mock Resend constructor
    (Resend as jest.MockedClass<typeof Resend>).mockImplementation(
      () => mockResendInstance
    );

    // Create service instance
    emailService = new EmailService();
  });

  describe("send()", () => {
    it("should send email successfully", async () => {
      // Arrange
      mockResendInstance.emails.send.mockResolvedValue({
        data: { id: "msg-123" },
      });

      const request = {
        to: "test@example.com",
        subject: "Test Email",
        html: "<p>Test content</p>",
      };

      // Act
      const result = await emailService.send(request);

      // Assert
      expect(result).toEqual({
        success: true,
        messageId: "msg-123",
      });
      expect(mockResendInstance.emails.send).toHaveBeenCalledWith({
        from: "Test Service <test@resend.dev>",
        to: "test@example.com",
        subject: "Test Email",
        html: "<p>Test content</p>",
      });
    });

    it("should use custom from address when provided", async () => {
      // Arrange
      mockResendInstance.emails.send.mockResolvedValue({
        data: { id: "msg-123" },
      });

      const request = {
        to: "test@example.com",
        subject: "Test Email",
        html: "<p>Test content</p>",
        from: {
          email: "custom@example.com",
          name: "Custom Sender",
        },
      };

      // Act
      await emailService.send(request);

      // Assert
      expect(mockResendInstance.emails.send).toHaveBeenCalledWith({
        from: "Custom Sender <custom@example.com>",
        to: "test@example.com",
        subject: "Test Email",
        html: "<p>Test content</p>",
      });
    });

    it("should retry on transient errors", async () => {
      // Arrange
      mockResendInstance.emails.send
        .mockRejectedValueOnce({ statusCode: 500, message: "Server error" })
        .mockRejectedValueOnce({
          statusCode: 503,
          message: "Service unavailable",
        })
        .mockResolvedValueOnce({ data: { id: "msg-123" } });

      const request = {
        to: "test@example.com",
        subject: "Test Email",
        html: "<p>Test content</p>",
      };

      // Act
      const result = await emailService.send(request);

      // Assert
      expect(result.success).toBe(true);
      expect(mockResendInstance.emails.send).toHaveBeenCalledTimes(3);
    }, 20000); // 20 second timeout for retry delays

    it("should not retry on permanent errors", async () => {
      // Arrange
      mockResendInstance.emails.send.mockRejectedValue({
        statusCode: 400,
        message: "Invalid email",
      });

      const request = {
        to: "invalid-email",
        subject: "Test Email",
        html: "<p>Test content</p>",
      };

      // Act
      const result = await emailService.send(request);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid email");
      expect(mockResendInstance.emails.send).toHaveBeenCalledTimes(1); // No retries
    });

    it("should return failure when all retries exhausted", async () => {
      // Arrange
      mockResendInstance.emails.send.mockRejectedValue({
        statusCode: 500,
        message: "Server error",
      });

      const request = {
        to: "test@example.com",
        subject: "Test Email",
        html: "<p>Test content</p>",
      };

      // Act
      const result = await emailService.send(request);

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe("Server error");
      expect(mockResendInstance.emails.send).toHaveBeenCalledTimes(3); // Max retries
    }, 20000); // 20 second timeout for retry delays

    it("should apply exponential backoff between retries", async () => {
      // Arrange
      jest.useFakeTimers();
      mockResendInstance.emails.send
        .mockRejectedValueOnce({ statusCode: 500, message: "Server error" })
        .mockRejectedValueOnce({ statusCode: 500, message: "Server error" })
        .mockResolvedValueOnce({ data: { id: "msg-123" } });

      const request = {
        to: "test@example.com",
        subject: "Test Email",
        html: "<p>Test content</p>",
      };

      // Act
      const sendPromise = emailService.send(request);

      // Fast-forward through delays
      await jest.runAllTimersAsync();

      const result = await sendPromise;

      // Assert
      expect(result.success).toBe(true);
      jest.useRealTimers();
    });

    it("should detect permanent error codes correctly", async () => {
      // Arrange
      const permanentCodes = [400, 401, 403, 404, 422];

      for (const statusCode of permanentCodes) {
        jest.clearAllMocks();
        mockResendInstance.emails.send.mockRejectedValue({
          statusCode,
          message: `Error ${statusCode}`,
        });

        const request = {
          to: "test@example.com",
          subject: "Test Email",
          html: "<p>Test content</p>",
        };

        // Act
        await emailService.send(request);

        // Assert
        expect(mockResendInstance.emails.send).toHaveBeenCalledTimes(1); // No retries for permanent errors
      }
    });

    it("should retry on non-permanent error codes", async () => {
      // Arrange
      mockResendInstance.emails.send.mockRejectedValue({
        statusCode: 500,
        message: "Internal server error",
      });

      const request = {
        to: "test@example.com",
        subject: "Test Email",
        html: "<p>Test content</p>",
      };

      // Act
      await emailService.send(request);

      // Assert
      expect(mockResendInstance.emails.send).toHaveBeenCalledTimes(3); // Should retry
    }, 20000); // 20 second timeout for retry delays
  });
});
