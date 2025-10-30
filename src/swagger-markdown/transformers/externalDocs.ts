import type swaggerJSDoc from "swagger-jsdoc";

const DEFAULT_TEXT = "Find more info here";

export default (externalDocs: swaggerJSDoc.ExternalDocumentation) => {
	const res: Array<string | null> = [];
	if ("description" in externalDocs && "url" in externalDocs) {
		res.push(`[${externalDocs.description}](${externalDocs.url})`);
	} else if ("url" in externalDocs) {
		res.push(`[${DEFAULT_TEXT}](${externalDocs.url})`);
	}
	return res.length ? res.filter((v) => typeof v === "string").join("\n") : null;
};
