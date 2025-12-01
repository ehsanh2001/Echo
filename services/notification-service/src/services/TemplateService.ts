import { injectable } from "tsyringe";
import * as fs from "fs/promises";
import * as path from "path";
import Handlebars from "handlebars";
import { ITemplateService } from "../interfaces/services/ITemplateService";
import { logger } from "../config/logger";

/**
 * Template service using Handlebars
 *
 * Features:
 * - Load templates from filesystem
 * - Register partials (header, footer)
 * - Custom helpers (date formatting)
 * - Template caching for performance
 */
@injectable()
export class TemplateService implements ITemplateService {
  private templateCache: Map<string, HandlebarsTemplateDelegate> = new Map();
  private readonly templatesDir: string;

  constructor() {
    this.templatesDir = path.join(__dirname, "..", "templates");
    this.registerHelpers();
  }

  /**
   * Initialize template service (load partials)
   */
  async initialize(): Promise<void> {
    try {
      await this.loadPartials();
      logger.info("✅ Template service initialized");
    } catch (error) {
      logger.error("Failed to initialize template service", { error });
      throw error;
    }
  }

  /**
   * Render a template with provided data
   */
  async render<T = any>(templateName: string, data: T): Promise<string> {
    try {
      // Get or compile template
      let template = this.templateCache.get(templateName);

      if (!template) {
        template = await this.loadTemplate(templateName);
        this.templateCache.set(templateName, template);
      }

      // Render template
      const html = template(data);

      logger.debug("Template rendered successfully", { templateName });

      return html;
    } catch (error) {
      logger.error("Failed to render template", {
        templateName,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Check if template exists
   */
  hasTemplate(templateName: string): boolean {
    return this.templateCache.has(templateName);
  }

  /**
   * Load template from filesystem and compile
   */
  private async loadTemplate(
    templateName: string
  ): Promise<HandlebarsTemplateDelegate> {
    const templatePath = path.join(this.templatesDir, `${templateName}.hbs`);

    try {
      const templateSource = await fs.readFile(templatePath, "utf-8");
      const template = Handlebars.compile(templateSource);

      logger.debug("Template loaded and compiled", {
        templateName,
        path: templatePath,
      });

      return template;
    } catch (error) {
      logger.error("Failed to load template", {
        templateName,
        path: templatePath,
        error: error instanceof Error ? error.message : String(error),
      });
      throw new Error(
        `Template '${templateName}' not found at ${templatePath}`
      );
    }
  }

  /**
   * Load and register Handlebars partials
   */
  private async loadPartials(): Promise<void> {
    const partialsDir = path.join(this.templatesDir, "partials");

    try {
      // Check if partials directory exists
      try {
        await fs.access(partialsDir);
      } catch {
        logger.debug("No partials directory found, skipping partial loading");
        return;
      }

      const files = await fs.readdir(partialsDir);

      for (const file of files) {
        if (file.endsWith(".hbs")) {
          const partialName = path.basename(file, ".hbs");
          const partialPath = path.join(partialsDir, file);
          const partialSource = await fs.readFile(partialPath, "utf-8");

          Handlebars.registerPartial(partialName, partialSource);

          logger.debug("Partial registered", { partialName });
        }
      }

      logger.info(`Loaded ${files.length} partials`);
    } catch (error) {
      logger.warn("Failed to load partials", {
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Register custom Handlebars helpers
   */
  private registerHelpers(): void {
    // Format date helper
    Handlebars.registerHelper("formatDate", (dateString: string | null) => {
      if (!dateString) {
        return "Never";
      }

      try {
        const date = new Date(dateString);
        return date.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      } catch {
        return dateString;
      }
    });

    // Capitalize helper
    Handlebars.registerHelper("capitalize", (str: string) => {
      if (!str) return "";
      return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    });

    // Role badge color helper
    Handlebars.registerHelper("roleColor", (role: string) => {
      const colors: Record<string, string> = {
        owner: "#dc2626", // red-600
        admin: "#9333ea", // purple-600
        member: "#2563eb", // blue-600
        guest: "#059669", // green-600
      };
      return colors[role.toLowerCase()] || "#6b7280"; // gray-500
    });

    logger.debug("Handlebars helpers registered");
  }
}
