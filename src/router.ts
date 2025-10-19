import type swaggerJSDoc from "swagger-jsdoc";
import type { MiddlewareCallback, Request, Response, SwaggerOptions } from "./type";
import { RequestHandler } from "./handler";
import { createDynamicMiddleware, getRoutes, joinObject, joinPath, omit } from "./utils";
import { Layer } from "./Layer";
import * as http from "http";
import express, { Express } from "express";
import swaggerUi from "swagger-ui-express";
import * as redocUi from "./redocUi";
import { RequestMiddleware } from "./middleware";

/**
 * A classe `Router` é um wrapper em torno do roteador do Express, oferecendo uma API fluente
 * e encadeável para a definição de rotas. Ela aprimora a experiência de desenvolvimento com
 * segurança de tipos e geração de documentação OpenAPI/Swagger integrada.
 *
 * @template Rq - O tipo base para o objeto de requisição (request) em todas as rotas deste roteador.
 * @template Rs - O tipo base para o objeto de resposta (response) em todas as rotas.
 *
 * @example
 * import express, { Request, Response } from "express";
 * import { Router } from "./router"; // Ajuste o caminho do import conforme sua estrutura.
 * import swaggerUi from "swagger-ui-express";
 *
 * // 1. Crie uma nova instância do Router.
 * const userRouter = new Router();
 *
 * // 2. Defina uma rota com um manipulador e documentação.
 * userRouter
 *   .get("/:id")
 *   .handler((req: Request<{ id: string }>, res: Response) => {
 *     const { id } = req.params;
 *     res.json({ id: Number(id), name: "John Doe" });
 *   })
 *   .doc({
 *     summary: "Obter um usuário pelo ID",
 *     tags: ["Usuários"],
 *     parameters: [
 *       {
 *         name: "id",
 *         in: "path",
 *         required: true,
 *         description: "O ID do usuário",
 *         schema: { type: "integer" },
 *       },
 *     ],
 *     responses: {
 *       "200": {
 *         description: "Detalhes do usuário.",
 *         content: {
 *           "application/json": {
 *             schema: {
 *               type: "object",
 *               properties: {
 *                 id: { type: "integer" },
 *                 name: { type: "string" },
 *               },
 *             },
 *           },
 *         },
 *       },
 *       "404": {
 *         description: "Usuário não encontrado",
 *       }
 *     },
 *   });
 *
 * // 3. Crie um aplicativo Express e use o roteador.
 * const app = express();
 * app.use(express.json());
 *
 * // A propriedade `.router` contém a instância do roteador Express, pronta para ser usada.
 * app.use("/users", userRouter.router);
 *
 * // 4. (Opcional) Gere e sirva a documentação Swagger.
 * const swaggerOptions = userRouter.getSwagger({
 *   openapi: "3.0.0",
 *   info: {
 *     title: "API de Usuários",
 *     version: "1.0.0",
 *   },
 * });
 * app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerOptions));
 *
 * app.listen(3000, () => {
 *   console.log("Servidor rodando em http://localhost:3000");
 *   console.log("Documentação da API em http://localhost:3000/api-docs");
 * });
 */
export class Router<Rq extends Request = Request, Rs extends Response = Response> {
	app: Express = express();
	private swaggerOptions?: SwaggerOptions = undefined;

	constructor(readonly routePath: string = "", readonly layers: Layer = new Layer()) {
		this.layers.path = routePath;
	}

	doc(operation: swaggerJSDoc.Operation, components: swaggerJSDoc.Components = {}) {
		this.layers.doc = { ...operation, components };
	}

