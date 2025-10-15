import { HandlerFC, ILayer, IRoute, MiddlewareFC, MiddlewareFCDoc, RouterMethods } from "./type";
import { joinObject } from "./utils";

const joinPath = (...paths: string[]) => {
	return ["", ...paths.map((p) => p.replace(/(^\/+)|(\/+$)/gi, "")).filter((p) => p.trim() !== "")].join("/");
};

const getDocHandles = (...handles: (HandlerFC<any, any> | MiddlewareFC<any, any>)[]) => {
	return (handles.map((handle) => handle.doc).filter((doc) => doc !== undefined) as MiddlewareFCDoc[]).filter((d) => Object.keys(d).length > 0);
};

const joinDocs = (...docs: MiddlewareFCDoc[]) => {
	return docs
		.filter((d) => Object.keys(d).length > 0)
		.reduce((previous, current) => {
			return joinObject(previous, current);
		}, {} as MiddlewareFCDoc);
};

export class Layer extends Array<ILayer> {
	constructor(readonly path: string = "", readonly doc: MiddlewareFCDoc = {}) {
		super();
	}

	pushPath(type: "layer" | "middleware", method: RouterMethods, path: string, handle: Array<HandlerFC | MiddlewareFC> | Layer, doc?: MiddlewareFCDoc) {
		this.push({ path, method, type, handle: handle instanceof Layer ? undefined : handle, doc, route: handle instanceof Layer ? handle : undefined } as any);
		return this;
	}

	route(path: string, route: Layer, doc?: MiddlewareFCDoc): Layer;
	route(path: string, doc?: MiddlewareFCDoc): Layer;
	route(route: Layer, doc?: MiddlewareFCDoc): Layer;
	route(doc?: MiddlewareFCDoc): Layer;
	route(...args: any[]) {
		const path: string = typeof args[0] === "string" ? args[0] : "";
		const doc: MiddlewareFCDoc = args[1] instanceof Layer ? args[2] : args[0] instanceof Layer || typeof args[0] === "string" ? args[1] : args[0];
		const root = new Layer(joinPath(this.path, path), doc);

		this.push({ path: "", method: "use", type: "route", route: root });

		if (args[0] instanceof Layer || args[1] instanceof Layer) {
			const route: Layer = args[0] instanceof Layer ? args[0] : args[1];

			root.push({ path: "", method: "use", type: "route", route });

			return route;
		}

		return root;
	}

	static route(path?: string, doc?: MiddlewareFCDoc) {
		return new Layer(path, doc);
	}

	by(route: Layer, doc?: MiddlewareFCDoc): this;
	by(path: string, route: Layer, doc?: MiddlewareFCDoc): this;
	by(path: string | Layer, route?: Layer | MiddlewareFCDoc, doc?: MiddlewareFCDoc) {
		const _path: string = typeof path === "string" ? path : path.path;
		const _route: Layer = typeof path === "string" ? (route as Layer) : (path as Layer);
		const _doc: MiddlewareFCDoc | undefined = typeof path === "string" ? doc : route;
		this.route(_path, _route, _doc);
		return this;
	}

	get stack(): ILayer[] {
		return Array.from(this).map(({ route, ...props }: any): ILayer => {
			return {
				...props,
				route: route?.stack,
			};
		});
	}

	get routes(): IRoute[] {
		const routes: IRoute[] = [];
		const middlewares: (HandlerFC<any, any> | MiddlewareFC<any, any>)[] = [];
		const docs: MiddlewareFCDoc[] = [];

		for (const layer of this) {
			switch (layer.type) {
				case "middleware": {
					const handles = layer.handle || [];
					middlewares.push(...handles);
					docs.push(...getDocHandles(...handles), layer.doc || {});
					break;
				}
				case "route": {
					(layer.route as Layer).routes.forEach((route) => {
						const handles = [...middlewares, ...(layer.handle || []), ...route.handle];
						routes.push({
							path: joinPath(layer.path || "", route.path),
							method: route.method,
							handle: handles,
							doc: joinDocs(...docs, ...getDocHandles(...handles), layer.doc || {}, route.doc || {}),
						});
					});
					break;
				}
				default: {
					const handles = [...middlewares, ...(layer.handle || [])];
					routes.push({
						path: layer.path || "",
						method: layer.method,
						handle: handles,
						doc: joinDocs(...docs, ...getDocHandles(...handles), layer.doc || {}),
					});
					break;
				}
			}
		}

		return routes;
	}

	middleware(handle: Array<MiddlewareFC>, doc: MiddlewareFCDoc = {}) {
		return this.pushPath("middleware", "use", this.path, handle, joinDocs(this.doc, doc));
	}

	get(path: string, handle: Array<HandlerFC | MiddlewareFC>, doc: MiddlewareFCDoc = {}) {
		return this.pushPath("layer", "get", joinPath(this.path, path), handle, joinDocs(this.doc, doc));
	}

	post(path: string, handle: Array<HandlerFC | MiddlewareFC>, doc: MiddlewareFCDoc = {}) {
		return this.pushPath("layer", "post", joinPath(this.path, path), handle, joinDocs(this.doc, doc));
	}

	put(path: string, handle: Array<HandlerFC | MiddlewareFC>, doc: MiddlewareFCDoc = {}) {
		return this.pushPath("layer", "put", joinPath(this.path, path), handle, joinDocs(this.doc, doc));
	}

	delete(path: string, handle: Array<HandlerFC | MiddlewareFC>, doc: MiddlewareFCDoc = {}) {
		return this.pushPath("layer", "delete", joinPath(this.path, path), handle, joinDocs(this.doc, doc));
	}

	patch(path: string, handle: Array<HandlerFC | MiddlewareFC>, doc: MiddlewareFCDoc = {}) {
		return this.pushPath("layer", "patch", joinPath(this.path, path), handle, joinDocs(this.doc, doc));
	}

	options(path: string, handle: Array<HandlerFC | MiddlewareFC>, doc: MiddlewareFCDoc = {}) {
		return this.pushPath("layer", "options", joinPath(this.path, path), handle, joinDocs(this.doc, doc));
	}

	head(path: string, handle: Array<HandlerFC | MiddlewareFC>, doc: MiddlewareFCDoc = {}) {
		return this.pushPath("layer", "head", joinPath(this.path, path), handle, joinDocs(this.doc, doc));
	}

	all(path: string, handle: Array<HandlerFC | MiddlewareFC>, doc: MiddlewareFCDoc = {}) {
		return this.pushPath("layer", "all", joinPath(this.path, path), handle, joinDocs(this.doc, doc));
	}

	use(path: string, handle: Array<HandlerFC | MiddlewareFC>, doc: MiddlewareFCDoc = {}) {
		return this.pushPath("layer", "use", joinPath(this.path, path), handle, joinDocs(this.doc, doc));
	}
}
