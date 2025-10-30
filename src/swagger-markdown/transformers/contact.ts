import type swaggerJSDoc from "swagger-jsdoc";

/**
 * http://swagger.io/specification/#contactObject
 * Contact info transformer
 */
export default (contact: swaggerJSDoc.Contact) => {
	const res: Array<string | null> = [];

	if ("name" in contact) {
		res.push(`${contact.name}  `);
	}
	if ("url" in contact) {
		res.push(`${contact.url}  `);
	}
	if ("email" in contact) {
		res.push(`${contact.email}  `);
	}

	if (res.length > 0) {
		res.unshift("**Contact information:**  ");
		res.push("");
	}

	return res.length > 0 ? res.filter((v) => typeof v === "string").join("\n") : null;
};
