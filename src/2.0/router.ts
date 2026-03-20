import express, { NextFunction } from "express";
import { METHODS } from "http";
import type { ExtractRouteParameters, Request, Methods, RequestHandler } from "./type";
import { defineRoute } from "./handle";

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
