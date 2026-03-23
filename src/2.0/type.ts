import type * as core from "express-serve-static-core";
import type { NextFunction } from "express";
import type swaggerJSDoc from "swagger-jsdoc";
import type { Readable } from "stream";

// Utilitário para checar se o tipo é "sujo" (any, never ou unknown)
type IsBad<T> = 0 extends 1 & T
	? true // Detecta Any
	: [T] extends [never]
		? true // Detecta Never
		: unknown extends T
			? true // Detecta Unknown
			: "" extends T
				? true // Detecta String Vazia
				: string extends T
					? true // Detecta String Vazia
					: false;

type Join<A, B> = IsBad<A> extends true ? B : IsBad<B> extends true ? A : A & B;

type Prettify<T> = {
	[K in keyof T]: T[K];
} & {};

export type ExtractRouteParameters<Path extends string> = Extract<keyof core.RouteParameters<Path>, string>;

export type ParamsDictionary<P extends string = string> = {
	[key in P]: string;
};

export interface Request<P extends string = string, ReqBody = {}, ReqQuery = core.Query, ResBody = any> extends core.Request<ParamsDictionary<P>, ResBody, ReqBody, ReqQuery, Record<string, any>> {
	__executedMiddlewares__?: Set<any>;
	clientIp?: string;

	/**
	 * Controla a execução do middleware para a requisição atual.
	 * Útil para garantir que um middleware seja executado apenas uma vez, mesmo que seja
	 * aplicado em múltiplos níveis de rotas.
	 *
	 * @param {boolean} [isOnce=true] - Se `true`, o middleware não será executado novamente para a mesma requisição. Se `false`, permite que o middleware seja executado novamente.
	 *
	 * @example
	 * // Middleware que executa uma lógica apenas uma vez por requisição.
	 * const myMiddleware: MiddlewareFC = (req, res, next) => {
	 *   // Garante que este bloco de código execute apenas uma vez.
	 *   req.executeOnce?.();
	 *
	 *   console.log("Este middleware só roda uma vez!");
	 *   next();
	 * };
	 */
	executeOnce?: (isOnce?: boolean) => void;
}

export type JoinRequest<A extends Request, B extends Request> = A extends Request<infer AP, infer AReqBody, infer AReqQuery, infer AResBody> & infer AReq
	? B extends Request<infer BP, infer BReqBody, infer BReqQuery, infer BResBody> & infer BReq
		? Request<Join<AP, BP>, Join<AReqBody, BReqBody>, Join<AReqQuery, BReqQuery>, Join<AResBody, BResBody>> & (AReq & BReq)
		: never
	: never;

export interface Response<ResBody = any> extends core.Response<ResBody, Record<string, any>> {}

export type JoinResponse<A extends Response, B extends Response> = A extends Response<infer AResBody> ? (B extends Response<infer BResBody> ? Response<AResBody & BResBody> : never) : never;

export interface RequestHandler<Req extends Request = Request, Res extends Response = Response> {
	(req: Req, res: Res, next: NextFunction): unknown;
}

export type { NextFunction };

export interface IHandler<Rq extends Request = Request, Rs extends Response = Response> extends RequestHandler<Rq, Rs> {
	/**
	 * Adiciona um middleware ou handler à cadeia de execução, mesclando os tipos
	 * genéricos de request e response com os já acumulados.
	 *
	 * @typeParam Req - Tipo de request do handler sendo adicionado.
	 * @typeParam Res - Tipo de response do handler sendo adicionado.
	 * @param fn - Função handler ou instância de {@link IHandler} a ser encadeada.
	 * @returns Nova instância de {@link IHandler} com os tipos mesclados.
	 *
	 * @example
	 * app.get("/profile/:id")
	 *   .handler((req, res, next) => {
	 *     // middleware intermediário
	 *     console.log(`Acessando perfil ${req.params.id}`);
	 *     next();
	 *   })
	 *   .handler((req, res) => {
	 *     res.json({ id: req.params.id });
	 *   });
	 */
	handler<Req extends Request = Request, Res extends Response = Response>(
		fn: RequestHandler<Req & Rq, Res & Rs> | IHandler<Req & Rq, Res & Rs>,
	): IHandler<JoinRequest<Rq, Req>, JoinResponse<Rs, Res>>;

