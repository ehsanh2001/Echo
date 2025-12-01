import "reflect-metadata";
import { TemplateService } from "../../src/services/TemplateService";
import * as fs from "fs/promises";
import { describe, expect, it, jest, beforeEach } from "@jest/globals";

// Mock fs/promises
jest.mock("fs/promises");

// Mock logger
jest.mock("../../src/config/logger", () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe("TemplateService", () => {
  let templateService: TemplateService;
  const mockFsPromises = fs as jest.Mocked<typeof fs>;

  beforeEach(() => {
    templateService = new TemplateService();
  });

  describe("initialize()", () => {
    it("should initialize successfully when partials directory exists", async () => {
      // Arrange
      mockFsPromises.access.mockResolvedValue(undefined);
      mockFsPromises.readdir.mockResolvedValue([
        "header.hbs",
        "footer.hbs",
      ] as any);
      mockFsPromises.readFile
        .mockResolvedValueOnce("<header>Header content</header>")
        .mockResolvedValueOnce("<footer>Footer content</footer>");

      // Act
      await templateService.initialize();

      // Assert
      expect(mockFsPromises.access).toHaveBeenCalled();
      expect(mockFsPromises.readdir).toHaveBeenCalled();
      expect(mockFsPromises.readFile).toHaveBeenCalledTimes(2);
    });

    it("should handle missing partials directory gracefully", async () => {
      // Arrange
      mockFsPromises.access.mockRejectedValue(new Error("Directory not found"));

      // Act
      await templateService.initialize();

      // Assert
      expect(mockFsPromises.access).toHaveBeenCalled();
      expect(mockFsPromises.readdir).not.toHaveBeenCalled();
    });

    it("should skip non-.hbs files in partials directory", async () => {
      // Arrange
      mockFsPromises.access.mockResolvedValue(undefined);
      mockFsPromises.readdir.mockResolvedValue([
        "header.hbs",
        "readme.txt",
        "footer.hbs",
      ] as any);
      mockFsPromises.readFile
        .mockResolvedValueOnce("<header>Header content</header>")
        .mockResolvedValueOnce("<footer>Footer content</footer>");

      // Act
      await templateService.initialize();

      // Assert
      expect(mockFsPromises.readFile).toHaveBeenCalledTimes(2); // Only .hbs files
    });
  });

  describe("render()", () => {
    it("should render template successfully", async () => {
      // Arrange
      const templateContent = "<p>Hello {{name}}</p>";
      mockFsPromises.readFile.mockResolvedValue(templateContent);

      const data = { name: "John" };

      // Act
      const result = await templateService.render("test-template", data);

      // Assert
      expect(result).toBe("<p>Hello John</p>");
      expect(mockFsPromises.readFile).toHaveBeenCalledWith(
        expect.stringContaining("test-template.hbs"),
        "utf-8"
      );
    });

    it("should cache compiled templates", async () => {
      // Arrange
      const templateContent = "<p>Hello {{name}}</p>";
      mockFsPromises.readFile.mockResolvedValue(templateContent);

      const data = { name: "John" };

      // Act
      await templateService.render("test-template", data);
      await templateService.render("test-template", data); // Second call

      // Assert
      expect(mockFsPromises.readFile).toHaveBeenCalledTimes(1); // Only loaded once
    });

    it("should throw error when template not found", async () => {
      // Arrange
      mockFsPromises.readFile.mockRejectedValue(
        new Error("ENOENT: no such file or directory")
      );

      // Act & Assert
      await expect(templateService.render("non-existent", {})).rejects.toThrow(
        "Template 'non-existent' not found"
      );
    });

    it("should render template with multiple variables", async () => {
      // Arrange
      const templateContent =
        "<p>{{greeting}} {{name}}, you have {{count}} messages</p>";
      mockFsPromises.readFile.mockResolvedValue(templateContent);

      const data = {
        greeting: "Hello",
        name: "Alice",
        count: 5,
      };

      // Act
      const result = await templateService.render("messages", data);

      // Assert
      expect(result).toBe("<p>Hello Alice, you have 5 messages</p>");
    });

    it("should handle conditionals in templates", async () => {
      // Arrange
      const templateContent =
        "{{#if customMessage}}<p>{{customMessage}}</p>{{/if}}";
      mockFsPromises.readFile.mockResolvedValue(templateContent);

      // Act - with customMessage
      const resultWith = await templateService.render("conditional", {
        customMessage: "Welcome!",
      });

      // Reset cache for second test
      (templateService as any).templateCache.clear();
      mockFsPromises.readFile.mockResolvedValue(templateContent);

      // Act - without customMessage
      const resultWithout = await templateService.render("conditional", {});

      // Assert
      expect(resultWith).toBe("<p>Welcome!</p>");
      expect(resultWithout).toBe("");
    });
  });

  describe("hasTemplate()", () => {
    it("should return true when template is cached", async () => {
      // Arrange
      const templateContent = "<p>Test</p>";
      mockFsPromises.readFile.mockResolvedValue(templateContent);

      // Cache the template by rendering it
      await templateService.render("cached-template", {});

      // Act
      const result = templateService.hasTemplate("cached-template");

      // Assert
      expect(result).toBe(true);
    });

    it("should return false when template is not cached", () => {
      // Act
      const result = templateService.hasTemplate("uncached-template");

      // Assert
      expect(result).toBe(false);
    });
  });

  describe("Handlebars helpers", () => {
    it("should use formatDate helper correctly", async () => {
      // Arrange
      const templateContent = "<p>Expires: {{formatDate expiresAt}}</p>";
      mockFsPromises.readFile.mockResolvedValue(templateContent);

      const data = {
        expiresAt: "2025-12-25T10:30:00.000Z",
      };

      // Act
      const result = await templateService.render("date-template", data);

      // Assert
      expect(result).toContain("Expires:");
      expect(result).toContain("December");
      expect(result).toContain("2025");
    });

    it("should handle null dates in formatDate helper", async () => {
      // Arrange
      const templateContent = "<p>Expires: {{formatDate expiresAt}}</p>";
      mockFsPromises.readFile.mockResolvedValue(templateContent);

      const data = {
        expiresAt: null,
      };

      // Act
      const result = await templateService.render("date-template", data);

      // Assert
      expect(result).toBe("<p>Expires: Never</p>");
    });
  });
});
