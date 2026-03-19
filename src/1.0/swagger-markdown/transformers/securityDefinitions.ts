import type swaggerJSDoc from "swagger-jsdoc";

export const typeResolver: Record<string, string> = {
	basic: "Basic",
	apiKey: "API Key",
	oauth2: "OAuth 2.0",
};

export const nameResolver: Record<string, string> = {
	description: "Description",
	name: "Name",
	in: "In",
	flow: "Flow",
	authorizationUrl: "Authorization URL",
	tokenUrl: "Token URL",
};

export default (securityDefinitions: swaggerJSDoc.SwaggerDefinition) => {
	// Base block
	const res: Array<string | null> = [];

	Object.keys(securityDefinitions).map((type) => {
		res.push(`**${type}**  \n`);
		res.push(`|${securityDefinitions[type].type}|*${typeResolver[securityDefinitions[type].type]}*|`);
		res.push("|---|---|");

		Object.keys(securityDefinitions[type]).map((value) => {
			if (value === "scopes") {
				res.push("|**Scopes**||");

				Object.keys(securityDefinitions[type][value]).map((scope) => {
					res.push(`|${scope}|` + `${securityDefinitions[type][value][scope].replace(/[\r\n]/g, " ")}|`);
				});
			} else if (value !== "type" && securityDefinitions[type][value].replace) {
				let key = nameResolver[value];

				if (key === undefined) {
					if (value.match(/^x-/i)) {
						key = value;
					} else {
						return;
					}
				}

				res.push(`|${key}|${securityDefinitions[type][value].replace(/[\r\n]/g, " ")}|`);
			}
		});

		res.push("");
	});

	// Create header
	// Only in case if there is any data
	if (res.length > 0) {
		res.unshift("### Security");
	}

	return res.length ? res.filter((v) => typeof v === "string").join("\n") : null;
};