	/**
	 * Adiciona um middleware que será aplicado a todas as rotas definidas subsequentemente
	 * nesta cadeia de roteamento.
	 *
	 * Este método é imutável: ele retorna uma **nova instância** do `Router` com o middleware
	 * adicionado, permitindo o encadeamento seguro e a composição de diferentes conjuntos de middlewares.
	 * A tipagem dos objetos `Request` e `Response` é aprimorada para refletir as modificações
	 * feitas pelo middleware.
	 *
	 * @template Req - O tipo de `Request` que o middleware adiciona ou modifica.
	 * @template Res - O tipo de `Response` que o middleware adiciona ou modifica.
	 *
	 * @param {MiddlewareFC<Rq & Req, Rs & Res>} callback - A função de middleware a ser adicionada.
	 *   Esta função pode modificar os objetos `req` e `res`, e suas tipagens serão propagadas
	 *   para os manipuladores de rota subsequentes.
	 *
	 * @returns {Router<Rq & Req, Rs & Res>} Uma nova instância do `Router` com o middleware
	 *   e os tipos de requisição/resposta atualizados.
	 *
	 * @example
	 * import { Router } from "./router";
	 * import { Request, Response, NextFunction } from "express";
	 *
	 * // Middleware de autenticação que adiciona 'user' ao objeto de requisição.
	 * interface AuthenticatedRequest {
	 *   user: { id: number; name: string };
	 * }
	 *
	 * const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
	 *   // Em um cenário real, você validaria um token aqui.
	 *   (req as Request & AuthenticatedRequest).user = { id: 1, name: "Admin" };
	 *   next();
	 * };
	 *
	 * const baseRouter = new Router();
	 * const authenticatedRouter = baseRouter.middleware<AuthenticatedRequest>(authMiddleware);
	 *
	 * authenticatedRouter.get("/profile").handler((req, res) => {
	 *   // `req.user` está disponível e corretamente tipado.
	 *   res.json({ message: `Bem-vindo, ${req.user.name}!` });
	 * });
	 */
	middleware<Req extends Request = Request, Res extends Response = Response>(callback: MiddlewareCallback<Rq & Req, Rs & Res>): Router<Rq & Req, Rs & Res> {
		if (callback instanceof RequestMiddleware) {
			callback.router.layers
				.filter(({ type, handle }) => type === "middleware" && !!handle)
				.map(({ handle }) => handle!)
				.forEach((handle) => this.layers.middleware(handle));
		} else {
			this.layers.middleware([callback].map(createDynamicMiddleware));
		}
		return this;
	}

	/**
	 * Cria um manipulador de rota para requisições GET.
	 * @param {string} path O caminho da rota.
	 * @returns {RequestHandler<Rq, Rs>} Uma instância de `RequestHandler` para encadear middlewares e o manipulador final.
	 */
	get(path: string): RequestHandler<Rq, Rs> {
		return new RequestHandler(this, "get", path);
	}

	/**
	 * Cria um manipulador de rota para requisições POST.
	 * @param {string} path O caminho da rota.
	 * @returns {RequestHandler<Rq, Rs>} Uma instância de `RequestHandler` para encadear middlewares e o manipulador final.
	 */
	post(path: string): RequestHandler<Rq, Rs> {
		return new RequestHandler(this, "post", path);
	}

	/**
	 * Cria um manipulador de rota para requisições PUT.
	 * @param {string} path O caminho da rota.
	 * @returns {RequestHandler<Rq, Rs>} Uma instância de `RequestHandler` para encadear middlewares e o manipulador final.
	 */
	put(path: string): RequestHandler<Rq, Rs> {
		return new RequestHandler(this, "put", path);
	}

	/**
	 * Cria um manipulador de rota para requisições DELETE.
	 * @param {string} path O caminho da rota.
	 * @returns {RequestHandler<Rq, Rs>} Uma instância de `RequestHandler` para encadear middlewares e o manipulador final.
	 */
	delete(path: string): RequestHandler<Rq, Rs> {
		return new RequestHandler(this, "delete", path);
	}

	/**
	 * Cria um manipulador de rota para requisições PATCH.
	 * @param {string} path O caminho da rota.
	 * @returns {RequestHandler<Rq, Rs>} Uma instância de `RequestHandler` para encadear middlewares e o manipulador final.
	 */
	patch(path: string): RequestHandler<Rq, Rs> {
		return new RequestHandler(this, "patch", path);
	}

	/**
	 * Cria um manipulador de rota para requisições OPTIONS.
	 * @param {string} path O caminho da rota.
	 * @returns {RequestHandler<Rq, Rs>} Uma instância de `RequestHandler` para encadear middlewares e o manipulador final.
	 */
	options(path: string): RequestHandler<Rq, Rs> {
		return new RequestHandler(this, "options", path);
	}

	/**
	 * Cria um manipulador de rota para requisições HEAD.
	 * @param {string} path O caminho da rota.
	 * @returns {RequestHandler<Rq, Rs>} Uma instância de `RequestHandler` para encadear middlewares e o manipulador final.
	 */
	head(path: string): RequestHandler<Rq, Rs> {
		return new RequestHandler(this, "head", path);
	}