	/**
	 * Anexa documentação OpenAPI/Swagger ao handler atual sem alterar o fluxo de execução.
	 * A documentação é mesclada na árvore interna e utilizada na geração do spec OpenAPI.
	 *
	 * @param operation - Objeto de operação OpenAPI (tags, summary, parameters, requestBody, etc.).
	 * @param components - Componentes OpenAPI adicionais (schemas, securitySchemes, etc.).
	 * @returns A mesma instância de {@link IHandler}, permitindo encadeamento contínuo.
	 *
	 * @example
	 * app.get("/users/:userId")
	 *   .handler(authMiddleware)
	 *   .doc({
	 *     tags: ["Users"],
	 *     summary: "Buscar usuário por ID",
	 *     parameters: [
	 *       { name: "userId", in: "path", required: true, schema: { type: "string" } },
	 *     ],
	 *   })
	 *   .handler((req, res) => {
	 *     res.json({ userId: req.params.userId });
	 *   });
	 *
	 * @example
	 * // Documentação com componentes de segurança
	 * app.delete("/users/:id")
	 *   .handler(authMiddleware)
	 *   .doc(
	 *     {
	 *       tags: ["Users"],
	 *       summary: "Remover usuário",
	 *       security: [{ bearerAuth: [] }],
	 *     },
	 *     {
	 *       securitySchemes: {
	 *         bearerAuth: { type: "http", scheme: "bearer" },
	 *       },
	 *     },
	 *   )
	 *   .handler((req, res) => {
	 *     res.sendStatus(204);
	 *   });
	 */
	doc(operation: MiddlewareFCDoc | swaggerJSDoc.Operation, components?: swaggerJSDoc.Components): IHandler<Rq, Rs>;
}

export interface IMiddleware<Rq extends Request = Request, Rs extends Response = Response> extends RequestHandler<Rq, Rs> {
	/**
	 * Anexa documentação OpenAPI/Swagger ao middleware sem alterar o fluxo de execução.
	 * A documentação é mesclada na árvore interna quando o middleware é encadeado via
	 * `.handler()` em um {@link IHandler}.
	 *
	 * @param operation - Objeto de operação OpenAPI (security, parameters, requestBody, etc.).
	 * @param components - Componentes OpenAPI adicionais (schemas, securitySchemes, etc.).
	 * @returns A mesma instância de {@link IMiddleware}, permitindo encadeamento de `.doc()`.
	 *
	 * @example
	 * const authMiddleware = middleware((req: AuthRequest, res, next) => {
	 *   next();
	 * }).doc({
	 *   security: [{ bearerAuth: [] }],
	 *   components: {
	 *     securitySchemes: {
	 *       bearerAuth: { type: "http", scheme: "bearer" },
	 *     },
	 *   },
	 * });
	 *
	 * @example
	 * // Documentação com parâmetros de header
	 * const apiKeyMiddleware = middleware((req, res, next) => {
	 *   if (!req.headers["x-api-key"]) {
	 *     res.status(401).json({ error: "API key required" });
	 *     return;
	 *   }
	 *   next();
	 * }).doc({
	 *   parameters: [
	 *     { name: "x-api-key", in: "header", required: true, schema: { type: "string" } },
	 *   ],
	 * });
	 */
	doc(operation: MiddlewareFCDoc | swaggerJSDoc.Operation, components?: swaggerJSDoc.Components): IMiddleware<Rq, Rs>;
}

export type Methods = "all" | "get" | "post" | "put" | "delete" | "patch" | "options" | "head";

