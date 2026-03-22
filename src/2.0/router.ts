import express from "express";
import { METHODS } from "http";
import type { ExtractRouteParameters, IRouter, Methods, RequestHandler, MiddlewareFCDoc, ITreeDoc, IRouterMatcher, PathParams, SwaggerOptions, SnippetTargets, IStackFrame } from "./type";
import { handler } from "./handler";
import { joinObject, omit, parseStack, rootStack, targetLabels } from "./utils";
import nodePath from "path";
import { renderChainDocs } from "./renderChainDocs";
import swaggerJSDoc from "swagger-jsdoc";
import OpenAPISnippet from "openapi-snippet";

class OpenAPIError extends Error {
	constructor(message: string, stackFrames: IStackFrame[] = []) {
		super(message);
		this.stack = `Error: ${message}\n` + stackFrames.map((frame) => `    at ${frame.functionName} (${frame.filePath}:${frame.lineNumber}:${frame.columnNumber})`).join("\n");
	}
}

export const router = (): IRouter => {
	const innerRouter = express.Router();

	let innerSwaggerOptions: SwaggerOptions | null = null;

	const routesDocs: Array<() => ITreeDoc | null> = [
		() => {
			return innerSwaggerOptions
				? {
						parent: innerSwaggerOptions,
						children: [],
					}
				: null;
		},
	];

	const defineRouteDoc = (method: Methods | undefined, path: string, doc?: MiddlewareFCDoc, children?: any) => {
		const stack = parseStack().filter(({ dir }) => !nodePath.resolve(dir).startsWith(nodePath.resolve(rootStack[0].dir)))[0];

		routesDocs.push((): ITreeDoc => {
			const { components = {}, ...operation } = doc || {};

			return {
				method,
				path,
				parent: {
					stackFrame: stack,
					operation,
					components,
				},
				children: (children ? children.__chain_docs__ : []) || [],
			};
		});
	};

	// Criamos o objeto com os seus métodos customizados
	const customMethods: Record<string, any> = {
		param(name: string, handler: any) {
			innerRouter.param(name, handler);
			return this as unknown as IRouter;
		},

		get __chain_docs__() {
			return routesDocs.map((getDoc) => getDoc()).filter((doc) => doc !== null && doc !== undefined) as ITreeDoc[];
		},

		route() {
			const args: [prefix: string, doc?: MiddlewareFCDoc] | [prefix: string, router: IRouter, doc?: MiddlewareFCDoc] | [router: IRouter, doc?: MiddlewareFCDoc] = Array.from(arguments) as any;

			const path: string = typeof args[0] === "string" ? args[0] : "/";

			const route: IRouter = typeof args[0] === "string" ? (typeof args[1] === "function" ? args[1] : router()) : typeof args[0] === "function" ? args[0] : router();

			const doc: MiddlewareFCDoc | undefined = typeof args[args.length - 1] === "object" && typeof args[args.length - 1] !== "function" ? (args[args.length - 1] as any) : undefined;

			innerRouter.use(path, route);
			defineRouteDoc(undefined, path, doc, route);
			return route;
		},

		use() {
			const args:
				| [prefix: string, doc?: MiddlewareFCDoc]
				| [path: PathParams, doc?: MiddlewareFCDoc]
				| [prefix: string, handlers: IRouter | RequestHandler, doc?: MiddlewareFCDoc]
				| [path: PathParams, handlers: IRouter | RequestHandler, doc?: MiddlewareFCDoc]
				| [handlers: IRouter | RequestHandler, doc?: MiddlewareFCDoc] = Array.from(arguments) as any;

			const path: PathParams | undefined = typeof args[0] === "string" || args[0] instanceof RegExp || Array.isArray(args[0]) ? args[0] : undefined;
			const handler: IRouter | RequestHandler | undefined = path ? (typeof args[1] === "function" ? args[1] : undefined) : typeof args[0] === "function" ? args[0] : undefined;
			const doc: MiddlewareFCDoc | undefined = typeof args[args.length - 1] === "object" && typeof args[args.length - 1] !== "function" ? (args[args.length - 1] as any) : undefined;

			const route = router();

			if (path) {
				if (handler) {
					innerRouter.use(path, handler);
				} else {
					innerRouter.use(path, route);
				}
			} else if (handler) {
				innerRouter.use(handler);
			}

			defineRouteDoc(undefined, "/", doc);

			return handler ? undefined : route;
		},

		defineSwagger(options: SwaggerOptions) {
			innerSwaggerOptions = options;
		},

		getSwagger() {
			if (!innerSwaggerOptions) {
				throw new Error("Swagger options not defined. Please set the swagger options using the defineSwagger method.");
			}

			const swaggerOptions = { ...innerSwaggerOptions, path: innerSwaggerOptions.path || "/doc", defaultResponses: innerSwaggerOptions.defaultResponses || {} };

			let doc: Partial<swaggerJSDoc.OAS3Definition> = { paths: swaggerOptions?.paths || {}, components: swaggerOptions?.components || {} };

			doc = joinObject(doc, renderChainDocs(this.__chain_docs__));

			const definition = {
				...omit(swaggerOptions, "path", "defaultResponses"),
				...doc,
			};

			const targets: NonNullable<SwaggerOptions["targets"]> = innerSwaggerOptions.targets || [
				"c_libcurl",
				"csharp_restsharp",
				"go_native",
				"java_unirest",
				"javascript_xhr",
				"node_native",
				"objc_nsurlsession",
				"ocaml_cohttp",
				"php_curl",
				"python_python3",
				"ruby_native",
				"shell_curl",
				"swift_nsurlsession",
			];

			for (const path in definition.paths) {
				for (const method in definition.paths[path]) {
					try {
						const generatedCode = OpenAPISnippet.getEndpointSnippets(
							{
								servers: [
									{
										url: "http://[hostname]",
									},
								],
								...definition,
							},
							path,
							method,
							targets,
						);
						definition.paths[path][method]["x-codeSamples"] = [];

						for (const snippetIdx in generatedCode.snippets) {
							const snippet = generatedCode.snippets[snippetIdx];
							definition.paths[path][method]["x-codeSamples"][snippetIdx] = { lang: targetLabels[snippet.id as SnippetTargets], label: snippet.title, source: snippet.content };
						}
					} catch (e) {
						throw new OpenAPIError(`Sintax error in the OpenAPI definition for ${method.toUpperCase()} ${path}: ${(e as Error).message}`, definition.paths[path][method]?.stackFrames);
					}
				}
			}

			return {
				definition,
				apis: [],
			} as {
				definition: swaggerJSDoc.OAS3Definition;
				apis: string[];
			};
		},
	};

	METHODS.concat("all")
		.map((m) => m.toLowerCase() as Methods)
		.forEach((method: Methods) => {
			(customMethods as any)[method] = function <Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path, doc?: MiddlewareFCDoc) {
				const rootHandler = handler((req: any, res: any, next: any) => {
					next();
				});

				innerRouter[method].apply(innerRouter, [path, rootHandler] as any);

				defineRouteDoc(method, path, doc, rootHandler);

				const props = {};

				return Object.assign(rootHandler, props) as unknown as IRouterMatcher;
			};
		});

	const routerHandler: RequestHandler = function (req, res, next) {
		return innerRouter(req, res, next);
	};

	// Mesclamos o innerRouter (que já é uma função) com os métodos
	// Usamos o 'as any' seguido do 'as CustomRouter' para convencer o TS
	return Object.setPrototypeOf(routerHandler, customMethods) as unknown as IRouter;
};
