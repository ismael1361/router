import type { Request, Response, RouterProps, MiddlewareFC, RouterMethods, HandlerFC, MiddlewareFCDoc, HandlerCallback, MiddlewareCallback } from "./type";
import { createDynamicMiddleware, joinDocs, joinObject } from "./utils";
import { RequestMiddleware } from "./middleware";
import { Router } from "./router";
import type swaggerJSDoc from "swagger-jsdoc";
import { uuidv4 } from "@ismael1361/utils";

export class RequestHandler<Rq extends Request = Request, Rs extends Response = Response> extends RequestMiddleware<Rq, Rs> {
	readonly middlewares: MiddlewareFC<any, any>[] = [];

	constructor(public readonly router: Router, public readonly type: RouterMethods, public readonly path: string) {
		super(undefined, router);
	}

	middleware<Req extends Request = Request, Res extends Response = Response>(callback: MiddlewareCallback<Rq & Req, Rs & Res>): RequestHandler<Rq & Req, Rs & Res> {
		if (callback instanceof RequestMiddleware) {
			callback.router.layers
				.filter(({ type, handle }) => type === "middleware" && !!handle)
				.map(({ handle }) => handle!)
				.forEach((handle) => this.middlewares.push(...handle));
		} else {
			this.middlewares.push(createDynamicMiddleware(callback));
		}
		return this;
	}

	handler<Req extends Request = Request, Res extends Response = Response>(callback: HandlerCallback<Rq & Req, Rs & Res>): RouterProps {
		if (callback instanceof Handler) {
			callback.router.layers
				.filter(({ type, handle }) => type === "middleware" && !!handle)
				.map(({ handle }) => handle!)
				.forEach((handle) => this.middlewares.push(...handle));
		} else {
			this.middlewares.push(createDynamicMiddleware(callback));
		}

		const route = this.router.layers[this.type](this.path, this.middlewares);

		return {
			type: this.type,
			path: this.path,
			middlewares: this.middlewares,
			handler: this.middlewares.length > 0 ? this.middlewares[this.middlewares.length - 1] : undefined!,
			doc(operation: MiddlewareFCDoc | swaggerJSDoc.Operation, components: swaggerJSDoc.Components = {}) {
				const { components: comp = {}, ...op } = operation;

				route.doc = joinDocs(route.doc, { ...op, components: joinObject(comp, components) });
				return this;
			},
		};
	}
}

export class Handler<Rq extends Request = Request, Rs extends Response = Response> {
	constructor(callback: HandlerCallback<Rq, Rs> | undefined, readonly router: Router = new Router(), public doc?: MiddlewareFCDoc) {
		if (callback) {
			if (callback instanceof Handler) {
				this.router.by(callback.router);
			} else {
				callback.id = callback.id || uuidv4("-");
				callback.doc = joinDocs(callback?.doc || {}, doc || {});
				this.router.middleware(createDynamicMiddleware(callback));
			}
		}
	}
}
