import express from "express";
import { METHODS } from "http";
import type { ExtractRouteParameters, Request, Methods, RequestHandler, MiddlewareFCDoc, ITreeDoc } from "./type";
import { IHandler, handler } from "./handle";
import { parseStack, rootStack } from "./utils";
import nodePath from "path";

export interface IRoute<Path extends string, P extends string = ExtractRouteParameters<Path>> extends IHandler<Request<P>> {}

// Definimos a interface que é uma função E possui métodos
export interface IRouter extends RequestHandler {
	// Abaixo os métodos do objeto
	all<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path, doc?: MiddlewareFCDoc): IRoute<Path, P>;
	get<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path, doc?: MiddlewareFCDoc): IRoute<Path, P>;
	post<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path, doc?: MiddlewareFCDoc): IRoute<Path, P>;
	put<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path, doc?: MiddlewareFCDoc): IRoute<Path, P>;
	delete<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path, doc?: MiddlewareFCDoc): IRoute<Path, P>;
	patch<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path, doc?: MiddlewareFCDoc): IRoute<Path, P>;
	options<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path, doc?: MiddlewareFCDoc): IRoute<Path, P>;
	head<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path, doc?: MiddlewareFCDoc): IRoute<Path, P>;

	checkout<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path, doc?: MiddlewareFCDoc): IRoute<Path, P>;
	copy<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path, doc?: MiddlewareFCDoc): IRoute<Path, P>;
	lock<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path, doc?: MiddlewareFCDoc): IRoute<Path, P>;
	merge<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path, doc?: MiddlewareFCDoc): IRoute<Path, P>;
	mkactivity<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path, doc?: MiddlewareFCDoc): IRoute<Path, P>;
	mkcol<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path, doc?: MiddlewareFCDoc): IRoute<Path, P>;
	move<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path, doc?: MiddlewareFCDoc): IRoute<Path, P>;
	"m-search"<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path, doc?: MiddlewareFCDoc): IRoute<Path, P>;
	notify<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path, doc?: MiddlewareFCDoc): IRoute<Path, P>;
	purge<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path, doc?: MiddlewareFCDoc): IRoute<Path, P>;
	report<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path, doc?: MiddlewareFCDoc): IRoute<Path, P>;
	search<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path, doc?: MiddlewareFCDoc): IRoute<Path, P>;
	subscribe<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path, doc?: MiddlewareFCDoc): IRoute<Path, P>;
	trace<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path, doc?: MiddlewareFCDoc): IRoute<Path, P>;
	unlock<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path, doc?: MiddlewareFCDoc): IRoute<Path, P>;
	unsubscribe<Path extends string, P extends string = ExtractRouteParameters<Path>>(path: Path, doc?: MiddlewareFCDoc): IRoute<Path, P>;
}

export const router = (): IRouter => {
	const innerRouter = express.Router();

	const routesDocs: Array<() => ITreeDoc> = [];

	// Criamos o objeto com os seus métodos customizados
	const customMethods: Record<string, any> = {
		get __chain_docs__() {
			return routesDocs.map((getDoc) => getDoc());
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

				return Object.assign(rootHandler, props) as unknown as IRoute<Path, P>;
			};
		});

	const routerHandler: RequestHandler = function (req, res, next) {
		return innerRouter(req, res, next);
	};

	// Mesclamos o innerRouter (que já é uma função) com os métodos
	// Usamos o 'as any' seguido do 'as CustomRouter' para convencer o TS
	return Object.setPrototypeOf(routerHandler, customMethods) as unknown as IRouter;
};
