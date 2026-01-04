import swaggerJSDoc from "swagger-jsdoc";
import type { MiddlewareCallback, MiddlewareFCDoc, NextFunction, Request, Response, SwaggerOptions } from "./type";
import { Handler, RequestHandler } from "./handler";
import { createDynamicMiddleware, getRoutes, getRoutesExpress, joinObject, joinPath, omit } from "./utils";
import { Layer } from "./Layer";
import * as http from "http";
import express, { Express, Router as ExpressRouter } from "express";
import swaggerUi from "swagger-ui-express";
import * as redocUi from "./redocUi";
import { RequestMiddleware } from "./middleware";
import { HandleError } from "./HandleError";
import swaggerMarkdown from "./swagger-markdown";
import path from "path";
import { uuidv4 } from "@ismael1361/utils";
import OpenAPISnippet from "openapi-snippet";
import * as Middlewares from "./Middlewares";

/**
 * A classe principal do roteador, que encapsula e aprimora o roteador do Express.
 * Fornece uma API fluente e fortemente tipada para definir rotas, aplicar middlewares
 * e gerar documentação OpenAPI (Swagger/ReDoc) de forma integrada.
 *
 * @template Rq - O tipo base de `Request` para este roteador.
 * @template Rs - O tipo base de `Response` para este roteador.
 *
 * @example
 * import { create, Middlewares } from '@ismael1361/router';
 *
 * const app = create();
 * app.middleware(Middlewares.json());
 *
 * app.get('/health', { summary: 'Verifica a saúde da API' })
 *   .handler((req, res) => {
 *     res.status(200).send('OK');
 *   });
 *
 * app.listen(3000, () => {
 *   console.log('Servidor rodando na porta 3000');
 * });
 */
export class Router<Rq extends Request = Request, Rs extends Response = Response> {
	/** A instância subjacente do Express. */
	public app: Express = express();
	readonly express_router: ExpressRouter = express.Router();

	/**
	 * @internal
	 * @param {string} [routePath=""] - O prefixo de caminho para este roteador.
	 * @param {Layer} [layers=new Layer()] - A camada interna para gerenciar rotas e middlewares.
	 */
	constructor(readonly routePath: string = "", readonly layers: Layer = new Layer()) {
		this.layers.path = routePath;
	}

	/**
	 * Anexa documentação OpenAPI a um grupo de rotas (um roteador).
	 * Útil para definir informações comuns, como tags, para um conjunto de rotas.
	 *
	 * @param {swaggerJSDoc.Operation} operation - O objeto de operação OpenAPI.
	 * @param {swaggerJSDoc.Components} [components={}] - Componentes OpenAPI.
	 */
	doc(operation: swaggerJSDoc.Operation, components: swaggerJSDoc.Components = {}) {
		this.layers.doc = { ...operation, components };
	}

	/**
	 * Aplica um middleware a todas as rotas subsequentes definidas neste roteador.
	 *
	 * @template Req - Tipo de `Request` estendido pelo middleware.
	 * @template Res - Tipo de `Response` estendido pelo middleware.
	 * @param {MiddlewareCallback<Rq & Req, Rs & Res>} callback - A função ou componente de middleware.
	 * @param {MiddlewareFCDoc} [doc] - Documentação OpenAPI opcional para este middleware.
	 * @returns {Router<Rq & Req, Rs & Res>} A instância do roteador com os tipos atualizados.
	 */
	middleware<Req extends Request = Request, Res extends Response = Response>(callback: MiddlewareCallback<Rq & Req, Rs & Res>, doc?: MiddlewareFCDoc): Router<Rq & Req, Rs & Res> {
		if (callback instanceof RequestMiddleware) {
			callback.router.layers
				.filter(({ type, handle }) => type === "middleware" && !!handle)
				.map(({ handle }) => handle!)
				.forEach((handle) => this.layers.middleware(handle, doc));
		} else {
			this.layers.middleware([callback].map(createDynamicMiddleware), doc);
		}
		return this;
	}

