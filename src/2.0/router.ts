import express from "express";
import { METHODS } from "http";
import type { ExtractRouteParameters, IRouter, Methods, RequestHandler, MiddlewareFCDoc, ITreeDoc, IRouterMatcher, PathParams } from "./type";
import { handler } from "./handler";
import { parseStack, rootStack } from "./utils";
import nodePath from "path";

export const router = (): IRouter => {
	const innerRouter = express.Router();

	const routesDocs: Array<() => ITreeDoc> = [];

	const defineRouteDoc = (method: Methods | undefined, path: string, doc?: MiddlewareFCDoc, children?: any) => {
		const stack = parseStack().filter(({ dir }) => !nodePath.resolve(dir).startsWith(nodePath.resolve(rootStack[0].dir)))[0];

		routesDocs.push((): ITreeDoc => {
			const { components = {}, ...operation } = doc || {};

			return {
				method,
				path,
				parent: {
					stackFrame: stack,
					operation,
					components,
				},
				children: (children ? children.__chain_docs__ : []) || [],
			};
		});
	};

	// Criamos o objeto com os seus métodos customizados
	const customMethods: Record<string, any> = {
		param(name: string, handler: any) {
			innerRouter.param(name, handler);
			return this as unknown as IRouter;
		},

		get __chain_docs__() {
			return routesDocs.map((getDoc) => getDoc());
		},

		route(path: string, doc?: MiddlewareFCDoc) {
			const route = router();
			innerRouter.use(path, route);
			defineRouteDoc(undefined, path, doc, route);
			return route;
		},

		use() {
			const args:
				| [prefix: string, doc?: MiddlewareFCDoc]
				| [path: PathParams, doc?: MiddlewareFCDoc]
				| [prefix: string, handlers: IRouter | RequestHandler, doc?: MiddlewareFCDoc]
				| [path: PathParams, handlers: IRouter | RequestHandler, doc?: MiddlewareFCDoc]
				| [handlers: IRouter | RequestHandler, doc?: MiddlewareFCDoc] = Array.from(arguments) as any;

			const path: PathParams | undefined = typeof args[0] === "string" || args[0] instanceof RegExp || Array.isArray(args[0]) ? args[0] : undefined;
			const handler: IRouter | RequestHandler | undefined = path ? (typeof args[1] === "function" ? args[1] : undefined) : typeof args[0] === "function" ? args[0] : undefined;
			const doc: MiddlewareFCDoc | undefined = typeof args[args.length - 1] === "object" && typeof args[args.length - 1] !== "function" ? (args[args.length - 1] as any) : undefined;

			const route = router();

			if (path) {
				if (handler) {
					innerRouter.use(path, handler);
				} else {
					innerRouter.use(path, route);
				}
			} else if (handler) {
				innerRouter.use(handler);
			}

			defineRouteDoc(undefined, "/", doc);

			return handler ? undefined : route;
		},
	};

	METHODS.concat("all")
		.map((m) => m.toLowerCase() as Methods)
		.forEach((method: Methods) => {
			(customMethods as any)[method] = function <Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path, doc?: MiddlewareFCDoc) {
				const rootHandler = handler((req: any, res: any, next: any) => {
					next();
				});

				innerRouter[method].apply(innerRouter, [path, rootHandler] as any);

				defineRouteDoc(method, path, doc, rootHandler);

				const props = {};

				return Object.assign(rootHandler, props) as unknown as IRouterMatcher;
			};
		});

	const routerHandler: RequestHandler = function (req, res, next) {
		return innerRouter(req, res, next);
	};

	// Mesclamos o innerRouter (que já é uma função) com os métodos
	// Usamos o 'as any' seguido do 'as CustomRouter' para convencer o TS
	return Object.setPrototypeOf(routerHandler, customMethods) as unknown as IRouter;
};