	/**
	 * Aplica um middleware a um caminho específico. Corresponde a todos os métodos HTTP.
	 * @param {string} path O caminho da rota.
	 * @returns {RequestHandler<Rq, Rs>} Uma instância de `RequestHandler` para encadear middlewares e o manipulador final.
	 */
	all(path: string): RequestHandler<Rq, Rs> {
		return new RequestHandler(this, "all", path);
	}

	/**
	 * Aplica um middleware a um caminho específico. Corresponde a todos os métodos HTTP.
	 * @param {string} path O caminho da rota.
	 * @returns {RequestHandler<Rq, Rs>} Uma instância de `RequestHandler` para encadear middlewares e o manipulador final.
	 */
	use(path: string): RequestHandler<Rq, Rs> {
		return new RequestHandler(this, "use", path);
	}

	/**
	 * Obtém uma lista de todas as rotas e middlewares registrados nesta instância do roteador.
	 * Útil para introspecção e depuração.
	 * @returns {Array<{path: string, methods: string[], type: 'ROUTE' | 'MIDDLEWARE', swagger?: object}>}
	 */
	get routes() {
		return getRoutes(this.layers);
	}

	/**
	 * Agrega toda a documentação de rota (definida via `.doc()`) e de middlewares
	 * para gerar uma especificação completa do OpenAPI v3.
	 *
	 * Este método percorre todas as rotas registradas, coleta suas definições de OpenAPI
	 * e as mescla em um único objeto de especificação, que pode ser usado diretamente
	 * com ferramentas como `swagger-ui-express`.
	 *
	 * @param {swaggerJSDoc.OAS3Definition} [options] - Um objeto de definição base do OpenAPI.
	 *   Use-o para fornecer informações globais como `info`, `servers`, `security`, etc.
	 *   A documentação gerada (`paths`, `components`) será mesclada a este objeto.
	 *
	 * @param {swaggerJSDoc.Responses} [defaultResponses={}] - Um objeto contendo respostas padrão
	 *   (por exemplo, `400`, `401`, `500`) que serão adicionadas a **todas** as rotas.
	 *   Se uma rota definir uma resposta com o mesmo código de status, a definição da rota
	 *   terá precedência.
	 *
	 * @returns {swaggerJSDoc.Options} Um objeto de opções completo, pronto para ser usado
	 *   pelo `swagger-jsdoc` ou `swagger-ui-express`.
	 *
	 * @example
	 * import express from "express";
	 * import swaggerUi from "swagger-ui-express";
	 * import { Router } from "./router";
	 *
	 * const apiRouter = new Router();
	 *
	 * apiRouter.get("/health")
	 *   .handler((req, res) => res.send("OK"))
	 *   .doc({
	 *     summary: "Verifica a saúde da API",
	 *     tags: ["Status"],
	 *     responses: { "200": { description: "API está operacional" } }
	 *   });
	 *
	 * // Definições base para o Swagger
	 * const swaggerDefinition = {
	 *   openapi: "3.0.0",
	 *   info: { title: "Minha API", version: "1.0.0" },
	 *   servers: [{ url: "http://localhost:3000" }],
	 * };
	 *
	 * // Respostas padrão para todas as rotas
	 * const defaultResponses = {
	 *   "400": { description: "Requisição inválida" },
	 *   "500": { description: "Erro interno do servidor" },
	 * };
	 *
	 * // Gera as opções do Swagger
	 * const swaggerOptions = apiRouter.getSwagger(swaggerDefinition, defaultResponses);
	 *
	 * // Integra com o Express
	 * const app = express();
	 * app.use('/api', apiRouter.router);
	 * app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerOptions));
	 *
	 * app.listen(3000);
	 */
	getSwagger(options?: swaggerJSDoc.OAS3Definition, defaultResponses: swaggerJSDoc.Responses = {}): swaggerJSDoc.Options {
		const swaggerOptions = { path: "/doc", ...this.swaggerOptions, ...(options || {}), defaultResponses: { ...(this.swaggerOptions?.defaultResponses || {}), ...defaultResponses } };

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

		return { definition: { ...omit(swaggerOptions, "path", "defaultResponses"), ...doc }, apis: [] } as any;
	}

	defineSwagger(options: SwaggerOptions) {
		this.swaggerOptions = { ...options, path: options.path || "/doc", defaultResponses: options.defaultResponses || {} };
	}