	/**
	 * Executa a cadeia de middlewares globais aplicados diretamente a esta instância do roteador.
	 * Este método é útil principalmente para testes, permitindo invocar a lógica dos middlewares
	 * do roteador de forma isolada, sem a necessidade de um servidor HTTP completo.
	 *
	 * @param {Rq} request - O objeto de requisição (ou um mock para testes).
	 * @param {Rs} response - O objeto de resposta (ou um mock para testes).
	 * @param {NextFunction} next - A função `next` a ser chamada ao final da cadeia de middlewares.
	 * @returns {Promise<void>} Uma promessa que resolve quando a execução da cadeia é concluída.
	 *
	 * @example
	 * import { create, Request, Response, NextFunction } from '@ismael1361/router';
	 *
	 * // 1. Crie um roteador e adicione middlewares globais a ele
	 * const app = create();
	 * app.middleware<{ traceId: string }>((req, res, next) => {
	 *   req.traceId = 'xyz-123';
	 *   next();
	 * });
	 *
	 * // 2. Crie mocks para os objetos de requisição, resposta e next
	 * const mockRequest = {} as Request & { traceId: string };
	 *
	 * // 3. Execute a cadeia de middlewares do roteador
	 * await app.executeMiddlewares(mockRequest, {} as Response, () => {});
	 * console.log(mockRequest.traceId); // Output: 'xyz-123'
	 */
	executeMiddlewares(request: Rq, response: Rs, next: NextFunction) {
		return this.layers.executeMiddlewares(request, response, next);
	}

	/**
	 * Cria um componente de manipulador (handler) reutilizável.
	 * Este método é um atalho para a função `handler` exportada, permitindo criar
	 * um manipulador completo e reutilizável que pode encapsular uma ou mais funções de middleware
	 * e um manipulador final.
	 *
	 * @example
	 * // Crie um manipulador reutilizável que primeiro executa um middleware e depois a lógica principal.
	 * const processDataHandler = app.handler(
	 *   middleware(dataValidationMiddleware)
	 *     .handler((req, res) => {
	 *       // A lógica principal do handler aqui.
	 *       res.json({ processedData: req.validatedData });
	 *     })
	 * );
	 *
	 * // Use o manipulador reutilizável em uma rota.
	 * app.post('/process', { summary: 'Processar dados' })
	 *   .handler(processDataHandler);
	 *
	 * @param {MiddlewareCallback<Rq & Req, Rs & Res>} callback - A função ou componente de middleware/handler.
	 * @param {MiddlewareFCDoc} [doc] - Documentação OpenAPI opcional para este manipulador.
	 * @returns {Handler<Rq & Req, Rs & Res>} Uma instância de `Handler` que pode ser usada em rotas.
	 */
	handler<Req extends Request = Request, Res extends Response = Response>(callback: MiddlewareCallback<Rq & Req, Rs & Res>, doc?: MiddlewareFCDoc): Handler<Rq & Req, Rs & Res> {
		return new Handler(callback, undefined, doc);
	}

	/**
	 * Inicia a definição de uma rota para o método HTTP GET.
	 *
	 * @example
	 * router.get('/users/:id', { summary: 'Obter um usuário' })
	 *   .handler((req, res) => {
	 *     // req.params.id está disponível
	 *     res.json({ id: req.params.id, name: 'John Doe' });
	 *   });
	 *
	 * @param {string} path - O caminho da rota (ex: '/users', '/users/:id').
	 * @param {MiddlewareFCDoc} doc - (Opcional) Documentação OpenAPI para o manipulador de rota.
	 * @returns {RequestHandler<Rq, Rs>} Uma instância de `RequestHandler` para encadear middlewares e o manipulador final.
	 */
	get(path: string, doc?: MiddlewareFCDoc): RequestHandler<Rq, Rs> {
		return new RequestHandler(this, "get", path, doc);
	}

	/**
	 * Inicia a definição de uma rota para o método HTTP POST.
	 *
	 * @example
	 * router.post('/users', { summary: 'Criar um usuário' })
	 *   .handler((req, res) => {
	 *     const newUser = req.body;
	 *     res.status(201).json({ id: 'new-id', ...newUser });
	 *   });
	 *
	 * @param {string} path - O caminho da rota.
	 * @param {MiddlewareFCDoc} doc - (Opcional) Documentação OpenAPI para o manipulador de rota.
	 * @returns {RequestHandler<Rq, Rs>} Uma instância de `RequestHandler` para encadear middlewares e o manipulador final.
	 */
	post(path: string, doc?: MiddlewareFCDoc): RequestHandler<Rq, Rs> {
		return new RequestHandler(this, "post", path, doc);
	}

