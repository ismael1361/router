import swaggerJSDoc from "swagger-jsdoc";
import { IStackFrame } from "./type";

export class OpenAPIError extends Error {
	// public readonly stackFrames: IStackFrame[];

	constructor(message: string, stackFrames: IStackFrame[] = []) {
		super(message);
		this.name = "OpenAPIError";
		// this.stackFrames = stackFrames;
		this.stack = `OpenAPIError: ${message}\n` + stackFrames.map((frame) => `    at ${frame.functionName} (${frame.filePath}:${frame.lineNumber}:${frame.columnNumber})`).join("\n");
	}
}

const VALID_METHODS = new Set(["get", "put", "post", "delete", "options", "head", "patch", "trace"]);
const VALID_PARAMETER_IN = new Set(["query", "header", "path", "cookie"]);
const VALID_SCHEMA_TYPES = new Set(["string", "number", "integer", "boolean", "array", "object"]);
const VALID_SECURITY_TYPES = new Set(["apiKey", "http", "oauth2", "openIdConnect"]);

/**
 * Extrai nomes de parâmetros de um template de path
 * ex: "/users/{userId}/posts/{postId}" → ["userId", "postId"]
 * ex: "/users/:userId/books/:bookId" → ["userId", "bookId"]
 * ex: "/flights/:from-:to" → ["from", "to"]
 */
const extractPathTemplateParams = (path: string): string[] => {
	const matches = path.match(/\{([A-Za-z0-9_]+)\}/g) || path.match(/:([A-Za-z0-9_]+)/g);
	return matches ? matches.map((m) => m.replace(/[:{}]/g, "")) : [];
};

/**
 * Resolve uma referência $ref no documento OAS, retornando o objeto referenciado ou undefined.
 */
const resolveRef = (ref: string, doc: Record<string, any>): any => {
	if (!ref.startsWith("#/")) return undefined;
	const parts = ref.slice(2).split("/");
	let current: any = doc;
	for (const part of parts) {
		if (current === undefined || current === null || typeof current !== "object") return undefined;
		current = current[decodeURIComponent(part.replace(/~1/g, "/").replace(/~0/g, "~"))];
	}
	return current;
};

type ValidationError = {
	message: string;
	path: string;
	stackFrames: IStackFrame[];
};

// --- Funções auxiliares de validação ---

function validateParameter(param: Record<string, any>, context: string, stackFrames: IStackFrame[], errors: ValidationError[]) {
	if (!param.name) {
		errors.push({ message: `Campo obrigatório 'name' ausente no parâmetro`, path: context, stackFrames });
	}
	if (!param.in) {
		errors.push({ message: `Campo obrigatório 'in' ausente no parâmetro '${param.name ?? "?"}'`, path: context, stackFrames });
	} else if (!VALID_PARAMETER_IN.has(param.in)) {
		errors.push({
			message: `Valor inválido '${param.in}' para 'in' no parâmetro '${param.name ?? "?"}'. Esperado: ${[...VALID_PARAMETER_IN].join(", ")}`,
			path: context,
			stackFrames,
		});
	}
	if (param.in === "path" && param.required !== true) {
		errors.push({ message: `Parâmetro de path '${param.name ?? "?"}' deve ter 'required: true'`, path: context, stackFrames });
	}
	if (param.schema) {
		validateSchema(param.schema, `${context}.schema`, {} as any, stackFrames, errors);
	}
}

