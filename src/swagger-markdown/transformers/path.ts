import inArray from "../lib/inArray";
import transformResponses from "./pathResponses";
import transformParameters from "./pathParameters";
import security from "./security";

import type swaggerJSDoc from "swagger-jsdoc";

/**
 * Allowed methods
 * @type {string[]}
 */
export const ALLOWED_METHODS = ["get", "post", "put", "patch", "delete", "options"];

export default (path: string, data: swaggerJSDoc.PathItem, parameters?: Record<string, swaggerJSDoc.Parameter>) => {
	const res: Array<string | null> = [];
	let pathParameters: swaggerJSDoc.Operation["parameters"] | undefined = undefined;

	if (path && data) {
		res.push("\n---\n");

		// Make path as a header
		res.push(`### ${path} {#${path}}\n`);

		// Set summary
		if (data.summary) {
			res.push(`#### Summary:\n\n${data.summary}\n`);
		}

		// Check if parameter for path are in the place
		if (data.parameters) {
			pathParameters = data.parameters as any;
		}

		// Go further method by methods
		Object.keys(data).map((method) => {
			if (inArray(method, ALLOWED_METHODS)) {
				const methodLine: Array<string | null> = [];

				// Set method as a subheader
				methodLine.push(`#### ${method.toUpperCase()}  {#${path}-${method}}`);
				const pathInfo: swaggerJSDoc.Operation = data[method];

				// Set summary
				if (pathInfo.summary) {
					methodLine.push(`##### Summary:\n\n${pathInfo.summary}\n`);
				}

				// Set description
				if (pathInfo.description) {
					methodLine.push(`##### Description:\n\n${pathInfo.description}\n`);
				}

				// Build parameters
				if (pathInfo.parameters || pathParameters) {
					methodLine.push(`${transformParameters(pathInfo.parameters || [], pathParameters, parameters)}\n`);
				}

				// Build responses
				if (pathInfo.responses) {
					methodLine.push(`${transformResponses(pathInfo.responses)}\n`);
				}

				// Build security
				if (pathInfo.security) {
					methodLine.push(`${security(pathInfo.security)}\n`);
				}

				res.push(...methodLine.filter((v) => typeof v === "string").map((v) => `> ${v.split("\n").join("\n> ")}`));

				res.push(`\n`);
			}
		});
	}

	return res.length ? res.filter((v) => typeof v === "string").join("\n") : null;
};
