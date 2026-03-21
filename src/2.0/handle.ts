import express from "express";
import type { Request, Response, RequestHandler, JoinRequest, JoinResponse, NextFunction, IHandleDoc } from "./type";
import type swaggerJSDoc from "swagger-jsdoc";
import { MiddlewareFCDoc } from "../1.0";
import { joinObject, parseStack, rootStack } from "./utils";
import nodePath from "path";

export interface IHandler<Rq extends Request = Request, Rs extends Response = Response> {
	(req: Rq, res: Rs, next: NextFunction): unknown;

	handle<Req extends Request = Request, Res extends Response = Response>(
		fn: RequestHandler<Req & Rq, Res & Rs> | IHandler<Req & Rq, Res & Rs>,
	): IHandler<JoinRequest<Rq, Req>, JoinResponse<Rs, Res>>;

	doc(operation: MiddlewareFCDoc | swaggerJSDoc.Operation, components?: swaggerJSDoc.Components): IHandler<Rq, Rs>;
}

export const middleware = <Rq extends Request = Request, Rs extends Response = Response>(fn: RequestHandler<Rq, Rs>) => {
	const router = express.Router({ mergeParams: true });

	const props = {
		__chain_docs__: [] as IHandleDoc[],
		handle<Req extends Request = Request, Res extends Response = Response>(fn: RequestHandler<Req & Rq, Res & Rs> | IHandler<Req & Rq, Res & Rs>) {
			router.use(fn as any);
			if ("__chain_docs__" in fn) {
				const docs = (fn as any).__chain_docs__;

				this.__chain_docs__ = [...this.__chain_docs__, ...docs];
			}
			return this as unknown as IHandler<JoinRequest<Rq, Req>, JoinResponse<Rs, Res>>;
		},
		doc(operation: MiddlewareFCDoc | swaggerJSDoc.Operation, components: swaggerJSDoc.Components = {}) {
			const { components: comp = {}, ...op } = operation;

			const stack = parseStack().filter(({ dir }) => !nodePath.resolve(dir).startsWith(nodePath.resolve(rootStack[0].dir)))[0];

			this.__chain_docs__.push({
				stackFrame: stack,
				operation: op,
				components: joinObject(comp, components),
			});
			return this as unknown as IHandler<Rq, Rs>;
		},
	};

	const rootHandler = Object.setPrototypeOf(function (req: Rq, res: Rs, next: NextFunction) {
		return router(req, res, next);
	}, props) as unknown as IHandler<Rq, Rs>;

	return rootHandler.handle<Rq, Rs>(fn);
};

export const handler = <Req extends Request = Request, Res extends Response = Response>(fn: RequestHandler<Req, Res>) => {
	return middleware<Req, Res>(fn);
};
