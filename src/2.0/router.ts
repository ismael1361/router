import type { ParsedQs } from "qs";
import type * as core from "express-serve-static-core";
import express, { Response, NextFunction } from "express";
import Layer from "router/lib/layer";
import { METHODS } from "http";

export type ExtractRouteParameters<Path extends string> = Extract<keyof core.RouteParameters<Path>, string>;

export type ParamsDictionary<P extends string = string> = {
	[key in P]: string;
};

type Request<P extends string = string, ReqBody = any, ReqQuery = core.Query, ResBody = any, Locals extends Record<string, any> = Record<string, any>, extraRequest = {}> = core.Request<
	ParamsDictionary<P>,
	ResBody,
	ReqBody,
	ReqQuery,
	Locals
> &
	extraRequest;

interface RequestHandler<P extends string = string, ResBody = any, ReqBody = any, ReqQuery = core.Query, Locals extends Record<string, any> = Record<string, any>, extraRequest = {}> {
	(req: Request<P, ReqBody, ReqQuery, ResBody, Locals, extraRequest>, res: core.Response<ResBody, Locals>, next: core.NextFunction): unknown;
}

export type { RequestHandler, Request, Response, NextFunction };

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

const defineRoute = <Path extends string, P extends string = ExtractRouteParameters<Path>, ReqB = {}, ReqQ = ParsedQs, LObj extends Record<string, any> = Record<string, any>, ResB = {}, extraR = {}>(
	router: express.Router,
	method: Methods,
	path: Path,
) => {
	const innerRouter = router.route(path);

	const route = innerRouter[method].apply(innerRouter, [
		(req: any, res: any, next: any) => {
			next();
		},
	]); // Initialize the method on the route to ensure the layer is created

	route.stack = []; // Clear the default handler added by Express

	return {
		handle<ReqBody = {}, ReqQuery = ParsedQs, LocalsObj extends Record<string, any> = Record<string, any>, Params extends string = P, ResBody = {}, extraRequest = {}>(
			fn: RequestHandler<Params & P, ResBody & ResB, ReqBody & ReqB, ReqQuery & ReqQ, LocalsObj & LObj, extraRequest & extraR>,
		) {
			const layer = Layer("/", {}, fn);
			layer.method = method;
			if ("methods" in route) {
				(route as any).methods[method] = true;
			}
			route.stack.push(layer);
			return this as ReturnType<typeof defineRoute<Path, Params & P, ReqBody & ReqB, ReqQuery & ReqQ, LocalsObj & LObj, ResBody & ResB, extraRequest & extraR>>;
		},
	};
};

// Definimos a interface que é uma função E possui métodos
export interface IRouter {
	// Esta é a "Call Signature" (assinatura de chamada)
	(req: Request, res: Response, next: NextFunction): void;

	// Abaixo os métodos do objeto
	all<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, ExtractRouteParameters<Path>>>;
	get<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, ExtractRouteParameters<Path>>>;
	post<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, ExtractRouteParameters<Path>>>;
	put<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, ExtractRouteParameters<Path>>>;
	delete<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, ExtractRouteParameters<Path>>>;
	patch<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, ExtractRouteParameters<Path>>>;
	options<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, ExtractRouteParameters<Path>>>;
	head<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, ExtractRouteParameters<Path>>>;

	checkout<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, ExtractRouteParameters<Path>>>;
	copy<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, ExtractRouteParameters<Path>>>;
	lock<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, ExtractRouteParameters<Path>>>;
	merge<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, ExtractRouteParameters<Path>>>;
	mkactivity<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, ExtractRouteParameters<Path>>>;
	mkcol<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, ExtractRouteParameters<Path>>>;
	move<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, ExtractRouteParameters<Path>>>;
	"m-search"<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, ExtractRouteParameters<Path>>>;
	notify<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, ExtractRouteParameters<Path>>>;
	purge<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, ExtractRouteParameters<Path>>>;
	report<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, ExtractRouteParameters<Path>>>;
	search<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, ExtractRouteParameters<Path>>>;
	subscribe<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, ExtractRouteParameters<Path>>>;
	trace<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, ExtractRouteParameters<Path>>>;
	unlock<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, ExtractRouteParameters<Path>>>;
	unsubscribe<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, ExtractRouteParameters<Path>>>;
}

export const router = (): IRouter => {
	const innerRouter = express.Router();

	// Criamos o objeto com os seus métodos customizados
	const customMethods = {} as Record<Methods, any>;

	METHODS.concat("all").forEach((method) => {
		(customMethods as any)[method] = (path: string) => defineRoute(innerRouter, method as Methods, path);
	});

	const routerHandler: RequestHandler = (req, res, next) => {
		innerRouter(req, res, next);
	};

	// Mesclamos o innerRouter (que já é uma função) com os métodos
	// Usamos o 'as any' seguido do 'as CustomRouter' para convencer o TS
	return Object.assign(routerHandler, customMethods) as unknown as IRouter;
};
