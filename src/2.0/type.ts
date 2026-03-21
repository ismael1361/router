import type * as core from "express-serve-static-core";
import type { NextFunction } from "express";
import type swaggerJSDoc from "swagger-jsdoc";

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

export interface Request<P extends string = string, ReqBody = {}, ReqQuery = core.Query, ResBody = any> extends core.Request<ParamsDictionary<P>, ResBody, ReqBody, ReqQuery, Record<string, any>> {}

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

export type Methods =
	| "all"
	| "get"
	| "post"
	| "put"
	| "delete"
	| "patch"
	| "options"
	| "head"
	| "checkout"
	| "copy"
	| "lock"
	| "merge"
	| "mkactivity"
	| "mkcol"
	| "move"
	| "m-search"
	| "notify"
	| "purge"
	| "report"
	| "search"
	| "subscribe"
	| "trace"
	| "unlock"
	| "unsubscribe";

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
	parent: IParentDoc | null;
	children: (IChildrenDoc | ITreeDoc)[];
}
