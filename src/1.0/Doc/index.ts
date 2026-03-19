import type swaggerJSDoc from "swagger-jsdoc";
import type { ExtractScopesBySecuritySchemes, Reference, ComponentSecurity, SecuritySchemesTypes, ComponentSchema, ModelValueNumber, ModelValueString } from "./type";
import type { MiddlewareFCDoc, Prettify } from "../type";

class Model {
	type?: "string" | "number" | "integer" | "boolean" | "array" | "object";
	format?: string | undefined;

	constructor() {}

	static boolean(): swaggerJSDoc.Schema {
		return {
			type: "boolean",
		};
	}

	static number(options: ModelValueNumber): swaggerJSDoc.Schema {
		let { type = "number", format, ...opt } = options;
		type = ["int32", "int64"].includes(format || "") ? "integer" : ["float", "double"].includes(format || "") ? "number" : type;
		return {
			type,
			format,
			...opt,
		};
	}

	static string(options: ModelValueString): swaggerJSDoc.Schema {
		let { pattern, ...opt } = options;

		pattern = pattern instanceof RegExp ? pattern.toString() : pattern;

		return {
			type: "string",
			pattern,
			...options,
		};
	}

	static array(): swaggerJSDoc.Schema {
		return {
			type: "array",
		};
	}
}

export class Doc {
	constructor(public operation: swaggerJSDoc.Operation = {}, public components: swaggerJSDoc.Components = {} as any) {}

	get doc(): MiddlewareFCDoc {
		return {
			...this.operation,
			components: this.components,
		};
	}

	summary(summary: string) {
		this.operation.summary = summary;
		return this;
	}

	description(description: string) {
		this.operation.description = description;
		return this;
	}

	tags<T extends string>(...tags: T[]) {
		this.operation.tags = tags;
		return this;
	}

	operationId(operationId: string) {
		this.operation.operationId = operationId;
		return this;
	}

	parameter(options: swaggerJSDoc.Parameter | swaggerJSDoc.Reference) {
		this.operation.parameters = [...(this.operation?.parameters || []), options];
		return this;
	}

	requestBody() {}

	security<S extends string | ComponentSecurity<any, any>, E extends ExtractScopesBySecuritySchemes<S>>(security: S, ...scopes: E[]) {
		if (typeof security === "string") {
			this.operation.security = [...((this.operation?.security || []) as any), { [security as any]: scopes }];
		} else {
			(this.components as any).securitySchemes = {
				...((this.components as any).securitySchemes || {}),
				...security.securitySchemes,
			};

			const name = Object.keys(security.securitySchemes)[0] as string;

			this.operation.security = [...((this.operation?.security || []) as any), { [name]: scopes }];
		}

		return this;
	}

	static ref<R extends string | ComponentSecurity<any, any> | ComponentSchema<any, any>>(ref: R): Reference<R> {
		if (typeof ref === "object") {
			if ("securitySchemes" in ref) {
				const name = Object.keys(ref.securitySchemes)[0] as string;
				return { $ref: "#/components/securitySchemes/" + name } as any;
			}

			if ("schemas" in ref) {
				const name = Object.keys(ref.schemas)[0] as string;
				return { $ref: "#/components/schemas/" + name } as any;
			}
		}

		if (typeof ref === "string") {
			return { $ref: ref.trim().startsWith("#/components/") ? ref.trim() : "#/components/" + ref.trim() } as any;
		}

		return { $ref: "" } as any;
	}

	static component = {
		securityScheme<N extends string, O extends SecuritySchemesTypes>(name: N, options: O): ComponentSecurity<N, O> {
			return {
				securitySchemes: {
					[name]: options,
				},
			} as any;
		},
	};
}

const d = new Doc();

const o = Doc.component.securityScheme("OAuth2", {
	type: "oauth2",
	flows: {
		authorizationCode: {
			authorizationUrl: "",
			tokenUrl: "",
			scopes: {
				read: "",
				write: "",
				admin: "",
			},
		},
	},
});

d.security(o, "admin", "read", "write");