	/**
	 * Inicia a definição de uma rota para o método HTTP PUT.
	 * @param {string} path - O caminho da rota.
	 * @param {MiddlewareFCDoc} doc - (Opcional) Documentação OpenAPI para o manipulador de rota.
	 * @returns {RequestHandler<Rq, Rs>} Uma instância de `RequestHandler` para encadear middlewares e o manipulador final.
	 */
	put(path: string, doc?: MiddlewareFCDoc): RequestHandler<Rq, Rs> {
		return new RequestHandler(this, "put", path, doc);
	}

	/**
	 * Inicia a definição de uma rota para o método HTTP DELETE.
	 * @param {string} path - O caminho da rota.
	 * @param {MiddlewareFCDoc} doc - (Opcional) Documentação OpenAPI para o manipulador de rota.
	 * @returns {RequestHandler<Rq, Rs>} Uma instância de `RequestHandler` para encadear middlewares e o manipulador final.
	 */
	delete(path: string, doc?: MiddlewareFCDoc): RequestHandler<Rq, Rs> {
		return new RequestHandler(this, "delete", path, doc);
	}

	/**
	 * Inicia a definição de uma rota para o método HTTP PATCH.
	 * @param {string} path - O caminho da rota.
	 * @param {MiddlewareFCDoc} doc - (Opcional) Documentação OpenAPI para o manipulador de rota.
	 * @returns {RequestHandler<Rq, Rs>} Uma instância de `RequestHandler` para encadear middlewares e o manipulador final.
	 */
	patch(path: string, doc?: MiddlewareFCDoc): RequestHandler<Rq, Rs> {
		return new RequestHandler(this, "patch", path, doc);
	}

	/**
	 * Inicia a definição de uma rota para o método HTTP OPTIONS.
	 * @param {string} path - O caminho da rota.
	 * @param {MiddlewareFCDoc} doc - (Opcional) Documentação OpenAPI para o manipulador de rota.
	 * @returns {RequestHandler<Rq, Rs>} Uma instância de `RequestHandler` para encadear middlewares e o manipulador final.
	 */
	options(path: string, doc?: MiddlewareFCDoc): RequestHandler<Rq, Rs> {
		return new RequestHandler(this, "options", path, doc);
	}

	/**
	 * Inicia a definição de uma rota para o método HTTP HEAD.
	 * @param {string} path - O caminho da rota.
	 * @param {MiddlewareFCDoc} doc - (Opcional) Documentação OpenAPI para o manipulador de rota.
	 * @returns {RequestHandler<Rq, Rs>} Uma instância de `RequestHandler` para encadear middlewares e o manipulador final.
	 */
	head(path: string, doc?: MiddlewareFCDoc): RequestHandler<Rq, Rs> {
		return new RequestHandler(this, "head", path, doc);
	}

	/**
	 * Inicia a definição de uma rota que corresponde a todos os métodos HTTP.
	 * @param {string} path - O caminho da rota.
	 * @param {MiddlewareFCDoc} doc - (Opcional) Documentação OpenAPI para o manipulador de rota.
	 * @returns {RequestHandler<Rq, Rs>} Uma instância de `RequestHandler` para encadear middlewares e o manipulador final.
	 */
	all(path: string, doc?: MiddlewareFCDoc): RequestHandler<Rq, Rs> {
		return new RequestHandler(this, "all", path, doc);
	}

	/**
	 * Aplica um middleware a um caminho específico, correspondendo a todos os métodos HTTP.
	 *
	 * @example
	 * // Aplica um middleware de log para todas as rotas sob /api
	 * router.use('/api', { tags: ['Logging'] })
	 *   .handler((req, res, next) => {
	 *     console.log('API call:', req.method, req.path);
	 *     next();
	 *   });
	 *
	 * @param {string} path - O caminho da rota.
	 * @param {MiddlewareFCDoc} doc - (Opcional) Documentação OpenAPI para o manipulador de rota.
	 * @returns {RequestHandler<Rq, Rs>} Uma instância de `RequestHandler` para encadear middlewares e o manipulador final.
	 */
	use(path: string = "", doc?: MiddlewareFCDoc): RequestHandler<Rq, Rs> {
		return new RequestHandler(this, "use", path, doc);
	}

	/**
	 * Retorna uma lista achatada de todas as rotas finais registradas,
	 * com middlewares e caminhos resolvidos. Útil para depuração.
	 * @returns {Array<object>} Uma lista de objetos de rota.
	 */
	get routes() {
		return getRoutes(this.layers);
	}

