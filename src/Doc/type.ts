import type swaggerJSDoc from "swagger-jsdoc";
import type { Prettify } from "../type";

export type ExtractScopesBySecuritySchemes<C extends swaggerJSDoc.Components, S extends keyof NonNullable<C["securitySchemes"]>> = NonNullable<
	C["securitySchemes"]
>[S] extends swaggerJSDoc.SecurityScheme & {
	flows?: infer F;
}
	? F extends Record<string, infer Flow>
		? Flow extends swaggerJSDoc.OAuthFlow
			? keyof NonNullable<Flow["scopes"]>
			: never
		: never
	: never;

export type JoinSecuritySchemes<A extends swaggerJSDoc.Components["securitySchemes"], B extends swaggerJSDoc.Components["securitySchemes"]> = Prettify<A & B>;

// API Key
export type SecuritySchemes_apiKey = {
	type: "apiKey";
	name: string;
	in: "query" | "header" | "cookie";
	description?: string;
};

// HTTP Authentication
export type SecuritySchemes_http = {
	type: "http";
	scheme: "basic" | "bearer" | "digest" | "ntlm";
	bearerFormat?: "JWT" | "SAML" | "WS-Security";
	description?: string;
};

// OAuth2
export type SecuritySchemes_oauth2 = {
	type: "oauth2";
	flows: swaggerJSDoc.OAuthFlows;
	description?: string;
};

// OpenID Connect
export type SecuritySchemes_openIdConnect = {
	type: "openIdConnect";
	openIdConnectUrl: string;
	description?: string;
};

// Mutual TLS
export type SecuritySchemes_mutualTLS = {
	type: "mutualTLS";
	description?: string;
};

// Union type com todos os security schemes
export type SecuritySchemesTypes = SecuritySchemes_apiKey | SecuritySchemes_http | SecuritySchemes_oauth2 | SecuritySchemes_openIdConnect | SecuritySchemes_mutualTLS;

export type DefinedSecuritySchemes<C extends swaggerJSDoc.Components, N extends string, O extends SecuritySchemesTypes> = Prettify<
	Omit<C, "securitySchemes"> & { securitySchemes: JoinSecuritySchemes<C["securitySchemes"], { [k in N]: Prettify<O> }> }
>;

export type ExtractReferences<C extends swaggerJSDoc.Components> = C extends Record<infer K, infer R> ? (R extends Record<infer E, any> ? `${K & string}/${E & string}` : never) : never;