function validateSchema(schema: any, context: string, doc: Record<string, any>, stackFrames: IStackFrame[], errors: ValidationError[]) {
	if (!schema || typeof schema !== "object") return;

	if ("$ref" in schema) {
		const resolved = resolveRef(schema.$ref, doc);
		if (resolved === undefined) {
			errors.push({ message: `Referência não resolvida '${schema.$ref}'`, path: context, stackFrames });
		}
		return;
	}

	if (schema.type && !VALID_SCHEMA_TYPES.has(schema.type)) {
		errors.push({
			message: `Tipo inválido '${schema.type}'. Esperado: ${[...VALID_SCHEMA_TYPES].join(", ")}`,
			path: context,
			stackFrames,
		});
	}

	if (schema.type === "array" && !schema.items) {
		errors.push({ message: `Schema do tipo 'array' deve ter 'items' definido`, path: context, stackFrames });
	}

	if (schema.properties && typeof schema.properties === "object") {
		for (const [propName, propSchema] of Object.entries(schema.properties)) {
			validateSchema(propSchema, `${context}.properties.${propName}`, doc, stackFrames, errors);
		}
	}

	if (schema.items) {
		validateSchema(schema.items, `${context}.items`, doc, stackFrames, errors);
	}

	const composites: Array<"allOf" | "oneOf" | "anyOf"> = ["allOf", "oneOf", "anyOf"];
	for (const keyword of composites) {
		if (Array.isArray(schema[keyword])) {
			schema[keyword].forEach((s: any, i: number) => validateSchema(s, `${context}.${keyword}[${i}]`, doc, stackFrames, errors));
		}
	}

	if (schema.not) {
		validateSchema(schema.not, `${context}.not`, doc, stackFrames, errors);
	}

	if (schema.additionalProperties && typeof schema.additionalProperties === "object") {
		validateSchema(schema.additionalProperties, `${context}.additionalProperties`, doc, stackFrames, errors);
	}

	// Valida que todas as propriedades listadas em 'required' existem em 'properties'
	if (Array.isArray(schema.required) && schema.properties) {
		for (const req of schema.required) {
			if (!(req in schema.properties)) {
				errors.push({ message: `Propriedade obrigatória '${req}' não definida em 'properties'`, path: context, stackFrames });
			}
		}
	}
}

function validateRequestBody(requestBody: Record<string, any>, context: string, doc: Record<string, any>, stackFrames: IStackFrame[], errors: ValidationError[]) {
	if ("$ref" in requestBody) {
		const resolved = resolveRef(requestBody.$ref, doc);
		if (resolved === undefined) {
			errors.push({ message: `Referência não resolvida '${requestBody.$ref}'`, path: context, stackFrames });
		}
		return;
	}

	if (!requestBody.content) {
		errors.push({ message: `Campo obrigatório 'content' ausente no requestBody`, path: context, stackFrames });
		return;
	}

	for (const [mediaType, mediaObj] of Object.entries(requestBody.content)) {
		if ((mediaObj as any)?.schema) {
			validateSchema((mediaObj as any).schema, `${context}.content['${mediaType}'].schema`, doc, stackFrames, errors);
		}
	}
}

function validateResponses(responses: Record<string, any>, context: string, doc: Record<string, any>, stackFrames: IStackFrame[], errors: ValidationError[]) {
	for (const [statusCode, response] of Object.entries(responses)) {
		const responseContext = `${context}.responses['${statusCode}']`;

		if (typeof response !== "object" || response === null) {
			errors.push({ message: `Resposta '${statusCode}' inválida`, path: responseContext, stackFrames });
			continue;
		}

		if ("$ref" in response) {
			const resolved = resolveRef((response as any).$ref, doc);
			if (resolved === undefined) {
				errors.push({ message: `Referência não resolvida '${(response as any).$ref}'`, path: responseContext, stackFrames });
			}
			continue;
		}

		if (!(response as any).description) {
			errors.push({ message: `Campo obrigatório 'description' ausente na resposta '${statusCode}'`, path: responseContext, stackFrames });
		}

		if ((response as any).content) {
			for (const [mediaType, mediaObj] of Object.entries((response as any).content)) {
				if ((mediaObj as any)?.schema) {
					validateSchema((mediaObj as any).schema, `${responseContext}.content['${mediaType}'].schema`, doc, stackFrames, errors);
				}
			}
		}

		if ((response as any).headers) {
			for (const [headerName, header] of Object.entries((response as any).headers)) {
				if (typeof header === "object" && header !== null && "$ref" in header) {
					const resolved = resolveRef((header as any).$ref, doc);
					if (resolved === undefined) {
						errors.push({ message: `Referência não resolvida '${(header as any).$ref}' no header '${headerName}'`, path: responseContext, stackFrames });
					}
				}
			}
		}
	}
}

