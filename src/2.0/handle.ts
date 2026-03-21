import express from "express";
import type { Request, Response, RequestHandler, JoinRequest, JoinResponse, NextFunction, ITreeDoc, IHandler, IMiddleware } from "./type";
import type swaggerJSDoc from "swagger-jsdoc";
import { MiddlewareFCDoc } from "../1.0";
import { joinObject, parseStack, rootStack } from "./utils";
import nodePath from "path";

export const middleware = <Rq extends Request = Request, Rs extends Response = Response>(fn: RequestHandler<Rq, Rs>) => {
	const router = express.Router({ mergeParams: true });

	const props = {
		__chain_docs__: {
			parent: null,
			children: [],
		} as ITreeDoc,
		handle<Req extends Request = Request, Res extends Response = Response>(fn: RequestHandler<Req & Rq, Res & Rs> | IHandler<Req & Rq, Res & Rs> | IMiddleware<Req & Rq, Res & Rs>) {
			router.use(fn as any);
			if ("__chain_docs__" in fn) {
				this.__chain_docs__.children.push((fn as any).__chain_docs__);
			}
			return this as unknown as IMiddleware<JoinRequest<Rq, Req>, JoinResponse<Rs, Res>>;
		},
		doc(operation: MiddlewareFCDoc | swaggerJSDoc.Operation, components: swaggerJSDoc.Components = {}) {
			const { components: comp = {}, ...op } = operation;

			const stack = parseStack().filter(({ dir }) => !nodePath.resolve(dir).startsWith(nodePath.resolve(rootStack[0].dir)))[0];

			this.__chain_docs__.children.push({
				stackFrame: stack,
				operation: op,
				components: joinObject(comp, components),
			});
			return this as unknown as IMiddleware<Rq, Rs>;
		},
	};

	const rootHandler = Object.setPrototypeOf(function (req: Rq, res: Rs, next: NextFunction) {
		return router(req, res, next);
	}, props) as unknown as IMiddleware<Rq, Rs>;

	return rootHandler.handle<Rq, Rs>(fn);
};

export const handler = <Req extends Request = Request, Res extends Response = Response>(fn: RequestHandler<Req, Res>) => {
	return middleware<Req, Res>(fn) as unknown as IHandler<Req, Res>;
};
