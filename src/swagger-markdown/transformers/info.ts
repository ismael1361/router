import transformContact from "./contact";
import transformLicense from "./license";
import type swaggerJSDoc from "swagger-jsdoc";

/**
 * http://swagger.io/specification/#infoObject
 * Prepare page header
 * Leave description with no changes
 * @param {Object} info
 * @returns {String}
 */
export default (info: swaggerJSDoc.Information) => {
	const res: Array<string | null> = [];

	if (info !== null && typeof info === "object") {
		if (info.title) {
			res.push(`# ${info.title}`);
		}

		if (info.description) {
			res.push(`${info.description}\n`);
		}

		if (info.version) {
			res.push(`## Version: ${info.version}\n`);
		}

		if (info.termsOfService) {
			res.push(`### Terms of service\n${info.termsOfService}\n`);
		}

		if (info.contact) {
			res.push(transformContact(info.contact));
		}

		if (info.license) {
			res.push(transformLicense(info.license));
		}
	}

	return res.length ? res.filter((v) => typeof v === "string").join("\n") : null;
};