	/**
	 * Cria e retorna um novo sub-roteador que é montado em um prefixo de caminho específico.
	 *
	 * Este método é ideal para organizar rotas relacionadas em módulos. Todas as rotas
	 * definidas no roteador retornado serão prefixadas com o `path` fornecido.
	 * A nova instância do roteador herda os middlewares do roteador pai.
	 *
	 * @param {string} path - O prefixo do caminho para o sub-roteador.
	 * @returns {Router<Rq, Rs>} Uma nova instância de `Router` para definir rotas dentro do caminho especificado.
	 *
	 * @example
	 * import { Router } from "./router";
	 * import express from "express";
	 *
	 * const app = express();
	 * const mainRouter = new Router();
	 *
	 * // Cria um sub-roteador para a seção de administração.
	 * const adminRouter = mainRouter.route("/admin");
	 *
	 * // Adiciona uma rota ao sub-roteador. O caminho final será "/admin/dashboard".
	 * adminRouter.get("/dashboard").handler((req, res) => {
	 *   res.send("Bem-vindo ao painel de administração!");
	 * });
	 *
	 * // Usa o roteador principal no aplicativo Express.
	 * app.use(mainRouter.router);
	 */
	route(path: string): Router<Rq, Rs> {
		return new Router("", this.layers.route(path));
	}

	/**
	 * Monta um sub-roteador no caminho base da instância atual do roteador.
	 *
	 * Este método permite compor a aplicação anexando um roteador pré-configurado
	 * (seja uma instância de `Router` ou `express.Router`) como um middleware.
	 * Todas as rotas definidas no roteador fornecido serão acessíveis a partir do
	 * ponto de montagem do roteador atual.
	 *
	 * @param {Router | ExpressRouter} router - A instância do roteador a ser montada.
	 * @returns {this} A instância atual do `Router`, permitindo encadeamento de métodos.
	 *
	 * @example
	 * // ---- user.routes.ts ----
	 * import { Router } from './router';
	 *
	 * const userRouter = new Router();
	 * userRouter.get('/', (req, res) => res.send('Lista de usuários'));
	 * userRouter.get('/:id', (req, res) => res.send(`Detalhes do usuário ${req.params.id}`));
	 *
	 * export default userRouter;
	 *
	 * // ---- app.ts ----
	 * import express from 'express';
	 * import { Router } from './router';
	 * import userRouter from './user.routes';
	 *
	 * const app = express();
	 * const apiRouter = new Router();
	 *
	 * // Monta o userRouter no apiRouter.
	 * apiRouter.by(userRouter);
	 *
	 * // Usa o roteador principal na aplicação sob o prefixo '/api'.
	 * // As rotas de userRouter agora são acessíveis em '/api/' e '/api/:id'.
	 * app.use('/api', apiRouter.router);
	 */
	by(router: Router) {
		if (router instanceof Router) {
			this.layers.by(router.layers);
		}
		return this;
	}

	engine(ext: string, fn: (path: string, options: object, callback: (e: any, rendered?: string) => void) => void) {
		this.app.engine(ext, fn);
		return this;
	}

	enabled(setting: string): boolean {
		return this.app.enabled(setting);
	}

	disabled(setting: string): boolean {
		return this.app.disabled(setting);
	}

	enable(setting: string) {
		this.app.enable(setting);
		return this;
	}

	disable(setting: string) {
		this.app.disable(setting);
		return this;
	}

	listen(port: number, hostname: string, backlog: number, callback?: (error?: Error) => void): http.Server;
	listen(port: number, hostname: string, callback?: (error?: Error) => void): http.Server;
	listen(port: number, callback?: (error?: Error) => void): http.Server;
	listen(callback?: (error?: Error) => void): http.Server;
	listen(path: string, callback?: (error?: Error) => void): http.Server;
	listen(handle: any, listeningListener?: (error?: Error) => void): http.Server;
	listen(...args: any[]) {
		this.layers.routes.forEach(({ method, path, handle }) => {
			this.app[method](path, ...handle);
		});

		if (this.swaggerOptions) {
			const path = this.swaggerOptions.path || "/doc";

			this.app.get(joinPath(path, "/swagger/swagger.json"), (req, res) => {
				res.json(this.getSwagger().definition);
			});

			this.app.use(joinPath(path, "/swagger"), swaggerUi.serve, (...args: any) => {
				swaggerUi.setup(this.getSwagger().definition).apply(this.app, args);
			});

			this.app.use(joinPath(path, "/redoc"), (...args: any) => {
				redocUi.setup(this.getSwagger()).apply(this.app, args);
			});
		}

		return this.app.listen(...args);
	}
}