	/**
	 * Gera a especificação OpenAPI completa com base na documentação definida.
	 * @param {swaggerJSDoc.OAS3Definition} [options] - Opções de base para a definição OpenAPI.
	 * @param {swaggerJSDoc.Responses} [defaultResponses={}] - Respostas padrão a serem mescladas em todas as rotas.
	 * @returns {swaggerJSDoc.Options} O objeto de opções pronto para ser usado por `swagger-jsdoc`.
	 */
	getSwagger(options?: swaggerJSDoc.OAS3Definition, defaultResponses: swaggerJSDoc.Responses = {}): swaggerJSDoc.Options {
		const swaggerOptions = { path: "/doc", ...(options || {}), defaultResponses };

		let doc: Pick<swaggerJSDoc.OAS3Definition, "paths" | "components"> = { paths: swaggerOptions?.paths || {}, components: swaggerOptions?.components || {} };

		this.layers.routes.forEach(({ method, path, doc: routeDoc }) => {
			if (routeDoc) {
				const { components, ...operation } = routeDoc;

				operation.responses = joinObject<swaggerJSDoc.Responses>(swaggerOptions.defaultResponses || {}, operation.responses || {});

				doc = joinObject(doc, {
					paths: { [path]: { [method]: operation } },
					components: components || {},
				});
			}
		});

		const definition = {
			...omit(swaggerOptions, "path", "defaultResponses"),
			...doc,
		};

		const targets: Record<string, string> = {
			shell_curl: "Shell",
			shell_httpie: "Shell",
			node_request: "JavaScript",
			python_python3: "Python",
			// php_curl: "PHP",
			// php_http1: "PHP",
			// php_http2: "PHP",
		};

		for (const path in definition.paths) {
			for (const method in definition.paths[path]) {
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
					Object.keys(targets),
				);
				definition.paths[path][method]["x-codeSamples"] = [];

				for (const snippetIdx in generatedCode.snippets) {
					const snippet = generatedCode.snippets[snippetIdx];
					definition.paths[path][method]["x-codeSamples"][snippetIdx] = { lang: targets[snippet.id], label: snippet.title, source: snippet.content };
				}
			}
		}