export type PathParams = string | RegExp | Array<string | RegExp>;

/**
 * Interface que define a assinatura de um método HTTP no router (ex.: `.get()`, `.post()`, `.delete()`).
 * Ao ser chamado com um caminho de rota, retorna um {@link IHandler} tipado com os parâmetros
 * extraídos automaticamente da string de rota.
 *
 * @typeParam Method - O método HTTP associado (ex.: `"get"`, `"post"`, `"all"`).
 *
 * @example
 * // Parâmetros de rota são inferidos automaticamente
 * app.get("/users/:userId/posts/:postId")
 *   .handler((req, res) => {
 *     // req.params.userId e req.params.postId são inferidos como string
 *     res.json({ userId: req.params.userId, postId: req.params.postId });
 *   });
 *
 * @example
 * // Com documentação OpenAPI inline
 * app.post("/items", { tags: ["Items"], summary: "Criar item" })
 *   .handler((req, res) => {
 *     res.status(201).json({ id: 1 });
 *   });
 */
export interface IRouterMatcher<Method extends Methods = any> {
	/**
	 * Registra um handler para o método HTTP associado neste caminho de rota, retornando um {@link IHandler} com os tipos de parâmetros extraídos.
	 *
	 * @param path - Caminho de rota, que pode conter parâmetros nomeados (ex.: `"/users/:id"`).
	 * @param doc - Documentação OpenAPI/Swagger para a rota.
	 * @returns Instância de {@link IHandler} com os tipos de request e response adequados.
	 *
	 * @example
	 * app.get("/users/:userId")
	 *  .handler((req, res) => {
	 *    // req.params.userId é inferido como string
	 *    res.json({ userId: req.params.userId });
	 *  });
	 *
	 * @example
	 * // Com documentação OpenAPI inline
	 * app.post("/items", { tags: ["Items"], summary: "Criar item" })
	 *   .handler((req, res) => {
	 *     res.status(201).json({ id: 1 });
	 *   });
	 */
	<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path, doc?: MiddlewareFCDoc): IHandler<Request<P>>;

	/**
	 * Registra um handler para o método HTTP associado neste caminho de rota, retornando um {@link IHandler} com os tipos de parâmetros extraídos.
	 *
	 * @param path - Caminho de rota, que pode conter parâmetros nomeados (ex.: `"/users/:id"`).
	 * @param doc - Documentação OpenAPI/Swagger para a rota.
	 * @returns Instância de {@link IHandler} com os tipos de request e response adequados.
	 *
	 * @example
	 * app.get("/users/:userId", { tags: ["Users"], summary: "Buscar usuário por ID" })
	 *  .handler((req, res) => {
	 *    res.json({ userId: req.params.userId });
	 *  });
	 *
	 * @example
	 * // Documentação com componentes de segurança
	 * app.delete("/users/:id", { security: [{ bearerAuth: [] }] }, {
	 *   securitySchemes: {
	 *     bearerAuth: { type: "http", scheme: "bearer" },
	 *   },
	 * })
	 * .handler((req, res) => {
	 *   res.sendStatus(204);
	 * });
	 */
	(path: PathParams, doc?: MiddlewareFCDoc): IHandler;
}

/**
 * Interface principal do router, que estende {@link RequestHandler} e expõe métodos HTTP,
 * sub-rotas, middlewares e configuração de documentação OpenAPI/Swagger.
 *
 * Pode ser criado via `router()` e aninhado em outros routers ou em uma aplicação via `.route()` ou `.use()`.
 *
 * @example
 * // Criar um router e definir rotas
 * import { router } from "./2.0";
 *
 * const api = router();
 *
 * api.get("/users")
 *   .handler((req, res) => {
 *     res.json([{ name: "Alice" }]);
 *   })
 *   .doc({ tags: ["Users"], summary: "Listar usuários" });
 *
 * api.post("/users")
 *   .handler((req, res) => {
 *     res.status(201).json({ id: 1 });
 *   })
 *   .doc({ tags: ["Users"], summary: "Criar usuário" });
 *
 * @example
 * // Aninhar routers com prefixo
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
 * // Configurar documentação Swagger
 * app.defineSwagger({
 *   openapi: "3.0.0",
 *   info: { title: "My API", version: "1.0.0" },
 *   defaultResponses: {
 *     400: { description: "Dados inválidos" },
 *     401: { description: "Falha na autenticação" },
 *     500: { description: "Erro interno do servidor" },
 *   },
 * });
 */
