import express from "express";
import Layer from "router/lib/layer";
import type { Methods, Request, Response, RequestHandler, JoinRequest, JoinResponse, NextFunction } from "./type";

export interface IHandler<Rq extends Request = Request, Rs extends Response = Response> {
	(req: Rq, res: Rs, next: NextFunction): unknown;

	handle<Req extends Request = Request, Res extends Response = Response>(fn: RequestHandler<Req & Rq, Res & Rs>): IHandler<JoinRequest<Rq, Req>, JoinResponse<Rs, Res>>;
}

export const defineRoute = <Rq extends Request = Request, Rs extends Response = Response>(router: express.Router = express.Router(), method: Methods = "all", path: string = "/") => {
	const innerRouter = router.route(path);

	const route = innerRouter[method].apply(innerRouter, [
		(req: any, res: any, next: any) => {
			next();
		},
	]); // Initialize the method on the route to ensure the layer is created

	route.stack = []; // Clear the default handler added by Express

	const props = {
		get router() {
			return router;
		},
		handle<Req extends Request = Request, Res extends Response = Response>(fn: RequestHandler<Req & Rq, Res & Rs>) {
			const layer = Layer("/", {}, fn);
			layer.method = method;
			if ("methods" in route) {
				(route as any).methods[method] = true;
			}
			route.stack.push(layer);
			return this as unknown as IHandler<JoinRequest<Rq, Req>, JoinResponse<Rs, Res>>;
		},
	};

	const rootHandler: RequestHandler = function (req, res, next) {
		return router(req, res, next);
	};

	return Object.assign(rootHandler, props) as unknown as IHandler<Rq, Rs> & { router: express.Router };
};

export const defineMiddleware = <Req extends Request = Request, Res extends Response = Response>(fn: RequestHandler<Req, Res>): IHandler<Req, Res> => {
	return defineRoute().handle(fn) as unknown as IHandler<Req, Res>;
};

export const defineHandler = <Req extends Request = Request, Res extends Response = Response>(fn: RequestHandler<Req, Res>): IHandler<Req, Res> => {
	return defineRoute().handle(fn) as unknown as IHandler<Req, Res>;
};
