import type swaggerJSDoc from "swagger-jsdoc";
import { ExpressRouter, HandlerFC, MiddlewareFC, MiddlewareFCDoc, RouterMethods, Request, Response } from "./type";
import Express from "express";
import { RequestHandler, PreparedHandler } from "./handler";
import { getRoutes, joinObject } from "./utils";
import { createDynamicMiddleware } from "./utils";

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
	constructor(public readonly middlewares: MiddlewareFC<any, any>[] = [], readonly router: ExpressRouter = Express.Router()) {}

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
	middleware<Req extends Request = Request, Res extends Response = Response>(callback: MiddlewareFC<Rq & Req, Rs & Res>): Router<Rq & Req, Rs & Res> {
		this.router.use(createDynamicMiddleware(callback) as any);
		return new Router([...this.middlewares, callback], this.router);
	}

	/**
	 * Encapsula uma função de handler final e todos os middlewares encadeados anteriormente
	 * em uma única instância reutilizável de `PreparedHandler`.
	 *
	 * Este método é o ponto final para a criação de "controllers" ou "actions" modulares.
	 * Ele pega a lógica do handler e a combina com os middlewares definidos na cadeia do roteador
	 * (`.middleware(...)`), produzindo um objeto que pode ser passado para o método `.handler()`
	 * de uma definição de rota (por exemplo, `router.get(...).handler(controller)`).
	 *
	 * @template Req - Tipos de requisição adicionais inferidos a partir do handler.
	 * @template Res - Tipos de resposta adicionais inferidos a partir do handler.
	 * @param {HandlerFC<Rq & Req, Rs & Res>} callback - A função de handler final ou uma instância de `PreparedHandler` já existente. Se um `PreparedHandler` for fornecido, seus middlewares serão combinados com os middlewares da cadeia atual.
	 * @returns {PreparedHandler<Rq & Req, Rs & Res>} Uma nova instância de `PreparedHandler` que encapsula o handler e a cadeia completa de middlewares.
	 *
	 * @example
	 * // 1. Defina middlewares para autenticação e autorização.
	 * interface AuthRequest extends Request { user: { id: number; role: string }; }
	 * const authMiddleware: MiddlewareFC<AuthRequest> = (req, res, next) => {
	 *   req.user = { id: 1, role: 'admin' }; // Simula a autenticação
	 *   next();
	 * };
	 *
	 * const adminOnlyMiddleware: MiddlewareFC<AuthRequest> = (req, res, next) => {
	 *   if (req.user.role !== 'admin') return res.status(403).send('Forbidden');
	 *   next();
	 * };
	 *
	 * // 2. Defina o handler final que depende dos middlewares.
	 * const getDashboard: HandlerFC<AuthRequest> = (req, res) => {
	 *   res.send(`Welcome, admin user ${req.user.id}`);
	 * };
	 *
	 * // 3. Crie um "construtor" de controller encadeando os middlewares.
	 * const controllerBuilder = new Router().middleware(authMiddleware).middleware(adminOnlyMiddleware);
	 *
	 * // 4. Use o método `.handler()` para criar o controller reutilizável.
	 * const getDashboardController = controllerBuilder.handler(getDashboard);
	 *
	 * // 5. Agora, `getDashboardController` pode ser usado em qualquer rota.
	 * const mainRouter = new Router();
	 * mainRouter.get('/admin/dashboard').handler(getDashboardController);
	 * // A rota acima aplicará automaticamente `authMiddleware` e `adminOnlyMiddleware`
	 * // antes de executar `getDashboard`.
	 */
	handler<Req extends Request = Request, Res extends Response = Response>(callback: HandlerFC<Rq & Req, Rs & Res>): PreparedHandler<Rq & Req, Rs & Res> {
		if (callback instanceof PreparedHandler) {
			return new PreparedHandler(callback.callback, [...this.middlewares, ...callback.middlewares]);
		}

		return new PreparedHandler(callback, [...this.middlewares]);
	}

	/**
	 * Cria um manipulador de rota para requisições GET.
	 * @param {string} path O caminho da rota.
	 * @returns {RequestHandler<Rq, Rs>} Uma instância de `RequestHandler` para encadear middlewares e o manipulador final.
	 */
	get(path: string): RequestHandler<Rq, Rs> {
		return new RequestHandler(this.router, "get", path, [], [...this.middlewares]);
	}

	/**
	 * Cria um manipulador de rota para requisições POST.
	 * @param {string} path O caminho da rota.
	 * @returns {RequestHandler<Rq, Rs>} Uma instância de `RequestHandler` para encadear middlewares e o manipulador final.
	 */
	post(path: string): RequestHandler<Rq, Rs> {
		return new RequestHandler(this.router, "post", path, [], [...this.middlewares]);
	}

	/**
	 * Cria um manipulador de rota para requisições PUT.
	 * @param {string} path O caminho da rota.
	 * @returns {RequestHandler<Rq, Rs>} Uma instância de `RequestHandler` para encadear middlewares e o manipulador final.
	 */
	put(path: string): RequestHandler<Rq, Rs> {
		return new RequestHandler(this.router, "put", path, [], [...this.middlewares]);
	}

	/**
	 * Cria um manipulador de rota para requisições DELETE.
	 * @param {string} path O caminho da rota.
	 * @returns {RequestHandler<Rq, Rs>} Uma instância de `RequestHandler` para encadear middlewares e o manipulador final.
	 */
	delete(path: string): RequestHandler<Rq, Rs> {
		return new RequestHandler(this.router, "delete", path, [], [...this.middlewares]);
	}

	/**
	 * Cria um manipulador de rota para requisições PATCH.
	 * @param {string} path O caminho da rota.
	 * @returns {RequestHandler<Rq, Rs>} Uma instância de `RequestHandler` para encadear middlewares e o manipulador final.
	 */
	patch(path: string): RequestHandler<Rq, Rs> {
		return new RequestHandler(this.router, "patch", path, [], [...this.middlewares]);
	}

	/**
	 * Cria um manipulador de rota para requisições OPTIONS.
	 * @param {string} path O caminho da rota.
	 * @returns {RequestHandler<Rq, Rs>} Uma instância de `RequestHandler` para encadear middlewares e o manipulador final.
	 */
	options(path: string): RequestHandler<Rq, Rs> {
		return new RequestHandler(this.router, "options", path, [], [...this.middlewares]);
	}

	/**
	 * Cria um manipulador de rota para requisições HEAD.
	 * @param {string} path O caminho da rota.
	 * @returns {RequestHandler<Rq, Rs>} Uma instância de `RequestHandler` para encadear middlewares e o manipulador final.
	 */
	head(path: string): RequestHandler<Rq, Rs> {
		return new RequestHandler(this.router, "head", path, [], [...this.middlewares]);
	}

	/**
	 * Aplica um middleware a um caminho específico. Corresponde a todos os métodos HTTP.
	 * @param {string} path O caminho da rota.
	 * @returns {RequestHandler<Rq, Rs>} Uma instância de `RequestHandler` para encadear middlewares e o manipulador final.
	 */
	all(path: string): RequestHandler<Rq, Rs> {
		return new RequestHandler(this.router, "all", path, [], [...this.middlewares]);
	}

	/**
	 * Aplica um middleware a um caminho específico. Corresponde a todos os métodos HTTP.
	 * @param {string} path O caminho da rota.
	 * @returns {RequestHandler<Rq, Rs>} Uma instância de `RequestHandler` para encadear middlewares e o manipulador final.
	 */
	use(path: string): RequestHandler<Rq, Rs> {
		return new RequestHandler(this.router, "use", path, [], [...this.middlewares]);
	}

	/**
	 * Obtém uma lista de todas as rotas e middlewares registrados nesta instância do roteador.
	 * Útil para introspecção e depuração.
	 * @returns {Array<{path: string, methods: string[], type: 'ROUTE' | 'MIDDLEWARE', swagger?: object}>}
	 */
	get routes() {
		return getRoutes(this.router);
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
		let doc: Pick<swaggerJSDoc.OAS3Definition, "paths" | "components"> = { paths: options?.paths ?? {}, components: options?.components ?? {} };
		const routes = this.routes;

		for (const { swagger } of routes) {
			if (!swagger) {
				continue;
			}
			for (const path in swagger.paths) {
				swagger.paths[path] = swagger.paths[path] || {};
				for (const method in swagger.paths[path]) {
					swagger.paths[path][method] = swagger.paths[path][method] || {};
					swagger.paths[path][method].responses = joinObject<swaggerJSDoc.Responses>(defaultResponses, swagger.paths[path][method].responses || {});
				}
			}
			doc = joinObject(doc, swagger);
		}

		return { definition: { ...options, ...doc }, apis: [] } as any;
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
		const router = Express.Router();
		this.router.use(path, router);
		return new Router([...this.middlewares], router);
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
	by(router: Router | ExpressRouter) {
		this.router.use(router instanceof Router ? router.router : router);
		return this;
	}
}