		return {
			definition,
			apis: [],
		} as any;
	}

	/**
	 * Define as opções globais de documentação OpenAPI para este roteador.
	 *
	 * @example
	 * app.defineSwagger({
	 *   openapi: '3.0.0',
	 *   info: { title: 'Minha API', version: '1.0.0' },
	 *   path: '/api-docs', // Caminho base para as UIs de documentação
	 *   defaultResponses: {
	 *     500: { description: 'Erro Interno do Servidor' }
	 *   }
	 * });
	 *
	 * @param {SwaggerOptions} options - As opções de configuração.
	 */
	defineSwagger(options: SwaggerOptions) {
		const swaggerOptions = { ...options, path: options.path || "/doc", defaultResponses: options.defaultResponses || {} };

		const path = swaggerOptions.path || "/doc";

		const swaggerSpec = (...args: string[]) => {
			const options = this.getSwagger(swaggerOptions, swaggerOptions.defaultResponses);
			let markdown: string = "",
				definition: swaggerJSDoc.SwaggerDefinition = {} as any;

			try {
				if (args.includes("definition")) definition = swaggerJSDoc(options) as any;
				if (args.includes("markdown")) markdown = swaggerMarkdown.convert(options);
			} catch {}

			return {
				options,
				definition,
				markdown,
			};
		};

		this.express_router.use(joinPath(path, "/.md"), (res, req) => {
			req.setHeader("Content-Type", "text/markdown");
			req.send(swaggerSpec("markdown").markdown);
		});

		this.express_router.use(joinPath(path, "/markdown"), (...args: any) => {
			swaggerMarkdown.setup(swaggerSpec().options).apply(this.app, args);
		});

		this.express_router.get(joinPath(path, "/swagger/definition.json"), (req, res) => {
			res.json(swaggerSpec("definition").definition);
		});

		this.express_router.use(joinPath(path, "/swagger"), swaggerUi.serve, (...args: any) => {
			swaggerUi.setup(swaggerSpec("definition").definition).apply(this.app, args);
		});

		this.express_router.use(joinPath(path, "/redoc"), (...args: any) => {
			redocUi.setup(swaggerSpec().options).apply(this.app, args);
		});
	}

	/**
	 * Cria um sub-roteador aninhado sob um prefixo de caminho.
	 *
	 * @example
	 * const adminRouter = router.route('/admin');
	 * adminRouter.get('/dashboard', ...); // Rota final: /admin/dashboard
	 *
	 * @param {string} path - O prefixo do caminho para o sub-roteador.
	 * @returns {Router<Rq, Rs>} Uma nova instância de `Router` para o sub-roteador.
	 */
	route(path: string = ""): Router<Rq, Rs> {
		return new Router("", this.layers.route(path));
	}

	/**
	 * Anexa um roteador existente (sub-roteador) a este roteador.
	 *
	 * @example
	 * const usersRouter = route('/users');
	 * // ... define rotas em usersRouter ...
	 *
	 * const app = create();
	 * app.by(usersRouter); // Anexa o roteador de usuários ao principal
	 *
	 * @param {Router} router - A instância do roteador a ser anexada.
	 * @returns {this} A instância atual do roteador para encadeamento.
	 */
	by(router: Router) {
		if (router instanceof Router) {
			this.layers.by(router.layers);
			this.express_router.use(router.routePath, router.express_router);
		}
		return this;
	}

	/** Delega para o método `app.engine()` do Express. */
	engine(ext: string, fn: (path: string, options: object, callback: (e: any, rendered?: string) => void) => void) {
		this.app.engine(ext, fn);
		return this;
	}

	enabled(setting: string): boolean {
		return this.app.enabled(setting);
	}

	/** Delega para o método `app.disabled()` do Express. */
	disabled(setting: string): boolean {
		return this.app.disabled(setting);
	}

	/** Delega para o método `app.enable()` do Express. */
	enable(setting: string) {
		this.app.enable(setting);
		return this;
	}

	/** Delega para o método `app.disable()` do Express. */
	disable(setting: string) {
		this.app.disable(setting);
		return this;
	}

	/**
	 * Inicia o servidor HTTP.
	 * Este método deve ser chamado por último, após todas as rotas e middlewares terem sido definidos.
	 * Ele compila todas as camadas de rotas, configura os endpoints de documentação (se definidos)
	 * e inicia o servidor Express para ouvir as requisições.
	 *
	 * @example
	 * app.listen(3000, () => {
	 *   console.log('Servidor rodando em http://localhost:3000');
	 *   console.log('Documentação Swagger em http://localhost:3000/api-docs/swagger');
	 *   console.log('Documentação ReDoc em http://localhost:3000/api-docs/redoc');
	 * });
	 *
	 * @param {number} port - A porta em que o servidor irá ouvir.
	 * @param {string} [hostname] - O nome do host.
	 * @param {number} [backlog] - O número máximo de conexões pendentes.
	 * @param {Function} [callback] - Uma função a ser chamada quando o servidor estiver ouvindo.
	 * @returns {http.Server} A instância do servidor HTTP subjacente.
	 */
	listen(port: number, hostname: string, backlog: number, callback?: (error?: Error) => void): http.Server;
	listen(port: number, hostname: string, callback?: (error?: Error) => void): http.Server;
	listen(port: number, callback?: (error?: Error) => void): http.Server;
	listen(callback?: (error?: Error) => void): http.Server;
	listen(path: string, callback?: (error?: Error) => void): http.Server;
	listen(handle: any, listeningListener?: (error?: Error) => void): http.Server;
	listen(...args: any[]) {
		const router: ExpressRouter = express.Router();

		this.app.use((req, res, next) => {
			router.stack = [];
			router.use(this.layers.express_router);
			next();
		}, router);

		this.app.use(Middlewares.cors() as any);

		this.app.use(this.routePath, this.express_router);

		this.app.get("/.well-known/appspecific/com.chrome.devtools.json", (req, res) => {
			const projectRoot = path.resolve(__dirname);
			const workspaceUuid = uuidv4("-"); // Gera um UUID v4
			res.json({
				workspace: {
					root: projectRoot,
					uuid: workspaceUuid,
				},
			});
		});

		this.app.use(
			createDynamicMiddleware((req, res, next) => {
				throw new HandleError(`Not Found by ${req.method} ${req.url}`, "NOT_FOUND", 404);
			}) as any,
		);

		return this.app.listen(...args);
	}
}
