import type * as core from "express-serve-static-core";
import express, { NextFunction } from "express";
import Layer from "router/lib/layer";
import { METHODS } from "http";

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

export type Join<A, B> = IsBad<A> extends true ? B : IsBad<B> extends true ? A : A & B;

export type ExtractRouteParameters<Path extends string> = Extract<keyof core.RouteParameters<Path>, string>;

export type ParamsDictionary<P extends string = string> = {
	[key in P]: string;
};

export interface Request<P extends string = string, ReqBody = {}, ReqQuery = core.Query, ResBody = any> extends core.Request<ParamsDictionary<P>, ResBody, ReqBody, ReqQuery, Record<string, any>> {}

type JoinRequest<A extends Request, B extends Request> = A extends Request<infer AP, infer AReqBody, infer AReqQuery, infer AResBody> & infer AReq
	? B extends Request<infer BP, infer BReqBody, infer BReqQuery, infer BResBody> & infer BReq
		? Request<Join<AP, BP>, Join<AReqBody, BReqBody>, Join<AReqQuery, BReqQuery>, Join<AResBody, BResBody>> & (AReq & BReq)
		: never
	: never;

export interface Response<ResBody = any> extends core.Response<ResBody, Record<string, any>> {}

type JoinResponse<A extends Response, B extends Response> = A extends Response<infer AResBody> ? (B extends Response<infer BResBody> ? Response<AResBody & BResBody> : never) : never;

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

const defineRoute = <Rq extends Request = Request, Rs extends Response = Response>(router: express.Router, method: Methods, path: string) => {
	const innerRouter = router.route(path);

	const route = innerRouter[method].apply(innerRouter, [
		(req: any, res: any, next: any) => {
			next();
		},
	]); // Initialize the method on the route to ensure the layer is created

	route.stack = []; // Clear the default handler added by Express

	return {
		handle<Req extends Request = Request, Res extends Response = Response>(fn: RequestHandler<Req & Rq, Res & Rs>) {
			const layer = Layer("/", {}, fn);
			layer.method = method;
			if ("methods" in route) {
				(route as any).methods[method] = true;
			}
			route.stack.push(layer);
			return this as ReturnType<typeof defineRoute<JoinRequest<Rq, Req>, JoinResponse<Rs, Res>>>;
		},
	};
};

// Definimos a interface que é uma função E possui métodos
export interface IRouter {
	// Esta é a "Call Signature" (assinatura de chamada)
	(req: Request, res: Response, next: NextFunction): void;

	// Abaixo os métodos do objeto
	all<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path): ReturnType<typeof defineRoute<Request<P>>>;
	get<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path): ReturnType<typeof defineRoute<Request<P>>>;
	post<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path): ReturnType<typeof defineRoute<Request<P>>>;
	put<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path): ReturnType<typeof defineRoute<Request<P>>>;
	delete<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path): ReturnType<typeof defineRoute<Request<P>>>;
	patch<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path): ReturnType<typeof defineRoute<Request<P>>>;
	options<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path): ReturnType<typeof defineRoute<Request<P>>>;
	head<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path): ReturnType<typeof defineRoute<Request<P>>>;

	checkout<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path): ReturnType<typeof defineRoute<Request<P>>>;
	copy<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path): ReturnType<typeof defineRoute<Request<P>>>;
	lock<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path): ReturnType<typeof defineRoute<Request<P>>>;
	merge<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path): ReturnType<typeof defineRoute<Request<P>>>;
	mkactivity<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path): ReturnType<typeof defineRoute<Request<P>>>;
	mkcol<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path): ReturnType<typeof defineRoute<Request<P>>>;
	move<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path): ReturnType<typeof defineRoute<Request<P>>>;
	"m-search"<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path): ReturnType<typeof defineRoute<Request<P>>>;
	notify<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path): ReturnType<typeof defineRoute<Request<P>>>;
	purge<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path): ReturnType<typeof defineRoute<Request<P>>>;
	report<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path): ReturnType<typeof defineRoute<Request<P>>>;
	search<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path): ReturnType<typeof defineRoute<Request<P>>>;
	subscribe<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path): ReturnType<typeof defineRoute<Request<P>>>;
	trace<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path): ReturnType<typeof defineRoute<Request<P>>>;
	unlock<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path): ReturnType<typeof defineRoute<Request<P>>>;
	unsubscribe<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path): ReturnType<typeof defineRoute<Request<P>>>;
}

export const router = (): IRouter => {
	const innerRouter = express.Router();

	// Criamos o objeto com os seus métodos customizados
	const customMethods = {} as Record<Methods, any>;

	METHODS.concat("all").forEach((method) => {
		(customMethods as any)[method] = function (path: string) {
			return defineRoute(innerRouter, method as Methods, path);
		};
	});

	const routerHandler: RequestHandler = function (req, res, next) {
		return innerRouter(req, res, next);
	};

	// Mesclamos o innerRouter (que já é uma função) com os métodos
	// Usamos o 'as any' seguido do 'as CustomRouter' para convencer o TS
	return Object.assign(routerHandler, customMethods) as unknown as IRouter;
};
