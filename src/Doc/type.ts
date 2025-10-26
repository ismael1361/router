import type swaggerJSDoc from "swagger-jsdoc";
import { Prettify } from "../type";

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
export type SecuritySchemesTypes = SecuritySchemes_apiKey | SecuritySchemes_http | SecuritySchemes_oauth2 | SecuritySchemes_openIdConnect | SecuritySchemes_mutualTLS | swaggerJSDoc.SecurityScheme;

export type ExtractScopesBySecuritySchemes<S> = S extends swaggerJSDoc.SecurityScheme & {
	flows?: infer F;
}
	? F extends Record<string, infer Flow>
		? Flow extends swaggerJSDoc.OAuthFlow
			? keyof NonNullable<Flow["scopes"]>
			: never
		: never
	: S extends ComponentSecurity<any, infer I>
	? ExtractScopesBySecuritySchemes<I>
	: never;

export type ComponentSecurity<N extends string, O extends SecuritySchemesTypes> = {
	securitySchemes: {
		[k in N]: Prettify<O>;
	};
};

export type ComponentSchema<N extends string, S extends swaggerJSDoc.Schema> = {
	schemas: { [k in N]: Prettify<S> };
};

export type Reference<R> = R extends string
	? R extends `#/components/${infer I}`
		? { $ref: `#/components/${I}` }
		: { $ref: `#/components/${R}` }
	: R extends ComponentSecurity<infer N, any>
	? `#/components/securitySchemes/${N}`
	: R extends ComponentSchema<infer N, any>
	? `#/components/schemas/${N}`
	: never;

export interface ModelValueNumber extends swaggerJSDoc.Schema {
	type?: "number" | "integer";
	format?: "float" | "double" | "int32" | "int64";
	minimum?: number;
	maximum?: number;
	exclusiveMinimum?: boolean;
	exclusiveMaximum?: boolean;
	description?: string;
	nullable?: boolean;
}

export interface ModelValueString extends swaggerJSDoc.Schema {
	format?: "date" | "date-time" | "password" | "byte" | "binary" | "email" | "uuid" | "uri" | "hostname" | "ipv4" | "ipv6";
	minLength?: number;
	maxLength?: number;
	description?: string;
	pattern?: RegExp | string;
	nullable?: boolean;
}
