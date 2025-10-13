import { HandlerFC, ILayer, MiddlewareFC, MiddlewareFCDoc, RouterMethods } from "./type";

export class Layer extends Set<ILayer<Layer>> {
	pushPath(method: RouterMethods, path: string, handle: Array<HandlerFC | MiddlewareFC> | Layer, doc?: MiddlewareFCDoc) {
		this.add({ path, method, handle: handle instanceof Layer ? undefined : handle, doc, route: handle instanceof Layer ? handle : undefined });
		return this;
	}

	route(path?: string, handle?: Array<HandlerFC | MiddlewareFC> | Layer, doc?: MiddlewareFCDoc) {
		const route = handle instanceof Layer ? handle : new Layer();
		this.add({ path, method: "use", handle: handle instanceof Layer ? undefined : handle, doc, route });
		return route;
	}

	get stack() {
		return Array.from(this);
	}
}