export interface IRouter extends RequestHandler {
	/** Mapeia um callback para parâmetros de rota nomeados, equivalente a `app.param()` do Express. */
	"param": core.Application["param"];

	// Abaixo os métodos do objeto

	/** Registra um handler para todos os métodos HTTP no caminho especificado. */
	"all": IRouterMatcher<"all">;
	/** Registra um handler para requisições GET. */
	"get": IRouterMatcher<"get">;
	/** Registra um handler para requisições POST. */
	"post": IRouterMatcher<"post">;
	/** Registra um handler para requisições PUT. */
	"put": IRouterMatcher<"put">;
	/** Registra um handler para requisições DELETE. */
	"delete": IRouterMatcher<"delete">;
	/** Registra um handler para requisições PATCH. */
	"patch": IRouterMatcher<"patch">;
	/** Registra um handler para requisições OPTIONS. */
	"options": IRouterMatcher<"options">;
	/** Registra um handler para requisições HEAD. */
	"head": IRouterMatcher<"head">;

	"checkout": IRouterMatcher;
	"copy": IRouterMatcher;
	"lock": IRouterMatcher;
	"merge": IRouterMatcher;
	"mkactivity": IRouterMatcher;
	"mkcol": IRouterMatcher;
	"move": IRouterMatcher;
	"m-search": IRouterMatcher;
	"notify": IRouterMatcher;
	"purge": IRouterMatcher;
	"report": IRouterMatcher;
	"search": IRouterMatcher;
	"subscribe": IRouterMatcher;
	"trace": IRouterMatcher;
	"unlock": IRouterMatcher;
	"unsubscribe": IRouterMatcher;

	/** Router pai ao qual este router está aninhado, ou `null` se for o router raiz. */
	"parent": IRouter | null;

	/** Caminho de prefixo deste router dentro do router pai. */
	"path": string;

	/**
	 * Cria ou anexa um sub-router em um prefixo de rota, permitindo modularizar a aplicação.
	 *
	 * @param prefix - Prefixo de caminho para o sub-router.
	 * @param router - Instância de {@link IRouter} a ser aninhada (opcional).
	 * @param doc - Documentação OpenAPI aplicada a todas as rotas do sub-router.
	 * @returns O sub-router criado ou anexado.
	 *
	 * @example
	 * // Criar sub-router inline
	 * const usersRoute = app.route("/users");
	 * usersRoute.get("/").handler((req, res) => res.json([]));
	 *
	 * @example
	 * // Anexar router existente com documentação
	 * const v1 = router();
	 * v1.get("/items").handler((req, res) => res.json([]));
	 *
	 * app.route("/v1", v1, {
	 *   security: [{ bearerAuth: [] }],
	 * });
	 */
	route<T extends string>(prefix: T, doc?: MiddlewareFCDoc): IRouter;
	route<T extends string>(prefix: T, router: IRouter, doc?: MiddlewareFCDoc): IRouter;
	route(router: IRouter, doc?: MiddlewareFCDoc): IRouter;
	// route(path: PathParams, doc?: MiddlewareFCDoc): IRouter;

