import type swaggerJSDoc from "swagger-jsdoc";

/**
 * http://swagger.io/specification/#licenseObject
 * License object transformer
 */
export default (license: swaggerJSDoc.License) => {
	const res: Array<string | null> = [];
	if ("url" in license || "name" in license) {
		res.push("**License:** ");
		if ("url" in license && "name" in license) {
			res.push(`[${license.name}](${license.url})`);
		} else {
			res.push(license.name || license.url || null);
		}
		res.push("\n");
	}
	return res.length > 0 ? res.filter((v) => typeof v === "string").join("") : null;
};
