import express from "express";
import { METHODS } from "http";
import type { ExtractRouteParameters, IRouter, Methods, RequestHandler, MiddlewareFCDoc, ITreeDoc, IRouterMatcher } from "./type";
import { handler } from "./handle";
import { parseStack, rootStack } from "./utils";
import nodePath from "path";

export const router = (): IRouter => {
	const innerRouter = express.Router();

	const routesDocs: Array<() => ITreeDoc> = [];

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

			const stack = parseStack().filter(({ dir }) => !nodePath.resolve(dir).startsWith(nodePath.resolve(rootStack[0].dir)))[0];

			routesDocs.push((): ITreeDoc => {
				const { components = {}, ...operation } = doc || {};

				return {
					path,
					parent: {
						stackFrame: stack,
						operation,
						components,
					},
					children: (route as any).__chain_docs__,
				};
			});

			return route;
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
						children: (rootHandler as any).__chain_docs__ || [],
					};
				});

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
