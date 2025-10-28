import type { Request, Response, NextFunction, MiddlewareFCDoc, MiddlewareCallback, HandlerCallback } from "./type";
import { Router } from "./router";
import { createDynamicMiddleware, joinDocs } from "./utils";
import { uuidv4 } from "@ismael1361/utils";
import { Handler } from "./handler";

/**
 * @internal
 * Uma classe base para a construção de componentes de middleware encadeáveis.
 * Esta classe não deve ser instanciada diretamente pelo usuário final.
 */
export class RequestMiddleware<Rq extends Request = Request, Rs extends Response = Response> {
	/** @internal */
	constructor(callback: MiddlewareCallback<Rq, Rs> | undefined, readonly router: Router = new Router(), public doc?: MiddlewareFCDoc) {
		if (callback) {
			if (callback instanceof RequestMiddleware) {
				callback.router.layers.forEach((l) => {
					this.router.layers.push(l);
				});
			} else {
				callback.id = callback.id || uuidv4("-");
				this.doc = callback.doc = joinDocs(callback?.doc || {}, doc || {});
				this.router.middleware(createDynamicMiddleware(callback));
			}
		}
	}

	/**
	 * Anexa um middleware adicional à cadeia.
	 *
	 * @template Req - Tipo de Request estendido pelo novo middleware.
	 * @template Res - Tipo de Response estendido pelo novo middleware.
	 * @param {MiddlewareCallback<Rq & Req, Rs & Res>} callback - A função de middleware a ser adicionada.
	 * @param {MiddlewareFCDoc} [doc] - Documentação OpenAPI opcional para o middleware.
	 * @returns {RequestMiddleware<Rq & Req, Rs & Res>} Uma nova instância de `RequestMiddleware` com o middleware adicionado.
	 */
	middleware<Req extends Request = Request, Res extends Response = Response>(callback: MiddlewareCallback<Rq & Req, Rs & Res>, doc?: MiddlewareFCDoc): RequestMiddleware<Rq & Req, Rs & Res> {
		return new RequestMiddleware(callback, this.router, doc);
	}

	/**
	 * Executa a cadeia de middlewares encapsulados por esta instância.
	 * Este método é projetado principalmente para testes, permitindo que você execute a lógica do middleware
	 * de forma isolada, sem a necessidade de um servidor HTTP real.
	 *
	 * @param {Rq} request - O objeto de requisição (ou um mock para testes).
	 * @param {Rs} response - O objeto de resposta (ou um mock para testes).
	 * @param {NextFunction} next - A função `next` a ser chamada ao final da cadeia de middlewares.
	 * @returns {Promise<void>} Uma promessa que resolve quando a execução da cadeia é concluída.
	 *
	 * @example
	 * import { middleware, Request, Response, NextFunction } from '@ismael1361/router';
	 *
	 * // 1. Crie um componente de middleware reutilizável
	 * const myMiddleware = middleware<{ user: { id: string } }>((req, res, next) => {
	 *   req.user = { id: 'test-user' };
	 *   next();
	 * });
	 *
	 * // 2. Crie mocks para os objetos de requisição, resposta e next (ex: com Jest)
	 * const mockRequest = {} as Request & { user: { id: string } };
	 * const mockResponse = {} as Response;
	 * const mockNext = () => {}; // ou jest.fn()
	 *
	 * // 3. Execute o middleware programaticamente e verifique o resultado
	 * await myMiddleware.execute(mockRequest, mockResponse, mockNext);
	 * console.log(mockRequest.user); // Output: { id: 'test-user' }
	 */
	execute(request: Rq, response: Rs, next: NextFunction) {
		return this.router.executeMiddlewares(request, response, next);
	}
}

