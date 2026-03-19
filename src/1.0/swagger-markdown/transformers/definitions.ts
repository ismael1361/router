import dataTypeTransformer from "./dataTypes";
import inArray from "../lib/inArray";
import Schema from "../models/schema";
import type swaggerJSDoc from "swagger-jsdoc";

/**
 * If Property field is present parse them.
 * @param name of the definition
 * @param definition definition object
 */
const parseProperties = (name: string, definition: any) => {
	const required = "required" in definition ? definition.required : [];
	const res: string[] = [];
	Object.keys(definition.properties).map((propName) => {
		const prop = definition.properties[propName];
		const typeCell = dataTypeTransformer(new Schema(prop));
		const descriptionCell = ("description" in prop ? prop.description : "").replace(/[\r\n]/g, " ");
		const requiredCell = inArray(propName, required) ? "Yes" : "No";
		res.push(`| ${propName} | ${typeCell} | ${descriptionCell} | ${requiredCell} |`);
	});
	return res.filter((v) => (v || "").trim() !== "");
};

/**
 * Parse allOf definition
 * @param name of the definition
 * @param definition definition object
 */
const parsePrimitive = (name: string, definition: any) => {
	const res: string[] = [];
	const typeCell = "type" in definition ? definition.type : "";
	const descriptionCell = ("description" in definition ? definition.description : "").replace(/[\r\n]/g, " ");
	const requiredCell = "";
	res.push(`| ${name} | ${typeCell} | ${descriptionCell} | ${requiredCell} |`);
	return res.filter((v) => (v || "").trim() !== "");
};

/**
 * @param {type} name
 * @param {type} definition
 * @return {type} Description
 */
export const processDefinition = (name: string, definition: any) => {
	let res: string[] = [];
	let parsedDef = [];
	res.push("");
	res.push(`#### ${name}`);
	res.push("");
	if (definition.description) {
		res.push(definition.description);
		res.push("");
	}
	res.push("| Name | Type | Description | Required |");
	res.push("| ---- | ---- | ----------- | -------- |");

	if ("properties" in definition) {
		parsedDef = parseProperties(name, definition);
	} else {
		parsedDef = parsePrimitive(name, definition);
	}
	res = res.concat(parsedDef);

	return res.length ? res.filter((v) => (v || "").trim() !== "").join("\n") : null;
};

/**
 * @param {type} definitions
 * @return {type} Description
 */
export default (definitions: swaggerJSDoc.SwaggerDefinition) => {
	const res: Array<string | null> = [];
	Object.keys(definitions).map((definitionName) => res.push(processDefinition(definitionName, definitions[definitionName])));
	if (res.length > 0) {
		res.unshift("### Models\n");
		return res.filter((v) => typeof v === "string").join("\n");
	}
	return null;
};