/**
 * Representa as propriedades de uma rota finalizada, permitindo a adição de metadados, como a documentação Swagger.
 * Esta classe é retornada pelo método `.handler()` e seu principal objetivo é fornecer o método `.doc()`
 * para anexar a documentação OpenAPI a um endpoint.
 *
 * @example
 * // ... continuação do exemplo do RouterContext
 * router.get("/users/:id")
 *   .handler((req, res) => {
 *     res.json({ id: req.params.id, name: "Exemplo" });
 *   })
 *   // O método .doc() é chamado na instância de RouterProps retornada por .handler()
 *   .doc({
 *     summary: "Obtém um usuário pelo ID",
 *     description: "Retorna os detalhes de um usuário específico.",
 *     tags: ["Users"],
 *     parameters: [{
 *       name: "id",
 *       in: "path",
 *       required: true,
 *       schema: { type: "integer" }
 *     }],
 *     responses: {
 *       "200": {
 *         description: "Usuário encontrado."
 *       }
 *     }
 *   });
 */
export class RouterProps {
	/**
	 * @param {RouterMethods} type O método HTTP da rota.
	 * @param {MiddlewareFC<any, any>[]} middlewares A lista de middlewares aplicados à rota.
	 * @param {Function} handler A função de handler final da rota.
	 */
	constructor(
		public readonly type: RouterMethods,
		public readonly middlewares: MiddlewareFC<any, any>[] = [],
		public readonly handler: Function,
		public readonly hierarchicalMiddleware: MiddlewareFC<any, any>[] = [],
	) {}