/**
 * Representa um componente de middleware encadeável que pode ser finalizado com um manipulador (handler).
 * Uma instância desta classe é retornada pela função `middleware()`. Permite criar componentes
 * de lógica reutilizáveis que podem ser aplicados a múltiplas rotas.
 *
 * @example
 * // middlewares/auth.ts
 * import { middleware, Request } from '@ismael1361/router';
 *
 * // Define um tipo para a requisição após a autenticação
 * interface AuthRequest extends Request {
 *   user: { id: string; roles: string[] };
 * }
 *
 * // Cria um componente de middleware reutilizável
 * export const authMiddleware = middleware<AuthRequest>((req, res, next) => {
 *   // Lógica de autenticação...
 *   req.user = { id: 'user-123', roles: ['admin'] };
 *   next();
 * }, {
 *   security: [{ bearerAuth: [] }], // Documentação OpenAPI
 *   responses: { '401': { description: 'Não autorizado' } }
 * });
 *
 * // routes/users.ts
 * // router.get('/profile')
 * //   .middleware(authMiddleware) // Aplica o middleware
 * //   .handler((req, res) => {
 * //     // req.user está disponível e tipado aqui
 * //     res.json(req.user);
 * //   });
 */
export class Middleware<Rq extends Request = Request, Rs extends Response = Response> extends RequestMiddleware<Rq, Rs> {
	/**
	 * Anexa um middleware adicional à cadeia.
	 *
	 * @returns {Middleware<Rq & Req, Rs & Res>} Uma nova instância de `Middleware` para continuar o encadeamento.
	 */
	middleware<Req extends Request = Request, Res extends Response = Response>(callback: MiddlewareCallback<Rq & Req, Rs & Res>, doc?: MiddlewareFCDoc): Middleware<Rq & Req, Rs & Res> {
		return new Middleware(callback, this.router, doc);
	}

	/**
	 * Finaliza a cadeia de middlewares e define um manipulador (handler) final.
	 * Isso transforma o componente de middleware em um componente de manipulador completo e reutilizável.
	 *
	 * @returns {Handler<Rq & Req, Rs & Res>} Uma instância de `Handler` que encapsula toda a cadeia.
	 */
	handler<Req extends Request = Request, Res extends Response = Response>(callback: HandlerCallback<Rq & Req, Rs & Res>, doc?: MiddlewareFCDoc): Handler<Rq & Req, Rs & Res> {
		return new Handler(callback, this.router, doc);
	}

	/**
	 * Executa a cadeia de middlewares encapsulados por esta instância de `Middleware`.
	 * Este método é herdado e serve principalmente para fins de teste, permitindo invocar
	 * a lógica do middleware de forma isolada.
	 *
	 * @param {Rq} request - O objeto de requisição (ou um mock para testes).
	 * @param {Rs} response - O objeto de resposta (ou um mock para testes).
	 * @param {NextFunction} next - A função `next` a ser chamada ao final da cadeia.
	 * @returns {Promise<void>} Uma promessa que resolve quando a execução é concluída.
	 *
	 * @example
	 * import { middleware, Request, Response, NextFunction } from '@ismael1361/router';
	 *
	 * const addDataMiddleware = middleware<{ customData: string }>((req, res, next) => {
	 *   req.customData = 'Hello from middleware!';
	 *   next();
	 * });
	 *
	 * const mockRequest = {} as Request & { customData: string };
	 *
	 * await addDataMiddleware.execute(mockRequest, {} as Response, () => {});
	 * console.log(mockRequest.customData); // Output: 'Hello from middleware!'
	 */
	execute(request: Rq, response: Rs, next: NextFunction) {
		return super.execute(request, response, next);
	}
}

/**
 * @internal
 * Representa um componente de middleware que também possui capacidades de roteamento.
 * Usado internamente para construir estruturas de roteamento mais complexas.
 */
export class MiddlewareRouter<Rq extends Request = Request, Rs extends Response = Response> extends RequestMiddleware<Rq, Rs> {
	middleware<Req extends Request = Request, Res extends Response = Response>(callback: MiddlewareCallback<Rq & Req, Rs & Res>, doc?: MiddlewareFCDoc): MiddlewareRouter<Rq & Req, Rs & Res> {
		return new MiddlewareRouter(callback, this.router, doc);
	}

	route(path: string): Router<Rq, Rs> {
		return this.router.route(path);
	}

	by(router: Router): this {
		this.router.by(router);
		return this;
	}

	execute(request: Rq, response: Rs, next: NextFunction) {
		return super.execute(request, response, next);
	}
}
