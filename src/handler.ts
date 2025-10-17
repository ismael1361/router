import type { Request, Response, RouterProps, MiddlewareFC, RouterMethods, HandlerFC } from "./type";
import { createDynamicMiddleware, joinDocs } from "./utils";
import { RequestMiddleware } from "./middleware";
import { Router } from "./router";
import swaggerJSDoc from "swagger-jsdoc";

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
	readonly middlewares: MiddlewareFC<any, any>[] = [];

	/**
	 * @param {ExpressRouter} router - A instância do roteador Express onde a rota será registrada.
	 * @param {RouterMethods} type - O método HTTP da rota (get, post, etc.).
	 * @param {string} path - O padrão de caminho da rota.
	 * @param {MiddlewareFC<any, any>[]} [middlewares=[]] - Uma lista inicial de middlewares.
	 */
	constructor(public readonly router: Router, public readonly type: RouterMethods, public readonly path: string) {
		super(undefined, router);
	}

	/**
	 * Adiciona um middleware à cadeia de execução da rota atual.
	 * @template Req - O tipo que o novo middleware adiciona à requisição.
	 * @template Res - O tipo que o novo middleware adiciona à resposta.
	 * @param {MiddlewareFC<Rq & Req, Rs & Res>} callback - A função de middleware a ser adicionada.
	 * @returns {RequestHandler<Rq & Req, Rs & Res>} Uma nova instância de `RequestHandler` para permitir mais encadeamento.
	 */
	middleware<Req extends Request = Request, Res extends Response = Response>(callback: MiddlewareFC<Rq & Req, Rs & Res>): RequestHandler<Rq & Req, Rs & Res> {
		this.middlewares.push(callback);
		return this;
	}

	/**
	 * Define o handler final para a rota, completando a cadeia de configuração.
	 * Este método registra a rota no roteador Express, aplicando todos os middlewares
	 * que foram encadeados anteriormente.
	 *
	 * @template Req - Tipos de requisição adicionais inferidos a partir do handler.
	 * @template Res - Tipos de resposta adicionais inferidos a partir do handler.
	 * @param {HandlerFC<Rq & Req, Rs & Res>} callback - A função que processará a requisição. Pode ser uma função de handler (`HandlerFC`).
	 * @returns {RouterProps} Uma instância que permite adicionar metadados, como documentação Swagger, à rota.
	 */
	handler<Req extends Request = Request, Res extends Response = Response>(callback: HandlerFC<Rq & Req, Rs & Res>): RouterProps {
		const route = this.router.layers[this.type](this.path, [...this.middlewares, callback].map(createDynamicMiddleware));

		return {
			type: this.type,
			path: this.path,
			middlewares: this.middlewares,
			handler: callback,
			doc(operation: swaggerJSDoc.Operation, components: swaggerJSDoc.Components = {}) {
				route.doc = joinDocs(route.doc, { ...operation, components });
				return this;
			},
		};
	}
}
