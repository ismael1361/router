import Schema from "../models/schema";
import transformDataTypes from "./dataTypes";

import type swaggerJSDoc from "swagger-jsdoc";

/**
 * Build responses table
 * @param {object} responses
 * @returns {null|string}
 */
export default (responses: swaggerJSDoc.Responses) => {
	const res: Array<string | null> = [];
	// Check if schema somewhere
	const schemas = Object.keys(responses).reduce((acc, response) => acc || "schema" in responses[response], false);

	Object.keys(responses).forEach((response) => {
		const line: Array<string | null> = [];
		// Response
		line.push(response);

		// Description
		if ("description" in responses[response]) {
			const description = responses[response].description.replace(/[\r\n]/g, " ");
			line.push(description);
		} else {
			line.push("");
		}
		// Schema
		if ("schema" in responses[response]) {
			const schema = new Schema(responses[response].schema);
			line.push(transformDataTypes(schema));
		} else if (schemas) {
			line.push("");
		}
		// Combine all together
		res.push(
			`|${line
				.filter((v) => typeof v === "string")
				.map((el) => ` ${el} `)
				.join("|")}|`,
		);
	});

	res.unshift(`| ---- | ----------- |${schemas ? " ------ |" : ""}`);
	res.unshift(`| Code | Description |${schemas ? " Schema |" : ""}`);
	res.unshift("##### Responses\n");

	return res.filter((v) => typeof v === "string").join("\n");
};
