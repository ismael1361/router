import express from "express";
import Layer from "router/lib/layer";
import type { Methods, Request, Response, RequestHandler, JoinRequest, JoinResponse, NextFunction } from "./type";
import type swaggerJSDoc from "swagger-jsdoc";
import { MiddlewareFCDoc } from "../1.0";
import { joinDocs, joinObject } from "./utils";

export interface IHandler<Rq extends Request = Request, Rs extends Response = Response> {
	(req: Rq, res: Rs, next: NextFunction): unknown;

	router: express.Router;

	handle<Req extends Request = Request, Res extends Response = Response>(
		fn: RequestHandler<Req & Rq, Res & Rs> | IHandler<Req & Rq, Res & Rs>,
	): IHandler<JoinRequest<Rq, Req>, JoinResponse<Rs, Res>>;

	__doc__?: MiddlewareFCDoc;

	doc(operation: MiddlewareFCDoc | swaggerJSDoc.Operation, components?: swaggerJSDoc.Components): IHandler<Rq, Rs>;
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
		__doc__: undefined as MiddlewareFCDoc | undefined,
		get router() {
			return router;
		},
		handle<Req extends Request = Request, Res extends Response = Response>(fn: RequestHandler<Req & Rq, Res & Rs> | IHandler<Req & Rq, Res & Rs>) {
			const layer = Layer("/", {}, fn);
			layer.method = method;
			if ("methods" in route) {
				(route as any).methods[method] = true;
			}
			route.stack.push(layer);
			return this as unknown as IHandler<JoinRequest<Rq, Req>, JoinResponse<Rs, Res>>;
		},
		doc(operation: MiddlewareFCDoc | swaggerJSDoc.Operation, components: swaggerJSDoc.Components = {}) {
			const { components: comp = {}, ...op } = operation;

			this.__doc__ = joinDocs(this.__doc__ ?? {}, { ...op, components: joinObject(comp, components) });
			return this as unknown as IHandler<Rq, Rs>;
		},
	};

	const rootHandler: RequestHandler = function (req, res, next) {
		const chainHandler = express.Router();
		chainHandler.route(path).stack = innerRouter.stack;
		return chainHandler(req, res, next);
	};

	return Object.assign(rootHandler, props) as unknown as IHandler<Rq, Rs>;
};

export const defineMiddleware = <Req extends Request = Request, Res extends Response = Response>(fn: RequestHandler<Req, Res>): IHandler<Req, Res> => {
	return defineRoute().handle(fn) as unknown as IHandler<Req, Res>;
};

export const defineHandler = <Req extends Request = Request, Res extends Response = Response>(fn: RequestHandler<Req, Res>): IHandler<Req, Res> => {
	return defineRoute().handle(fn) as unknown as IHandler<Req, Res>;
};