	/**
	 * Registra um middleware, handler ou sub-router no caminho especificado.
	 * Quando chamado apenas com prefixo e sem handler, retorna um {@link IHandler} encadeável.
	 *
	 * @param prefix - Prefixo de caminho (opcional).
	 * @param handler - Instância de {@link IRouter}, {@link RequestHandler} ou middleware.
	 * @param doc - Documentação OpenAPI para o middleware.
	 *
	 * @example
	 * // Middleware global sem prefixo
	 * app.use((req, res, next) => {
	 *   console.log(`${req.method} ${req.url}`);
	 *   next();
	 * });
	 *
	 * @example
	 * // Sub-router com prefixo
	 * const apiRouter = router();
	 * app.use("/api", apiRouter);
	 *
	 * @example
	 * // Handler encadeável com prefixo
	 * app.use("/health")
	 *   .handler((req, res) => {
	 *     res.json({ status: "ok" });
	 *   });
	 */
	use<T extends string, P extends string = ExtractRouteParameters<T>>(prefix: T, doc?: MiddlewareFCDoc): IHandler<Request<P>>;
	// use(path: PathParams, doc?: MiddlewareFCDoc): IHandler;
	use<T extends string, P extends string = ExtractRouteParameters<T>>(prefix: T, handler: IRouter | RequestHandler, doc?: MiddlewareFCDoc): void;
	// use(path: PathParams, handler: IRouter | RequestHandler, doc?: MiddlewareFCDoc): void;
	use(handler: IRouter | RequestHandler, doc?: MiddlewareFCDoc): void;

	/**
	 * Define as opções de documentação Swagger/OpenAPI para este router.
	 * Habilita a geração automática de spec OpenAPI e endpoints de documentação
	 * (Swagger UI, Markdown, etc.).
	 *
	 * @param options - Configuração OpenAPI 3.0 com opções adicionais como
	 *                  `defaultResponses`, `path` e `targets` para snippets.
	 *
	 * @example
	 * app.defineSwagger({
	 *   openapi: "3.0.0",
	 *   info: { title: "My API", version: "1.0.0" },
	 *   path: "/doc",
	 *   defaultResponses: {
	 *     400: { description: "Dados inválidos" },
	 *     401: { description: "Falha na autenticação" },
	 *     500: { description: "Erro interno do servidor" },
	 *   },
	 *   targets: ["shell_curl", "javascript_xhr", "node_native"],
	 * });
	 */
	defineSwagger(options: SwaggerOptions): void;

	/**
	 * Retorna a especificação Swagger/OpenAPI gerada a partir de todas as rotas,
	 * handlers e documentações registradas neste router.
	 *
	 * @returns Objeto de opções compatível com `swagger-jsdoc`.
	 *
	 * @example
	 * const spec = app.getSwagger();
	 * console.log(JSON.stringify(spec, null, 2));
	 */
	getSwagger(): swaggerJSDoc.Options;
}

/**
 * Define a estrutura da documentação Swagger/OpenAPI que pode ser anexada a um middleware.
 * Permite que middlewares contribuam com definições de segurança, parâmetros, etc., que são
 * mescladas com a documentação da rota final.
 *
 * @see MiddlewareFC
 * @example
 * const authMiddleware: MiddlewareFC = (req, res, next) => { next(); };
 * authMiddleware.doc = {
 *   security: [{ BearerAuth: [] }],
 *   components: {
 *     securitySchemes: { BearerAuth: { type: "http", scheme: "bearer" } }
 *   }
 * };
 */
export type MiddlewareFCDoc = swaggerJSDoc.Operation & {
	components?: swaggerJSDoc.Components;
};

export type SnippetTargets =
	| "c_libcurl"
	| "csharp_restsharp"
	| "csharp_httpclient"
	| "go_native"
	| "java_okhttp"
	| "java_unirest"
	| "javascript_jquery"
	| "javascript_xhr"
	| "node_native"
	| "node_request"
	| "node_unirest"
	| "objc_nsurlsession"
	| "ocaml_cohttp"
	| "php_curl"
	| "php_http1"
	| "php_http2"
	| "python_python3"
	| "python_requests"
	| "ruby_native"
	| "shell_curl"
	| "shell_httpie"
	| "shell_wget"
	| "swift_nsurlsession";

