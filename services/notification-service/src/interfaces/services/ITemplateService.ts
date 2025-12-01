/**
 * Template service interface
 */
export interface ITemplateService {
  /**
   * Initialize template service (load partials)
   */
  initialize(): Promise<void>;

  /**
   * Render a template with provided data
   */
  render<T = any>(templateName: string, data: T): Promise<string>;

  /**
   * Check if template exists
   */
  hasTemplate(templateName: string): boolean;
}