	/**
	 * Anexa a documentação Swagger/OpenAPI a uma rota.
	 * Esta função mescla a documentação fornecida com qualquer documentação
	 * definida nos middlewares (`middleware.doc`) que foram aplicados à rota.
	 *
	 * @param {swaggerJSDoc.Operation} operation O objeto de operação do OpenAPI que descreve o endpoint.
	 * @param {swaggerJSDoc.Components} [components={}] Definições de componentes reutilizáveis (schemas, securitySchemes, etc.).
	 * @returns {this} Retorna a própria instância de `RouterProps` para permitir encadeamento futuro (se houver).
	 */
	doc(operation: swaggerJSDoc.Operation, components: swaggerJSDoc.Components = {}) {
		(this.handler as any).swagger = (path: string) => {
			const middlewares = [...this.hierarchicalMiddleware, ...this.middlewares];
			const middlewaresDocs = middlewares.map((middleware) => middleware.doc).filter((doc) => doc !== undefined) as MiddlewareFCDoc[];

			const doc = [...middlewaresDocs, { ...operation, components } as MiddlewareFCDoc].reduce(
				(previous, current) => {
					const { components, ...operation } = current;
					return {
						operation: joinObject(previous.operation, operation || {}),
						components: joinObject(previous.components, components || {}),
					};
				},
				{
					operation: {},
					components: {},
				} as { operation: swaggerJSDoc.Operation; components: swaggerJSDoc.Components },
			);

			return { paths: { [path]: { [this.type]: doc.operation } }, components: doc.components };
		};
		return this;
	}
}