export interface SwaggerOptions extends swaggerJSDoc.OAS3Definition {
	path?: string;
	defaultResponses?: swaggerJSDoc.Responses;
	targets?: SnippetTargets[];
}

export interface IStackFrame {
	functionName: string;
	filePath: string;
	dir: string;
	lineNumber: number;
	columnNumber: number;
}

export interface IChildrenDoc {
	stackFrame: IStackFrame;
	operation: swaggerJSDoc.Operation;
	components: swaggerJSDoc.Components;
}

export interface IParentDoc extends IChildrenDoc {}

export interface ITreeDoc {
	method?: Methods;
	path?: string;
	parent: IParentDoc | SwaggerOptions | null;
	children: (IChildrenDoc | ITreeDoc)[];
}

export interface IStackLog {
	time: Date;
	level: "ERROR" | "WARN" | "INFO" | "DEBUG";
	name: string;
	message: string;
	source?: string;
	statusCode: number;
	duration: number;
	meta?: string;
}

export interface IStacksOptions {
	/** Caminho de rota de empilhamento dos logs */
	path?: string;
	/** Limite máximo de logs a serem empilhadas */
	limit?: number;
	/** Caminho base para o arquivo dos logs empilhados */
	filePath?: string;

	beforeStack?(...stacks: IStackLog[]): Array<IStackLog | string | Error>;
}

/**
 * Interface principal da aplicação, estende {@link IRouter} com capacidades de servidor HTTP,
 * configuração do Express e sistema de logging por pilha de stacks.
 *
 * Criada pela função `create()` exportada em `create.ts`, que encapsula uma instância Express
 * com roteamento tipado, documentação OpenAPI e rastreamento de requisições.
 *
 * @example
 * // Criar aplicação e iniciar servidor
 * import { create } from "./2.0";
 *
 * const app = create();
 *
 * app.get("/hello/:name")
 *   .handler((req, res) => {
 *     res.send(`Hello, ${req.params.name}!`);
 *   });
 *
 * app.listen(3000, () => {
 *   console.log("Server is running on http://localhost:3000");
 * });
 *
 * @example
 * // Aplicação completa com sub-routers, Swagger e stacks
 * const app = create();
 *
 * const v1 = router();
 * v1.get("/users")
 *   .handler((req, res) => res.json([]))
 *   .doc({ tags: ["Users"], summary: "Listar usuários" });
 *
 * app.route("/v1", v1);
 *
 * app.defineSwagger({
 *   openapi: "3.0.0",
 *   info: { title: "My API", version: "1.0.0" },
 * });
 *
 * app.defineStacks({
 *   path: "/stacks",
 *   limit: 200,
 *   filePath: "./logs/stacks.log",
 * });
 *
 * app.listen(8080);
 */
export interface IApplication extends IRouter {
	/**
	 * Inicia o servidor HTTP escutando na porta especificada, equivalente a `app.listen()` do Express.
	 *
	 * @example
	 * app.listen(3000, () => {
	 *   console.log("Server is running on http://localhost:3000");
	 * });
	 *
	 * @example
	 * // Com host específico
	 * app.listen(8080, "0.0.0.0", () => {
	 *   console.log("Server is running on http://0.0.0.0:8080");
	 * });
	 */
	listen: core.Application["listen"];

	/**
	 * Desabilita a configuração `setting`. Equivalente a `app.set(setting, false)`.
	 *
	 * @example
	 * app.disable("x-powered-by");
	 */
	disable: core.Application["disable"];

	/**
	 * Habilita a configuração `setting`. Equivalente a `app.set(setting, true)`.
	 *
	 * @example
	 * app.enable("trust proxy");
	 */
	enable: core.Application["enable"];

