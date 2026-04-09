import express from "express";
import { METHODS } from "http";
import type { ExtractRouteParameters, IRouter, Methods, RequestHandler, MiddlewareFCDoc, ITreeDoc, IRouterMatcher, PathParams, SwaggerOptions, SnippetTargets, TDocOperation } from "./type";
import { handler, middleware } from "./handler";
import { isRouter, joinObject, joinPaths, omit, parseStack, rootStack, targetLabels } from "./utils";
import nodePath from "path";
import { renderChainDocs } from "./renderChainDocs";
import swaggerJSDoc from "swagger-jsdoc";
import OpenAPISnippet from "openapi-snippet";
import { OpenAPIError, analyzeSwaggerJSONDoc } from "./analyzeSwagger";
import swaggerUi from "swagger-ui-express";
import swaggerMarkdown from "./swagger-markdown";
import * as redocUi from "./redocUi";
import { uuidv4 } from "@ismael1361/utils";

/**
 * Cria uma instância de {@link IRouter} com suporte a métodos HTTP tipados,
 * sub-rotas aninhadas e geração automática de documentação OpenAPI/Swagger.
 *
 * O router pode ser usado de forma independente e depois montado em uma aplicação
 * ou em outro router via `.route()` ou `.use()`, permitindo modularizar a API.
 *
 * @returns Instância de {@link IRouter} com todos os métodos HTTP e configuração Swagger.
 *
 * @example
 * // Router básico com rotas
 * import { router } from '@ismael1361/router';
 *
 * const api = router();
 *
 * api.get("/items")
 *   .handler((req, res) => {
 *     res.json([{ id: 1, name: "Item A" }]);
 *   })
 *   .doc({ tags: ["Items"], summary: "Listar itens" });
 *
 * api.post("/items")
 *   .handler((req, res) => {
 *     res.status(201).json({ id: 2, name: "Novo item" });
 *   })
 *   .doc({ tags: ["Items"], summary: "Criar item" });
 *
 * @example
 * // Montar router em uma aplicação com prefixo
 * import { create, router } from '@ismael1361/router';
 *
 * const app = create();
 * const v1 = router();
 *
 * v1.get("/test/route")
 *   .handler((req, res) => {
 *     res.send("Hello from v1!");
 *   })
 *   .doc({ tags: ["V1"], summary: "Rota de teste v1" });
 *
 * app.route("/v1", v1, {
 *   security: [{ bearerAuth: [] }],
 *   responses: {
 *     "400": { description: "Dados inválidos" },
 *     "404": { description: "Não encontrado" },
 *   },
 * });
 *
 * @example
 * // Router com Swagger habilitado
 * const api = router();
 *
 * api.get("/users/:id")
 *   .handler((req, res) => {
 *     res.json({ id: req.params.id, name: "Alice" });
 *   })
 *   .doc({
 *     tags: ["Users"],
 *     summary: "Buscar usuário por ID",
 *     parameters: [
 *       { name: "id", in: "path", required: true, schema: { type: "string" } },
 *     ],
 *   });
 *
 * api.defineSwagger({
 *   openapi: "3.0.0",
 *   info: { title: "Users API", version: "1.0.0" },
 *   path: "/doc",
 * });
 */
