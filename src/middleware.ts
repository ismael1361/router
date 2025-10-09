import type { Request, Response, ExpressRouter, MiddlewareFC } from "./type";
import { Router } from "./router";
import Express from "express";
import { createDynamicMiddleware } from "./utils";

/**
 * Representa um construtor de cadeia de middlewares.
 * Esta classe é a base para criar sequências de middlewares de forma fluente,
 * permitindo que os tipos de requisição e resposta sejam estendidos a cada passo.
 *
 * @template Rq O tipo de requisição acumulado na cadeia de middlewares.
 * @template Rs O tipo de resposta acumulado na cadeia de middlewares.
 */
export class RequestMiddleware<Rq extends Request = Request, Rs extends Response = Response> {
	/** A lista de middlewares acumulados. */
	public middlewares: MiddlewareFC<any, any>[];

	/**
	 * @param {MiddlewareFC<Rq, Rs>} [callback] - O middleware inicial para adicionar à cadeia.
	 * @param {MiddlewareFC<any, any>[]} [middlewares=[]] - Uma lista de middlewares pré-existentes para iniciar a cadeia.
	 */
	constructor(callback: MiddlewareFC<Rq, Rs> | undefined, middlewares: MiddlewareFC<any, any>[] = [], readonly router: ExpressRouter = Express.Router()) {
		this.middlewares = [...middlewares];
		if (callback) this.middlewares.push(callback);
	}

	/**
	 * Adiciona um novo middleware à cadeia.
	 *
	 * @template Req O tipo de requisição que este novo middleware adiciona.
	 * @template Res O tipo de resposta que este novo middleware adiciona.
	 * @param {MiddlewareFC<Rq & Req, Rs & Res>} callback O middleware a ser adicionado.
	 * @returns {RequestMiddleware<Rq & Req, Rs & Res>} Uma nova instância de `RequestMiddleware` com a cadeia estendida.
	 */
	middleware<Req extends Request = Request, Res extends Response = Response>(callback: MiddlewareFC<Rq & Req, Rs & Res>): RequestMiddleware<Rq & Req, Rs & Res> {
		this.router.use(([callback] as any).map(createDynamicMiddleware));
		return new RequestMiddleware(undefined, [...this.middlewares, callback], this.router);
	}
}

/**
 * Um construtor de roteadores com middlewares compartilhados.
 *
 * Esta classe permite construir uma base de middlewares de forma fluente e com segurança de tipos.
 * Após configurar os middlewares desejados, você pode usar o método `.route()` para criar
 * roteadores específicos (sub-rotas) que herdam automaticamente todos os middlewares e
 * suas respectivas tipagens de requisição e resposta.
 *
 * Isso é útil para agrupar rotas que compartilham a mesma lógica de autenticação,
 * logging ou qualquer outro pré-processamento, garantindo que os tipos sejam consistentes.
 *
 * @template Rq O tipo de requisição acumulado na cadeia de middlewares.
 * @template Rs O tipo de resposta acumulado na cadeia de middlewares.
 *
 * @example
 * import express, { Request, Response, NextFunction } from "express";
 * import { MiddlewareRouter, MiddlewareFC } from "./middleware"; // Ajuste o caminho
 *
 * // 1. Defina os tipos e middlewares que estendem a requisição
 * interface AuthRequest { user: { id: number; role: string }; }
 * const authMiddleware: MiddlewareFC<AuthRequest> = (req, res, next) => {
 *   // Em um app real, validaria um token e buscaria o usuário
 *   req.user = { id: 1, role: "admin" };
 *   next();
 * };
 *
 * interface LoggedRequest { log: (message: string) => void; }
 * const loggerMiddleware: MiddlewareFC<LoggedRequest> = (req, res, next) => {
 *   req.log = (message) => console.log(`[${new Date().toISOString()}] ${message}`);
 *   next();
 * };
 *
 * // 2. Crie uma base de roteamento com os middlewares
 * const baseRouter = new MiddlewareRouter(authMiddleware)
 *   .middleware(loggerMiddleware)
 *
 * // 3. Crie sub-rotas a partir da base. Elas herdarão os middlewares.
 * const usersRouter = baseRouter.route("/users");
 * const postsRouter = baseRouter.route("/posts");
 *
 * // 4. Defina os handlers. `req` terá os tipos `AuthRequest & LoggedRequest`.
 * usersRouter.get("/:id").handler((req, res) => {
 *   req.log(`Buscando usuário com ID: ${req.params.id}`);
 *   // `req.user` está disponível e tipado
 *   res.json({ id: req.params.id, requester: req.user });
 * });
 *
 * postsRouter.get("/").handler((req, res) => {
 *   req.log("Listando posts");
 *   // `req.user` também está disponível aqui
 *   if (req.user.role !== 'admin') {
 *     return res.status(403).send("Acesso negado");
 *   }
 *   res.json([{ id: 1, title: "Post de Admin" }]);
 * });
 *
 * // 5. Use os roteadores no seu app Express
 * const app = express();
 * // O roteador principal que contém as sub-rotas é o `baseRouter.router`
 * app.use("/api/v1", baseRouter.router);
 *
 * app.listen(3000, () => console.log("Servidor rodando na porta 3000"));
 */
