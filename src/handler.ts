import type { Request, Response, ExpressRouter, MiddlewareFC, RouterMethods, HandlerFC } from "./type";
import { createDynamicMiddleware } from "./utils";
import { RequestMiddleware } from "./middleware";
import { RouterProps } from "./router";

/**
 * Encapsula um handler de rota final junto com uma cadeia de middlewares pré-configurados.
 *
 * Esta classe é útil para criar "controllers" ou "actions" reutilizáveis, onde a lógica do handler
 * depende de um conjunto específico de middlewares que devem ser executados antes dele.
 * Em vez de adicionar manualmente os mesmos middlewares a várias rotas, você pode agrupá-los
 * com o handler em uma única unidade.
 *
 * @template Rq - O tipo de requisição (Request) esperado pelo handler final.
 * @template Rs - O tipo de resposta (Response) esperado pelo handler final.
 *
 * @example
 * // 1. Definir um middleware que busca um usuário e o anexa à requisição.
 * interface UserRequest extends Request {
 *   user: { id: number; name: string; };
 * }
 * const findUserByIdMiddleware: MiddlewareFC<UserRequest> = (req, res, next) => {
 *   // Lógica para buscar o usuário pelo ID nos parâmetros da rota
 *   const userId = parseInt(req.params.id, 10);
 *   if (userId === 1) {
 *     req.user = { id: 1, name: "John Doe" };
 *     next();
 *   } else {
 *     res.status(404).send("User not found");
 *   }
 * };
 *
 * // 2. Definir o handler final que usa os dados do middleware.
 * const getUserProfileHandler: HandlerFC<UserRequest> = (req, res) => {
 *   // `req.user` está disponível e tipado graças ao middleware.
 *   res.json(req.user);
 * };
 *
 * // 3. Criar uma instância de `PreparedHandler` que agrupa o middleware e o handler.
 * const getUserProfileController = new PreparedHandler(
 *   getUserProfileHandler,
 *   [findUserByIdMiddleware]
 * );
 *
 * // 4. Usar o controller pré-preparado em uma definição de rota.
 * // O `router` automaticamente aplicará `findUserByIdMiddleware` antes de `getUserProfileHandler`.
 * router.get("/users/:id").handler(getUserProfileController);
 */
export class PreparedHandler<Rq extends Request = Request, Rs extends Response = Response> extends RequestMiddleware<Rq, Rs> {
	constructor(public readonly callback: HandlerFC<Rq, Rs>, middlewares: MiddlewareFC<any, any>[] = []) {
		super(undefined, middlewares);
	}
}

/**
 * Construtor de rotas que permite o encadeamento de middlewares antes do handler final.
 * Esta classe é a parte central da API fluente para definir rotas (ex: `router.get(...).middleware(...).handler(...)`).
 * Ela herda da classe `RequestMiddleware` para acumular middlewares e seus tipos associados.
 *
 * @template Rq - O tipo de requisição (Request) acumulado a partir dos middlewares anteriores.
 * @template Rs - O tipo de resposta (Response) acumulado a partir dos middlewares anteriores.
 *
 * @example
 * // Exemplo de como a classe Handler é usada internamente pelo RouterContext.
 *
 * // 1. RequestMiddleware de autenticação que adiciona `userId` à requisição.
 * interface AuthRequest extends Request { userId: number; }
 * const authMiddleware: MiddlewareFC<AuthRequest> = (req, res, next) => {
 *   req.userId = 123; // Simula a autenticação
 *   next();
 * };
 *
 * // 2. Criação da rota usando a API fluente.
 * // router.get() retorna uma instância de Handler.
 * router
 *   .get("/users/me")
 *   // .middleware() retorna uma nova instância de Handler com o middleware adicionado.
 *   .middleware(authMiddleware)
 *   // .handler() finaliza a cadeia, registrando a rota e o handler no Express.
 *   .handler((req, res) => {
 *     // Graças à tipagem encadeada, `req.userId` está disponível e é do tipo `number`.
 *     const userId = req.userId;
 *     res.json({ id: userId, name: "Usuário Logado" });
 *   });
 */
export class RequestHandler<Rq extends Request = Request, Rs extends Response = Response> extends RequestMiddleware<Rq, Rs> {
	/**
	 * @param {ExpressRouter} router - A instância do roteador Express onde a rota será registrada.
	 * @param {RouterMethods} type - O método HTTP da rota (get, post, etc.).
	 * @param {string} path - O padrão de caminho da rota.
	 * @param {MiddlewareFC<any, any>[]} [middlewares=[]] - Uma lista inicial de middlewares.
	 */
	constructor(
		public readonly router: ExpressRouter,
		public readonly type: RouterMethods,
		public readonly path: string,
		middlewares: MiddlewareFC<any, any>[] = [],
		public readonly hierarchicalMiddleware: MiddlewareFC<any, any>[] = [],
	) {
		super(undefined, middlewares);
	}

	/**
	 * Adiciona um middleware à cadeia de execução da rota atual.
	 * @template Req - O tipo que o novo middleware adiciona à requisição.
	 * @template Res - O tipo que o novo middleware adiciona à resposta.
	 * @param {MiddlewareFC<Rq & Req, Rs & Res>} callback - A função de middleware a ser adicionada.
	 * @returns {RequestHandler<Rq & Req, Rs & Res>} Uma nova instância de `RequestHandler` para permitir mais encadeamento.
	 */
	middleware<Req extends Request = Request, Res extends Response = Response>(callback: MiddlewareFC<Rq & Req, Rs & Res>): RequestHandler<Rq & Req, Rs & Res> {
		return new RequestHandler(this.router, this.type, this.path, [...this.middlewares, callback], this.hierarchicalMiddleware);
	}

	/**
	 * Define o handler final para a rota, completando a cadeia de configuração.
	 * Este método registra a rota no roteador Express, aplicando todos os middlewares
	 * que foram encadeados anteriormente.
	 *
	 * @template Req - Tipos de requisição adicionais inferidos a partir do handler.
	 * @template Res - Tipos de resposta adicionais inferidos a partir do handler.
	 * @param {HandlerFC<Rq & Req, Rs & Res> | PreparedHandler<Rq & Req, Rs & Res>} callback - A função que processará a requisição. Pode ser uma função de handler (`HandlerFC`) ou uma instância de `PreparedHandler` que já encapsula um handler e seus próprios middlewares.
	 * @returns {RouterProps} Uma instância que permite adicionar metadados, como documentação Swagger, à rota.
	 */
	handler<Req extends Request = Request, Res extends Response = Response>(callback: HandlerFC<Rq & Req, Rs & Res>): RouterProps {
		if (callback instanceof PreparedHandler) {
			const handler = createDynamicMiddleware(callback.callback as any);
			this.router[this.type](this.path, ...this.middlewares.map(createDynamicMiddleware), ...callback.middlewares.map(createDynamicMiddleware), handler as any);
			return new RouterProps(this.type, [...this.middlewares, ...callback.middlewares], handler, this.hierarchicalMiddleware);
		}

		const handler = createDynamicMiddleware(callback);
		this.router[this.type](this.path, ...this.middlewares.map(createDynamicMiddleware), handler as any);
		return new RouterProps(this.type, [...this.middlewares], handler, this.hierarchicalMiddleware);
	}
}
