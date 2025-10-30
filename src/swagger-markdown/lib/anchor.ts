/**
 * Make camel case format
 */
export default (input: string) => input.replace(/\s+/g, "-").replace(/^-*/gi, "").replace(/-*$/gi, "");
