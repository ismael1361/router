// const transformDataTypes = require('./dataTypes');
// const Schema = require('../models/schema');
import transformDataTypes from "./dataTypes";
import Schema from "../models/schema";

import type swaggerJSDoc from "swagger-jsdoc";

export default (parameters: swaggerJSDoc.Operation["parameters"] = [], pathParameters: swaggerJSDoc.Operation["parameters"] = [], globalParameters: Record<string, swaggerJSDoc.Parameter> = {}) => {
	const res: Array<string | null> = [];

	[...pathParameters, ...parameters].map((keys: swaggerJSDoc.Parameter | swaggerJSDoc.Reference) => {
		if (keys) {
			let parametersKeys: swaggerJSDoc.Parameter | undefined;
			// Check it for the reference
			if (keys.$ref) {
				const ref = keys.$ref.replace(/^#\/parameters\//, "");
				if (ref in globalParameters) {
					parametersKeys = globalParameters[ref];
				}
			}

			if (typeof keys === "object") {
				parametersKeys = keys as swaggerJSDoc.Parameter;
			}

			if (!parametersKeys) {
				return;
			}

			const line = [];
			// Name first
			line.push(parametersKeys.name || "");
			// Scope (in)
			line.push(parametersKeys.in || "");
			// description
			if (parametersKeys.description) {
				line.push(parametersKeys.description.replace(/[\r\n]/g, " "));
			} else {
				line.push("");
			}
			line.push(parametersKeys.required ? "Yes" : "No");

			// Prepare schema to be transformed
			let schema = null;
			if ("schema" in parametersKeys) {
				schema = new Schema(parametersKeys.schema);
			} else {
				schema = new Schema();
				schema.type = "type" in parametersKeys ? parametersKeys.type : null;
				schema.format = "format" in parametersKeys ? parametersKeys.format : null;
				schema.ref = "$ref" in parametersKeys ? parametersKeys.$ref : null;
				schema.items = "items" in parametersKeys ? parametersKeys.items : null;
			}

			line.push(transformDataTypes(schema));
			// Add spaces and glue with pipeline
			res.push(`|${line.map((el) => ` ${el} `).join("|")}|`);
		}
	});

	if (res.length > 0) {
		res.unshift("| ---- | ---------- | ----------- | -------- | ---- |");
		res.unshift("| Name | Located in | Description | Required | Schema |");
		res.unshift("##### Parameters\n");
	}

	return res.length ? res.filter((v) => typeof v === "string").join("\n") : null;
};
