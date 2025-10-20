import type swaggerJSDoc from "swagger-jsdoc";
import type { DefinedSecuritySchemes, ExtractReferences, ExtractScopesBySecuritySchemes, SecuritySchemesTypes } from "./type";
import type { MiddlewareFCDoc } from "../type";

export class Doc<C extends swaggerJSDoc.Components = {}> {
	constructor(public operation: swaggerJSDoc.Operation = {}, public components: C = {} as any) {}

	get doc(): MiddlewareFCDoc {
		return {
			...this.operation,
			components: this.components,
		};
	}

	infer<T extends swaggerJSDoc.Components = C>(callback: (self: Doc<C>) => Doc<T> | undefined): Doc<T> {
		return callback(this) || (this as any);
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

	ref<R extends ExtractReferences<C>>(ref: R): { $ref: `#/components/${R}` } {
		return { $ref: "#/components/" + ref } as any;
	}

	security<S extends keyof C["securitySchemes"], E extends ExtractScopesBySecuritySchemes<C, S>>(security: S, ...scopes: E[]) {
		this.operation.security = [...(this.operation?.security || []), { [security]: scopes }];
		return this;
	}

	get component() {
		const self = this;

		return {
			securityScheme<N extends string, O extends SecuritySchemesTypes>(name: N, options: O): Doc<DefinedSecuritySchemes<C, N, O>> {
				(self.components as any).securitySchemes = {
					...((self.components as any).securitySchemes || {}),
					[name]: options,
				};
				return self as any;
			},
		};
	}
}

console.log(
	JSON.stringify(
		new Doc().component
			.securityScheme("BearerAuth", { type: "http", scheme: "bearer", bearerFormat: "JWT" })
			.security("BearerAuth")
			.tags("user", "main")
			.infer((self) => {
				return self.parameter(self.ref("securitySchemes/BearerAuth"));
			}).doc,
		null,
		4,
	),
);