export class MiddlewareRouter<Rq extends Request = Request, Rs extends Response = Response> extends RequestMiddleware<Rq, Rs> {
	/**
	 * Adiciona um novo middleware à cadeia de construção.
	 *
	 * Este método é imutável: ele retorna uma **nova instância** de `MiddlewareRouter`
	 * com o middleware adicionado, permitindo o encadeamento seguro. A tipagem dos
	 * objetos `Request` e `Response` é aprimorada para refletir as modificações
	 * feitas pelo novo middleware.
	 *
	 * @template Req O tipo de `Request` que o novo middleware adiciona ou modifica.
	 * @template Res O tipo de `Response` que o novo middleware adiciona ou modifica.
	 * @param {MiddlewareFC<Rq & Req, Rs & Res>} callback A função de middleware a ser adicionada.
	 * @returns {MiddlewareRouter<Rq & Req, Rs & Res>} Uma nova instância de `MiddlewareRouter` com a cadeia estendida.
	 */
	middleware<Req extends Request = Request, Res extends Response = Response>(callback: MiddlewareFC<Rq & Req, Rs & Res>): MiddlewareRouter<Rq & Req, Rs & Res> {
		this.router.use(([callback] as any).map(createDynamicMiddleware));
		return new MiddlewareRouter(undefined, [...this.middlewares, callback], this.router);
	}

	/**
	 * Cria um novo sub-roteador (`Router`) montado em um prefixo de caminho específico.
	 *
	 * O roteador retornado herda todos os middlewares (e suas tipagens) que foram
	 * configurados nesta cadeia de `MiddlewareRouter`. É o principal método para
	 * criar grupos de rotas que compartilham uma configuração base.
	 *
	 * @param {string} path O prefixo do caminho para o sub-roteador.
	 * @returns {Router<Rq, Rs>} Uma nova instância de `Router` para definir as rotas finais.
	 * @see MiddlewareRouter para um exemplo de uso completo.
	 */
	route(path: string): Router<Rq, Rs> {
		return new Router([...this.middlewares], this.router).route(path);
	}

	/**
	 * Monta um sub-roteador existente na raiz do roteador base.
	 *
	 * Este método é usado para compor a aplicação anexando um módulo de rotas
	 * pré-construído (uma instância de `Router` ou `express.Router`).
	 *
	 * **Importante:** Diferente do método `.route()`, os middlewares configurados
	 * na cadeia do `MiddlewareRouter` **não são herdados** pelo roteador que está
	 * sendo montado com `.by()`. Ele é útil para anexar roteadores que
	 * não devem compartilhar o mesmo contexto de middleware (por exemplo, rotas públicas).
	 *
	 * @param {Router | ExpressRouter} router - A instância do roteador a ser montada.
	 * @returns {this} A instância atual de `MiddlewareRouter`, permitindo o encadeamento de chamadas.
	 *
	 * @example
	 * // RequestMiddleware de autenticação
	 * const authMiddleware = (req, res, next) => {
	 *   req.user = { id: 1 };
	 *   next();
	 * };
	 *
	 * // Roteador base com autenticação
	 * const api = new MiddlewareRouter(authMiddleware);
	 *
	 * // Roteador de status público (não deve ter auth)
	 * const statusRouter = new Router();
	 * statusRouter.get("/status").handler((req, res) => res.send("Service is up"));
	 *
	 * // Monta o roteador público usando .by()
	 * api.by(statusRouter);
	 */
	by(router: Router | ExpressRouter): this {
		new Router([...this.middlewares], this.router).by(router);
		return this;
	}
}