function validateSecurityRequirements(security: ReadonlyArray<Record<string, readonly string[]>>, context: string, doc: Record<string, any>, stackFrames: IStackFrame[], errors: ValidationError[]) {
	for (const requirement of security) {
		for (const schemeName of Object.keys(requirement)) {
			if (!doc.components?.securitySchemes?.[schemeName]) {
				errors.push({
					message: `Esquema de segurança '${schemeName}' referenciado mas não definido em components.securitySchemes`,
					path: context,
					stackFrames,
				});
			}
		}
	}
}

// --- Função principal de análise ---

export const analyzeSwaggerJSONDoc = (doc: swaggerJSDoc.OAS3Definition): OpenAPIError[] => {
	const errors: ValidationError[] = [];
	const docAny = doc as Record<string, any>;

	// ═══════════════════════════════════════════
	// Validação de campos top-level obrigatórios
	// ═══════════════════════════════════════════

	if (!doc.openapi) {
		errors.push({ message: "Campo obrigatório 'openapi' ausente", path: "openapi", stackFrames: doc?.stackFrames ?? [] });
	} else if (!/^3\.\d+\.\d+$/.test(doc.openapi)) {
		errors.push({ message: `Versão 'openapi' inválida: '${doc.openapi}'. Formato esperado: 3.x.x`, path: "openapi", stackFrames: doc?.stackFrames ?? [] });
	}

	if (!doc.info) {
		errors.push({ message: "Campo obrigatório 'info' ausente", path: "info", stackFrames: doc?.stackFrames ?? [] });
	} else {
		if (!doc.info.title) {
			errors.push({ message: "Campo obrigatório 'info.title' ausente", path: "info.title", stackFrames: doc?.stackFrames ?? [] });
		}
		if (!doc.info.version) {
			errors.push({ message: "Campo obrigatório 'info.version' ausente", path: "info.version", stackFrames: doc?.stackFrames ?? [] });
		}
	}

	// ═══════════════════════════════════
	// Validação de components
	// ═══════════════════════════════════

	if (doc.components) {
		const compStackFrames: IStackFrame[] = (docAny.components as any)?.stackFrames ?? [];

		// Schemas
		if (doc.components.schemas) {
			for (const [name, schema] of Object.entries(doc.components.schemas)) {
				validateSchema(schema, `components.schemas.${name}`, docAny, compStackFrames, errors);
			}
		}

		// Security schemes
		if (doc.components.securitySchemes) {
			for (const [name, scheme] of Object.entries(doc.components.securitySchemes)) {
				if (typeof scheme !== "object" || scheme === null) continue;
				if ("$ref" in scheme) {
					const resolved = resolveRef((scheme as any).$ref, docAny);
					if (resolved === undefined) {
						errors.push({ message: `Referência não resolvida '${(scheme as any).$ref}'`, path: `components.securitySchemes.${name}`, stackFrames: compStackFrames });
					}
					continue;
				}
				const s = scheme as Record<string, any>;
				if (!s.type) {
					errors.push({ message: `Campo obrigatório 'type' ausente no esquema de segurança '${name}'`, path: `components.securitySchemes.${name}`, stackFrames: compStackFrames });
				} else if (!VALID_SECURITY_TYPES.has(s.type)) {
					errors.push({
						message: `Tipo inválido '${s.type}' no esquema de segurança '${name}'. Esperado: ${[...VALID_SECURITY_TYPES].join(", ")}`,
						path: `components.securitySchemes.${name}`,
						stackFrames: compStackFrames,
					});
				} else {
					if (s.type === "apiKey") {
						if (!s.name) errors.push({ message: `Campo obrigatório 'name' ausente no esquema apiKey '${name}'`, path: `components.securitySchemes.${name}`, stackFrames: compStackFrames });
						if (!s.in) errors.push({ message: `Campo obrigatório 'in' ausente no esquema apiKey '${name}'`, path: `components.securitySchemes.${name}`, stackFrames: compStackFrames });
					}
					if (s.type === "http" && !s.scheme) {
						errors.push({ message: `Campo obrigatório 'scheme' ausente no esquema http '${name}'`, path: `components.securitySchemes.${name}`, stackFrames: compStackFrames });
					}
					if (s.type === "oauth2" && !s.flows) {
						errors.push({ message: `Campo obrigatório 'flows' ausente no esquema oauth2 '${name}'`, path: `components.securitySchemes.${name}`, stackFrames: compStackFrames });
					}
					if (s.type === "openIdConnect" && !s.openIdConnectUrl) {
						errors.push({
							message: `Campo obrigatório 'openIdConnectUrl' ausente no esquema openIdConnect '${name}'`,
							path: `components.securitySchemes.${name}`,
							stackFrames: compStackFrames,
						});
					}
				}
			}
		}

		// Request bodies
		if (doc.components.requestBodies) {
			for (const [name, body] of Object.entries(doc.components.requestBodies)) {
				validateRequestBody(body as Record<string, any>, `components.requestBodies.${name}`, docAny, compStackFrames, errors);
			}
		}

		// Responses
		if (doc.components.responses) {
			for (const [name, response] of Object.entries(doc.components.responses)) {
				if (typeof response === "object" && response !== null && !("$ref" in response) && !(response as any).description) {
					errors.push({ message: `Campo obrigatório 'description' ausente na resposta '${name}'`, path: `components.responses.${name}`, stackFrames: compStackFrames });
				}
			}
		}

		// Parameters
		if (doc.components.parameters) {
			for (const [name, param] of Object.entries(doc.components.parameters)) {
				if (typeof param === "object" && param !== null && !("$ref" in param)) {
					validateParameter(param as Record<string, any>, `components.parameters.${name}`, compStackFrames, errors);
				}
			}
		}
	}

	// ═══════════════════════════════════
	// Validação de paths e operações
	// ═══════════════════════════════════

	if (doc.paths) {
		for (const [path, pathItem] of Object.entries(doc.paths)) {
			if (!path.startsWith("/")) {
				errors.push({ message: `Path '${path}' deve começar com '/'`, path: `paths.${path}`, stackFrames: [] });
			}

			if (typeof pathItem !== "object" || pathItem === null) continue;

			const templateParams = extractPathTemplateParams(path);

			// Parâmetros no nível de path
			const pathLevelParams: string[] = [];
			if ((pathItem as any).parameters) {
				for (const param of (pathItem as any).parameters) {
					if (typeof param === "object" && param !== null && !("$ref" in param) && param.in === "path") {
						pathLevelParams.push(param.name);
					}
				}
			}

			for (const [method, operation] of Object.entries(pathItem as Record<string, any>)) {
				if (method === "parameters" || method === "$ref" || method === "summary" || method === "description" || method === "servers") continue;
				if (!VALID_METHODS.has(method)) continue;

				const opStackFrames: IStackFrame[] = operation?.stackFrames ?? [];
				const operationContext = `paths['${path}'].${method}`;

				if (typeof operation !== "object" || operation === null) {
					errors.push({ message: `Definição de operação inválida para ${method.toUpperCase()} ${path}`, path: operationContext, stackFrames: opStackFrames });
					continue;
				}

				// Responses obrigatório
				if (!operation.responses || Object.keys(operation.responses).length === 0) {
					errors.push({ message: `Campo obrigatório 'responses' ausente em ${method.toUpperCase()} ${path}`, path: operationContext, stackFrames: opStackFrames });
				} else {
					validateResponses(operation.responses, operationContext, docAny, opStackFrames, errors);
				}

				// Validação de parâmetros
				const definedPathParams: string[] = [...pathLevelParams];
				if (Array.isArray(operation.parameters)) {
					for (const param of operation.parameters) {
						if (typeof param !== "object" || param === null) continue;
						if ("$ref" in param) {
							const resolved = resolveRef(param.$ref, docAny);
							if (resolved === undefined) {
								errors.push({ message: `Referência não resolvida '${param.$ref}' nos parâmetros`, path: operationContext, stackFrames: opStackFrames });
							} else if (resolved.in === "path") {
								definedPathParams.push(resolved.name);
							}
							continue;
						}
						validateParameter(param, operationContext, opStackFrames, errors);
						if (param.in === "path" && param.name) {
							definedPathParams.push(param.name);
						}
					}
				}

				// Verifica que todos os parâmetros do template de path estão definidos
				for (const tp of templateParams) {
					if (!definedPathParams.includes(tp)) {
						errors.push({
							message: `Parâmetro de path '{${tp}}' presente no template '${path}' mas não definido nos parâmetros de ${method.toUpperCase()} ${path}`,
							path: operationContext,
							stackFrames: opStackFrames,
						});
					}
				}

				// Validação do requestBody
				if (operation.requestBody) {
					validateRequestBody(operation.requestBody, `${operationContext}.requestBody`, docAny, opStackFrames, errors);
				}

				// Validação de security
				if (operation.security) {
					validateSecurityRequirements(operation.security, operationContext, docAny, opStackFrames, errors);
				}

				// Validação de operationId único será feita após coletar todos
			}
		}
	}

	// ═══════════════════════════════════
	// Validação de operationId duplicados
	// ═══════════════════════════════════

	if (doc.paths) {
		const operationIds = new Map<string, { method: string; path: string; stackFrames: IStackFrame[] }>();
		for (const [path, pathItem] of Object.entries(doc.paths)) {
			if (typeof pathItem !== "object" || pathItem === null) continue;
			for (const [method, operation] of Object.entries(pathItem as Record<string, any>)) {
				if (!VALID_METHODS.has(method) || typeof operation !== "object" || operation === null) continue;
				if (operation.operationId) {
					const existing = operationIds.get(operation.operationId);
					if (existing) {
						const opStackFrames: IStackFrame[] = operation?.stackFrames ?? [];
						errors.push({
							message: `operationId '${operation.operationId}' duplicado: definido em ${existing.method.toUpperCase()} ${existing.path} e ${method.toUpperCase()} ${path}`,
							path: `paths['${path}'].${method}.operationId`,
							stackFrames: [...(existing.stackFrames ?? []), ...opStackFrames],
						});
					} else {
						operationIds.set(operation.operationId, { method, path, stackFrames: operation?.stackFrames ?? [] });
					}
				}
			}
		}
	}

	// ═══════════════════════════════════
	// Validação de security global
	// ═══════════════════════════════════

	if (doc.security) {
		validateSecurityRequirements(doc.security, "security", docAny, [], errors);
	}

	// ═══════════════════════════════════
	// Validação de tags
	// ═══════════════════════════════════

	if (doc.tags) {
		const tagNames = new Set<string>();
		for (const tag of doc.tags) {
			if (!tag.name) {
				errors.push({ message: "Campo obrigatório 'name' ausente na tag", path: "tags", stackFrames: doc?.stackFrames ?? [] });
			} else if (tagNames.has(tag.name)) {
				errors.push({ message: `Tag '${tag.name}' duplicada`, path: "tags", stackFrames: doc?.stackFrames ?? [] });
			} else {
				tagNames.add(tag.name);
			}
		}
	}

	// ═══════════════════════════════════
	// Validação de servers
	// ═══════════════════════════════════

	if (doc.servers) {
		for (const [i, server] of doc.servers.entries()) {
			if (!server.url) {
				errors.push({ message: `Campo obrigatório 'url' ausente no server[${i}]`, path: `servers[${i}]`, stackFrames: doc?.stackFrames ?? [] });
			}
		}
	}

	// Converte ValidationError[] em OpenAPIError[]
	return errors.map((e) => new OpenAPIError(`${e.message} (em ${e.path})`, e.stackFrames));
};
