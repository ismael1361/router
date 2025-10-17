import type { Request as ExpressRequest, Response as ExpressResponse, NextFunction, Router as ExpressRouter, Express as ExpressApp, RequestHandler, Locals } from "express";
import type swaggerJSDoc from "swagger-jsdoc";

export { ExpressRequest, NextFunction, ExpressRouter, ExpressApp };

type Send<ResBody = any, T = Response<ResBody>> = (body?: ResBody) => T;

// helper: detecta `any`
type IsAny<T> = 0 extends 1 & T ? true : false;

// mesclagem de objetos por chave (se ambos tem a mesma chave, usa union dos tipos)
type MergeObjects<A, B> = {
	[K in keyof A | keyof B]: K extends keyof A
		? K extends keyof B
			? A[K] | B[K] // se ambos definem a chave, junta como union (você pode trocar por A[K] & B[K])
			: A[K]
		: K extends keyof B
		? B[K]
		: never;
};

// prefere um lado quando o outro é `any`, caso contrário mescla
export type PreferMerge<A, B> = IsAny<A> extends true ? B : IsAny<B> extends true ? A : MergeObjects<A, B>;

// combina chaves tipo string (ReqQuery / ReqParams), preferindo o não-any, senão união
export type CombineKeys<A, B> = IsAny<A> extends true ? B : IsAny<B> extends true ? A : A | B;

export type Identity<T> = IsAny<T> extends true ? Record<PropertyKey, any> : T;

export type Prettify<T> = { [K in keyof T]: T[K] } & {};

export type RouterMethods = "get" | "post" | "put" | "delete" | "patch" | "options" | "head" | "all" | "use";

/**
 * Representa um objeto de requisição (request) estendido do Express, com tipagem aprimorada e propriedades adicionais.
 * Esta interface permite definir os tipos para os parâmetros da rota (`ReqParams`),
 * o corpo da requisição (`ReqBody`), a query string (`ReqQuery`) e o corpo da resposta (`ResBody`),
 * proporcionando um desenvolvimento mais seguro e com melhor autocompletar.
 *
 * @template {string} [ReqQuery=any] - As chaves esperadas na query string da URL (ex: "id" | "name").
 * @template [ReqBody=any] - O tipo do corpo da requisição (ex: `{ username: string; }`).
 * @template [ResBody=any] - O tipo do corpo da resposta que será enviada.
 * @template {string} [ReqParams=any] - As chaves dos parâmetros da rota (ex: "userId" | "postId").
 *
 * @property {string} clientIp - O endereço IP do cliente que originou a requisição.
 * @property {Record<ReqParams, any>} params - Um objeto contendo os parâmetros da rota, com chaves fortemente tipadas.
 *
 * @example
 * // Exemplo de uso em um handler para a rota: GET /users/:userId?active=true
 * import { Response } from "express";
 * import { Request } from "./Router2";
 *
 * // Define os tipos para a requisição
 * type GetUserReq = Request<"active", never, { id: number; name: string }, "userId">;
 *
 * const getUserHandler = (req: GetUserReq, res: Response) => {
 *   // Acesso fortemente tipado aos parâmetros e query
 *   const userId: string = req.params.userId;
 *   const isActive: string = req.query.active; // "true" ou undefined
 *   res.json({ id: parseInt(userId, 10), name: "Usuário Exemplo" });
 * };
 */
export interface Request<ReqQuery extends string = any, ReqBody = any, ResBody = any, ReqParams extends string = any>
	extends ExpressRequest<Record<ReqParams, any>, ResBody, Identity<ReqBody>, Record<ReqQuery, any>> {
	clientIp: string;
	body: Identity<ReqBody>;
	params: Record<ReqParams, any>;
	query: Record<ReqQuery, any>;
}

export interface Response<ResBody = any, LocalsObj extends Record<string, any> = Record<string, any>> extends ExpressResponse<ResBody, LocalsObj> {
	send: Send<ResBody, this>;
	json: Send<ResBody, this>;
	jsonp: Send<ResBody, this>;
	locals: LocalsObj & Locals;
}

export type ExpressRequestHandler<Rq, Rs> = Rq extends ExpressRequest<infer P, any, infer ReqBody, infer ReqQuery, any>
	? Rs extends ExpressResponse<infer ResBody, infer LocalsObj>
		? RequestHandler<P, ResBody, ReqBody, ReqQuery, LocalsObj>
		: never
	: never;

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

/**
 * Estende o objeto de requisição do Express com funcionalidades adicionais para o middleware.
 * @template Req O tipo do objeto de requisição do Express.
 */
export type MiddlewareRequest<Req = Request> = Request &
	Req & {
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
		 *   req.executeOnce();
		 *
		 *   console.log("Este middleware só roda uma vez!");
		 *   next();
		 * };
		 */
		executeOnce(isOnce?: boolean): void;
	};

/**
 * Define a assinatura para uma função de middleware que será chamada quando uma rota for correspondida.
 * @param req O objeto da requisição, estendido com o método `executeOnce`.
 * @param res O objeto da resposta.
 * @param next A função para chamar o próximo middleware na pilha.
 * @template Req O tipo do objeto de requisição do Express.
 * @template Res O tipo do objeto de resposta do Express.
 * @example
 * ```ts
 * import { MiddlewareFC } from "utils/Router2";
 *
 * // Middleware que adiciona uma propriedade 'user' à requisição.
 * const authMiddleware: MiddlewareFC = (req, res, next) => {
 *   // Em um cenário real, você validaria um token e buscaria o usuário.
 *   (req as any).user = { id: 1, name: "Usuário Teste" };
 *   next();
 * };
 * ```
 */
export type MiddlewareFC<Req extends Request = any, Res extends Response = any> = {
	(req: MiddlewareRequest<Req>, res: Response & Res, next: NextFunction): any;
	id?: string;
	doc?: MiddlewareFCDoc;
};

export type HandlerFC<Req extends Request = any, Res extends Response = any> = MiddlewareFC<Req, Res>;

export type ILayer = {
	method: RouterMethods;
	type: "layer" | "route" | "middleware";
	doc?: MiddlewareFCDoc;
} & (
	| {
			path?: string;
			type: "route";
			route: ILayer[];
			handle?: Array<HandlerFC | MiddlewareFC>;
	  }
	| {
			path: string;
			method: RouterMethods;
			type: "layer";
			handle: Array<HandlerFC | MiddlewareFC>;
	  }
	| {
			method: RouterMethods;
			type: "middleware";
			handle: Array<HandlerFC | MiddlewareFC>;
	  }
);

export interface IRoute {
	path: string;
	method: RouterMethods;
	handle: Array<HandlerFC | MiddlewareFC>;
	doc?: MiddlewareFCDoc;
}

export interface RouterProps<Req extends Request = any, Res extends Response = any> {
	type: RouterMethods;
	path: string;
	middlewares: MiddlewareFC<Req, Res>[];
	handler: HandlerFC<Req, Res>;
	doc(operation: swaggerJSDoc.Operation, components?: swaggerJSDoc.Components): RouterProps;
}

export interface SwaggerOptions extends swaggerJSDoc.OAS3Definition {
	path?: string;
	defaultResponses?: swaggerJSDoc.Responses;
}
