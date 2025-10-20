import type { Request, Response, MiddlewareFCDoc, MiddlewareCallback, HandlerCallback } from "./type";
import { Router } from "./router";
import { Middleware } from "./middleware";
import { Handler } from "./handler";
import type swaggerJSDoc from "swagger-jsdoc";
import { joinObject } from "./utils";
// import "./Doc";

export type * from "./type";

export * as Middlewares from "./Middlewares";

export function create<Req extends Request = Request, Res extends Response = Response>(): Router<Req, Res> {
	return new Router<Req, Res>();
}

export function middleware<Req extends Request = Request, Res extends Response = Response>(callback: MiddlewareCallback<Req, Res>, doc?: MiddlewareFCDoc): Middleware<Req, Res> {
	return new Middleware(callback, undefined, doc);
}

export function handler<Req extends Request = Request, Res extends Response = Response>(callback: HandlerCallback<Req, Res>, doc?: MiddlewareFCDoc): Handler<Req, Res> {
	return new Handler(callback, undefined, doc);
}

export function route<Req extends Request = Request, Res extends Response = Response>(path: string): Router<Req, Res> {
	return new Router<Req, Res>(path);
}

export function doc(operation: MiddlewareFCDoc | swaggerJSDoc.Operation, components: swaggerJSDoc.Components = {}): MiddlewareFCDoc {
	const { components: comp = {}, ...op } = operation;
	return { ...op, components: joinObject(comp, components) };
}
