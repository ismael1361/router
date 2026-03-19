import type { ParsedQs } from "qs";
import type * as core from "express-serve-static-core";
import express, { Request, Response, NextFunction } from "express";
import Layer from "router/lib/layer";
import { METHODS } from "http";

interface RequestHandler<P = core.ParamsDictionary, ResBody = any, ReqBody = any, ReqQuery = core.Query, Locals extends Record<string, any> = Record<string, any>> {
	(req: core.Request<P, ResBody, ReqBody, ReqQuery, Locals>, res: core.Response<ResBody, Locals>, next: core.NextFunction): unknown;
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

const defineRoute = <Path extends string, P = core.RouteParameters<Path>, ReqB = {}, ReqQ = ParsedQs, LObj extends Record<string, any> = Record<string, any>, ResB = {}>(
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
		handle<ReqBody = {}, ReqQuery = ParsedQs, LocalsObj extends Record<string, any> = Record<string, any>, ResBody = {}>(
			fn: RequestHandler<P, ResBody & ResB, ReqBody & ReqB, ReqQuery & ReqQ, LocalsObj & LObj>,
		) {
			const layer = Layer("/", {}, fn);
			layer.method = method;
			if ("methods" in route) {
				(route as any).methods[method] = true;
			}
			route.stack.push(layer);
			return this as ReturnType<typeof defineRoute<Path, P, ReqBody & ReqB, ReqQuery & ReqQ, LocalsObj & LObj, ResBody & ResB>>;
		},
	};
};

// Definimos a interface que é uma função E possui métodos
export interface IRouter {
	// Esta é a "Call Signature" (assinatura de chamada)
	(req: Request, res: Response, next: NextFunction): void;

	// Abaixo os métodos do objeto
	all<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, core.RouteParameters<Path>>>;
	get<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, core.RouteParameters<Path>>>;
	post<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, core.RouteParameters<Path>>>;
	put<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, core.RouteParameters<Path>>>;
	delete<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, core.RouteParameters<Path>>>;
	patch<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, core.RouteParameters<Path>>>;
	options<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, core.RouteParameters<Path>>>;
	head<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, core.RouteParameters<Path>>>;

	checkout<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, core.RouteParameters<Path>>>;
	copy<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, core.RouteParameters<Path>>>;
	lock<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, core.RouteParameters<Path>>>;
	merge<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, core.RouteParameters<Path>>>;
	mkactivity<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, core.RouteParameters<Path>>>;
	mkcol<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, core.RouteParameters<Path>>>;
	move<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, core.RouteParameters<Path>>>;
	"m-search"<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, core.RouteParameters<Path>>>;
	notify<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, core.RouteParameters<Path>>>;
	purge<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, core.RouteParameters<Path>>>;
	report<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, core.RouteParameters<Path>>>;
	search<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, core.RouteParameters<Path>>>;
	subscribe<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, core.RouteParameters<Path>>>;
	trace<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, core.RouteParameters<Path>>>;
	unlock<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, core.RouteParameters<Path>>>;
	unsubscribe<Path extends string>(path: Path): ReturnType<typeof defineRoute<Path, core.RouteParameters<Path>>>;
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
