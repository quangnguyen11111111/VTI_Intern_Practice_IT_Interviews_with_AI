export class PromptTemplate {
  /**
   * Replaces variables in a string template with their corresponding values.
   * Example: "Hello {{name}}" + { name: "John" } => "Hello John"
   *
   * @param template - The string template containing variables wrapped in {{ }}
   * @param variables - An object mapping variable names to their values
   * @returns The parsed string with variables replaced
   */
  static injectVariables(template: string, variables: Record<string, any>): string {
    if (!template) return '';
    
    return template.replace(/\{\{(.+?)\}\}/g, (match, key) => {
      const trimmedKey = key.trim();
      const value = variables[trimmedKey];
      
      // If the value is undefined or null, we return the original match or an empty string.
      // We choose to leave it empty if the variable is missing, or stringify if it's an object/array.
      if (value === undefined || value === null) {
        console.warn(`[PromptTemplate] Variable '{{${trimmedKey}}}' was not provided.`);
        return '';
      }
      
      if (typeof value === 'object') {
        return JSON.stringify(value, null, 2);
      }
      
      return String(value);
    });
  }
}