export const router = (): IRouter => {
	const innerRouter = express.Router();

	innerRouter.get("/.well-known/appspecific/com.chrome.devtools.json", (req, res) => {
		const workspaceUuid = uuidv4("-"); // Gera um UUID v4
		res.json({
			workspace: {
				root: "",
				uuid: workspaceUuid,
			},
		});
	});

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
		__router_path__: "/",

		get path() {
			return joinPaths(this.parent?.path || "/", this.__router_path__);
		},

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

			if (!isRouter(route)) {
				throw new Error("Invalid router instance");
			}

			(route as any).__router_path__ = path;
			route.parent = this as unknown as IRouter;

			const doc: MiddlewareFCDoc | undefined = typeof args[args.length - 1] === "object" && typeof args[args.length - 1] !== "function" ? (args[args.length - 1] as any) : undefined;

			innerRouter.use(path, route as any);
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
			(route as any).__router_path__ = path || "/";
			route.parent = this as unknown as IRouter;

			if (handler && isRouter(handler)) {
				(route as any).__router_path__ = path || "/";
				handler.parent = this as unknown as IRouter;
			}

			if (path) {
				if (handler) {
					innerRouter.use(path, handler as any);
				} else {
					innerRouter.use(path, route as any);
				}
			} else if (handler) {
				innerRouter.use(handler as any);
			}

			defineRouteDoc(undefined, "/", doc);

			return handler ? undefined : route;
		},

		middleware(handler: RequestHandler, doc?: TDocOperation) {
			const m = middleware(handler);

			if (doc) {
				m.doc(doc);
			}

			this.use(m);

			return m;
		},

		defineSwagger(options: SwaggerOptions) {
			innerSwaggerOptions = options;
			innerSwaggerOptions.stackFrames = [parseStack().filter(({ dir }) => !nodePath.resolve(dir).startsWith(nodePath.resolve(rootStack[0].dir)))[0]];

			this.analyzeSwaggerDoc();

			const getSwaggerMarkdown = () => {
				return swaggerMarkdown.convert(this.getSwagger());
			};

			const getSwaggerOptions = () => {
				return this.getSwagger();
			};

			const getSwaggerDefinition = () => {
				return swaggerJSDoc(this.getSwagger());
			};

			innerRouter.use("/doc/.md", (req, res) => {
				try {
					res.setHeader("Content-Type", "text/markdown");
					res.send(getSwaggerMarkdown());
				} catch (e) {
					res.status(500).send(e instanceof OpenAPIError ? e.stack : String(e));
				}
			});

			innerRouter.use("/doc/markdown", (req, res, next) => {
				try {
					swaggerMarkdown.setup(getSwaggerOptions()).apply(this.app, [req, res, next]);
				} catch (e) {
					res.status(500).send(e instanceof OpenAPIError ? e.stack : String(e));
				}
			});

			innerRouter.get("/doc/swagger/definition.json", (req, res) => {
				try {
					res.json(getSwaggerDefinition());
				} catch (e) {
					res.status(500).send(e instanceof OpenAPIError ? e.stack : String(e));
				}
			});

			innerRouter.use("/doc/swagger", swaggerUi.serve, (req: any, res: any, next: any) => {
				try {
					swaggerUi.setup(getSwaggerDefinition()).apply(this.app, [req, res, next]);
				} catch (e) {
					res.status(500).send(e instanceof OpenAPIError ? e.stack : String(e));
				}
			});

			innerRouter.use("/doc/redoc", (req, res, next) => {
				try {
					redocUi.setup(getSwaggerOptions()).apply(this.app, [req, res, next]);
				} catch (e) {
					res.status(500).send(e instanceof OpenAPIError ? e.stack : String(e));
				}
			});

			return {
				markdownPath: joinPaths(this.path, "/doc/.md"),
				definitionPath: joinPaths(this.path, "/doc/swagger/definition.json"),
				swaggerUiPath: joinPaths(this.path, "/doc/swagger"),
				redocUiPath: joinPaths(this.path, "/doc/redoc"),
			};
		},

		__getSwaggerDefinition__() {
			if (!innerSwaggerOptions) {
				throw new Error("Swagger options not defined. Please set the swagger options using the defineSwagger method.");
			}

			const swaggerOptions = { ...innerSwaggerOptions, path: innerSwaggerOptions.path || "/doc", defaultResponses: innerSwaggerOptions.defaultResponses || {} };

			let doc: Partial<swaggerJSDoc.OAS3Definition> = { paths: swaggerOptions?.paths || {}, components: swaggerOptions?.components || {} };

			doc = joinObject(doc, renderChainDocs(this.__chain_docs__));

			const definition = {
				...omit(swaggerOptions, "path", "defaultResponses"),
				...omit(doc, "path", "defaultResponses"),
			};

			const convertExpressPathToSwagger = (path: string): string => {
				// A regex busca por padrões que começam com ':'
				// Seguidos por caracteres alfanuméricos (o nome do parâmetro)
				// E ignora o sufixo '?' caso seja um parâmetro opcional do Express
				return path.replace(/:([a-zA-Z0-9_]+)\??/g, "{$1}");
			};

			if (definition.paths) {
				const newPaths: Record<string, any> = {};
				for (const path in definition.paths) {
					const convertedPath = convertExpressPathToSwagger(path);
					newPaths[convertedPath] = { ...definition.paths[path] };
				}
				definition.paths = newPaths;
			}

			return definition as swaggerJSDoc.OAS3Definition;
		},

		analyzeSwaggerDoc() {
			try {
				if (!innerSwaggerOptions) {
					return;
				}

				const definition: swaggerJSDoc.OAS3Definition = this.__getSwaggerDefinition__();

				const analysisErrors = analyzeSwaggerJSONDoc(definition);

				if (analysisErrors.length <= 0) {
					return;
				}

				for (const error of analysisErrors) {
					console.log("");
					error.print();
				}

				console.log("");
			} catch {}
		},

		getSwagger() {
			if (!innerSwaggerOptions) {
				throw new Error("Swagger options not defined. Please set the swagger options using the defineSwagger method.");
			}

			const definition: swaggerJSDoc.OAS3Definition = this.__getSwaggerDefinition__();

			// Valida o documento OAS antes de gerar os snippets
			const analysisErrors = analyzeSwaggerJSONDoc(definition);
			if (analysisErrors.length > 0) {
				analysisErrors[0].print();
				throw analysisErrors[0];
			}

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

						if ("stackFrames" in definition.paths[path][method]) {
							delete definition.paths[path][method].stackFrames;
						}
					} catch (e) {
						throw new OpenAPIError(`Sintax error in the OpenAPI definition for ${method.toUpperCase()} ${path}: ${(e as Error).message}`, definition.paths[path][method]?.stackFrames);
					}
				}
			}

			if (definition.components && "stackFrames" in definition.components) {
				delete definition.components.stackFrames;
			}

			if ("defaultResponses" in definition) {
				delete definition.defaultResponses;
			}

			if ("stackFrames" in definition) {
				delete definition.stackFrames;
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