	/**
	 * Retorna `true` se a configuração `setting` está desabilitada.
	 *
	 * @example
	 * if (app.disabled("x-powered-by")) {
	 *   console.log("x-powered-by está desabilitado");
	 * }
	 */
	disabled: core.Application["disabled"];

	/**
	 * Retorna `true` se a configuração `setting` está habilitada.
	 *
	 * @example
	 * if (app.enabled("trust proxy")) {
	 *   console.log("trust proxy está habilitado");
	 * }
	 */
	enabled: core.Application["enabled"];

	/**
	 * Registra uma engine de template para a extensão de arquivo especificada.
	 *
	 * @example
	 * app.engine("html", require("ejs").renderFile);
	 */
	engine: core.Application["engine"];

	/**
	 * Mapeia um callback para parâmetros de rota nomeados.
	 *
	 * @example
	 * app.param("userId", (req, res, next, id) => {
	 *   console.log(`Parâmetro userId: ${id}`);
	 *   next();
	 * });
	 */
	param: core.Application["param"];

	/**
	 * Renderiza uma view e envia a string HTML resultante ao cliente.
	 *
	 * @example
	 * app.render("index", { title: "Home" }, (err, html) => {
	 *   if (err) console.error(err);
	 *   console.log(html);
	 * });
	 */
	render: core.Application["render"];

	/**
	 * Retorna todos os logs de stack registrados, lidos a partir do arquivo de log configurado.
	 *
	 * @returns Array de {@link IStackLog} com os registros de requisições.
	 *
	 * @example
	 * const stacks = app.getStacks();
	 * console.log(`Total de logs: ${stacks.length}`);
	 * stacks.forEach((log) => {
	 *   console.log(`[${log.level}] ${log.name} - ${log.message} (${log.duration}ms)`);
	 * });
	 */
	getStacks(): IStackLog[];

	/**
	 * Configura o sistema de logging por pilha de stacks, que registra informações
	 * sobre cada requisição (tempo, status, duração, etc.) em um arquivo de log.
	 *
	 * @param options - Opções de configuração do sistema de stacks.
	 * @returns Objeto com o caminho da rota de visualização dos stacks.
	 *
	 * @example
	 * const { stacksPath } = app.defineStacks({
	 *   path: "/stacks",
	 *   limit: 100,
	 *   filePath: "./logs/stacks.log",
	 *   beforeStack(...stacks) {
	 *     // Filtrar logs antes de salvar
	 *     return stacks.filter((s) => typeof s !== "string" && s.level === "ERROR");
	 *   },
	 * });
	 *
	 * console.log(`Stacks disponíveis em: ${stacksPath}`);
	 */
	defineStacks(options?: IStacksOptions): {
		stacksPath: string;
	};
}

export interface FileInfo {
	/** Name of the form field associated with this file. */
	fieldname: string;
	/** Name of the file on the uploader's computer. */
	originalname: string;
	/**
	 * Value of the `Content-Transfer-Encoding` header for this file.
	 * @deprecated since July 2015
	 * @see RFC 7578, Section 4.7
	 */
	encoding: string;
	/** Value of the `Content-Type` header for this file. */
	mimetype: string;
	/** Size of the file in bytes. */
	size: number;
	/**
	 * A readable stream of this file. Only available to the `_handleFile`
	 * callback for custom `StorageEngine`s.
	 */
	stream: Readable;
	/** `DiskStorage` only: Directory to which this file has been uploaded. */
	destination: string;
	/** `DiskStorage` only: Name of this file within `destination`. */
	filename: string;
	/** `DiskStorage` only: Full path to the uploaded file. */
	path: string;
	/** `MemoryStorage` only: A Buffer containing the entire file. */
	buffer: Buffer;
}

export interface FilesRequest extends Request {
	file: FileInfo;
	files: FileInfo[];
}
