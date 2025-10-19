import type { Request, Response, MiddlewareFCDoc, MiddlewareCallback, HandlerCallback } from "./type";
import { Router } from "./router";
import { createDynamicMiddleware, joinDocs } from "./utils";
import { uuidv4 } from "@ismael1361/utils";
import { Handler } from "./handler";

export class RequestMiddleware<Rq extends Request = Request, Rs extends Response = Response> {
	constructor(callback: MiddlewareCallback<Rq, Rs> | undefined, readonly router: Router = new Router(), doc?: MiddlewareFCDoc) {
		if (callback) {
			if (callback instanceof RequestMiddleware) {
				this.router.by(callback.router);
			} else {
				callback.id = callback.id || uuidv4("-");
				callback.doc = joinDocs(callback?.doc || {}, doc || {});
				this.router.middleware(createDynamicMiddleware(callback));
			}
		}
	}

	middleware<Req extends Request = Request, Res extends Response = Response>(callback: MiddlewareCallback<Rq & Req, Rs & Res>, doc?: MiddlewareFCDoc): RequestMiddleware<Rq & Req, Rs & Res> {
		return new RequestMiddleware(callback, this.router, doc);
	}
}

export class Middleware<Rq extends Request = Request, Rs extends Response = Response> extends RequestMiddleware<Rq, Rs> {
	middleware<Req extends Request = Request, Res extends Response = Response>(callback: MiddlewareCallback<Rq & Req, Rs & Res>, doc?: MiddlewareFCDoc): Middleware<Rq & Req, Rs & Res> {
		return new Middleware(callback, this.router, doc);
	}

	handler<Req extends Request = Request, Res extends Response = Response>(callback: HandlerCallback<Rq & Req, Rs & Res>, doc?: MiddlewareFCDoc): Handler<Rq & Req, Rs & Res> {
		return new Handler(callback, this.router, doc);
	}
}

export class MiddlewareRouter<Rq extends Request = Request, Rs extends Response = Response> extends RequestMiddleware<Rq, Rs> {
	middleware<Req extends Request = Request, Res extends Response = Response>(callback: MiddlewareCallback<Rq & Req, Rs & Res>, doc?: MiddlewareFCDoc): MiddlewareRouter<Rq & Req, Rs & Res> {
		return new MiddlewareRouter(callback, this.router, doc);
	}

	route(path: string): Router<Rq, Rs> {
		return this.router.route(path);
	}

	by(router: Router): this {
		this.router.by(router);
		return this;
	}
}
