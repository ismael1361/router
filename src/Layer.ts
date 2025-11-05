import { HandlerFC, ILayer, IRoute, MiddlewareFC, MiddlewareFCDoc, NextFunction, RouterMethods, Request, Response } from "./type";
import { getDocHandles, joinDocs, joinPath } from "./utils";
import { EventEmitter } from "@ismael1361/utils";

/**
 * @internal
 * Representa uma camada interna do roteador, funcionando como uma coleção estruturada
 * de definições de rotas e middlewares.
 *
 * Esta classe é o núcleo do sistema de roteamento, permitindo a construção de uma árvore
 * de rotas aninhadas, onde middlewares de camadas superiores são aplicados às camadas inferiores.
 * Ela não deve ser usada diretamente pelo consumidor da biblioteca.
 */
export class Layer extends Array<ILayer> {
	private __event__: EventEmitter<{
		add: [route: IRoute];
	}> = new EventEmitter();

	/** @internal O índice da última camada adicionada. */
	public index: number = -1;

	/**
	 * @internal
	 * @param {string} [path=""] O prefixo de caminho para esta camada.
	 * @param {MiddlewareFCDoc} [doc={}] A documentação base para esta camada.
	 */
	constructor(public path: string = "", public doc: MiddlewareFCDoc = {}) {
		super();
	}

	/**
	 * Adiciona um ouvinte para eventos internos da camada.
	 * @param {"add"} event O nome do evento. Atualmente, apenas 'add' é suportado.
	 * @param {(route: IRoute) => void} listener A função a ser chamada quando o evento é emitido.
	 */
	addListener(event: "add", listener: (route: IRoute) => void) {
		return this.__event__.on(event, listener);
	}

	/**
	 * Remove um ouvinte de eventos.
	 * @param {"add"} event O nome do evento.
	 * @param {(route: IRoute) => void} listener A função ouvinte a ser removida.
	 */
	removeListener(event: "add", listener: (route: IRoute) => void) {
		return this.__event__.off(event, listener);
	}

	/**
	 * @internal
	 * Adiciona uma nova definição (camada) à pilha. Este é o método base usado por `get`, `post`, `middleware`, etc.
	 * Retorna um objeto semelhante a `this` com um getter/setter para a documentação da camada recém-adicionada.
	 */
	pushPath(type: "layer" | "middleware", method: RouterMethods, path: string, handle: Array<HandlerFC | MiddlewareFC> | Layer, doc: MiddlewareFCDoc = {}): this {
		const index = this.length;

		this.push({
			path,
			method,
			type,
			handle: handle instanceof Layer ? undefined : handle,
			doc: joinDocs(this.doc, ...(handle instanceof Layer ? [handle.doc] : getDocHandles(...handle)), doc),
			route: handle instanceof Layer ? handle : undefined,
		} as any);

		const route = this.routes.find((r) => r.index === index);

		if (route) this.__event__.emit("add", route);

		return {
			...this,
			index,
			get doc(): MiddlewareFCDoc {
				return this[index]?.doc || {};
			},
			set doc(doc: MiddlewareFCDoc | undefined) {
				this[index].doc = doc;
			},
		};
	}

	/**
	 * Cria uma nova sub-camada (sub-roteador) aninhada dentro da camada atual.
	 * Permite agrupar rotas sob um prefixo de caminho comum.
	 *
	 * @returns {Layer} A nova instância de `Layer` que representa o sub-roteador.
	 */
	route(path: string, route: Layer, doc?: MiddlewareFCDoc): Layer;
	route(path: string, doc?: MiddlewareFCDoc): Layer;
	route(route: Layer, doc?: MiddlewareFCDoc): Layer;
	route(doc?: MiddlewareFCDoc): Layer;
	route(...args: any[]) {
		const path: string = typeof args[0] === "string" ? args[0] : "";
		const doc: MiddlewareFCDoc = args[1] instanceof Layer ? args[2] : args[0] instanceof Layer || typeof args[0] === "string" ? args[1] : args[0];
		const root = new Layer(joinPath(this.path, path), doc);

		if (args[0] instanceof Layer || args[1] instanceof Layer) {
			const route: Layer = args[0] instanceof Layer ? args[0] : args[1];

			this.push({ path: "", method: "use", type: "route", route: root });

			root.push({ path: "", method: "use", type: "route", route });

			return route;
		} else {
			this.push({ path: path, method: "use", type: "route", route: root });
		}

		return root;
	}

	/**
	 * @internal
	 * Fábrica estática para criar uma nova instância de `Layer`.
	 */
	static route(path?: string, doc?: MiddlewareFCDoc) {
		return new Layer(path, doc);
	}

	/**
	 * Anexa uma instância de `Layer` (um roteador) existente a esta camada.
	 * É um método de conveniência para compor roteadores.
	 *
	 * @returns {this} A própria instância da camada para encadeamento.
	 */
	by(route: Layer, doc?: MiddlewareFCDoc): this;
	/** @internal */
	by(path: string, route: Layer, doc?: MiddlewareFCDoc): this;
	by(path: string | Layer, route?: Layer | MiddlewareFCDoc, doc?: MiddlewareFCDoc) {
		const _path: string = typeof path === "string" ? path : path.path;
		const _route: Layer = typeof path === "string" ? (route as Layer) : (path as Layer);
		const _doc: MiddlewareFCDoc | undefined = typeof path === "string" ? doc : route;
		this.route(_path, _route, _doc);
		return this;
	}

	/**
	 * @internal
	 * Retorna uma representação da pilha de camadas para fins de depuração.
	 */
	get stack(): ILayer[] {
		return Array.from(this).map(({ route, ...props }: any): ILayer => {
			return {
				...props,
				get route() {
					return route?.stack;
				},
			};
		});
	}

	async executeMiddlewares(request: Request, response: Response, next: NextFunction) {
		const middlewares: (HandlerFC<any, any> | MiddlewareFC<any, any>)[] = [];

		this.filter(({ type }) => {
			return type === "middleware";
		}).forEach(({ handle }) => {
			middlewares.push(...(handle || []));
		});

		let resolve: any = undefined;

		for (let i = 0; i < middlewares.length; i++) {
			if (response.headersSent) {
				break;
			}

			const middleware = middlewares[i];
			resolve = await Promise.race([middleware(request, response, i >= middlewares.length - 1 ? next : () => {})]);
		}

		return resolve;
	}

	/**
	 * Processa e achata a árvore de camadas em uma lista linear de rotas finais (`IRoute`).
	 * Este getter é fundamental, pois resolve os middlewares aninhados, aplica-os às rotas filhas
	 * e consolida os caminhos e a documentação.
	 */
	get routes(): IRoute[] {
		const routes: IRoute[] = [];
		const middlewares: (HandlerFC<any, any> | MiddlewareFC<any, any>)[] = [];
		const docs: MiddlewareFCDoc[] = [];

		let index = -1;

		for (const layer of this) {
			index++;

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
							index,
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
						index,
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

	/**
	 * @internal
	 * Adiciona um middleware a esta camada.
	 */
	middleware(handle: Array<MiddlewareFC>, doc: MiddlewareFCDoc = {}) {
		return this.pushPath("middleware", "use", this.path, handle, joinDocs(this.doc, doc));
	}

	/**
	 * @internal
	 * Adiciona uma rota do tipo GET.
	 */
	get(path: string, handle: Array<HandlerFC | MiddlewareFC>, doc: MiddlewareFCDoc = {}) {
		return this.pushPath("layer", "get", joinPath(this.path, path), handle, joinDocs(this.doc, doc));
	}

	/**
	 * @internal
	 * Adiciona uma rota do tipo POST.
	 */
	post(path: string, handle: Array<HandlerFC | MiddlewareFC>, doc: MiddlewareFCDoc = {}) {
		return this.pushPath("layer", "post", joinPath(this.path, path), handle, joinDocs(this.doc, doc));
	}

	/**
	 * @internal
	 * Adiciona uma rota do tipo PUT.
	 */
	put(path: string, handle: Array<HandlerFC | MiddlewareFC>, doc: MiddlewareFCDoc = {}) {
		return this.pushPath("layer", "put", joinPath(this.path, path), handle, joinDocs(this.doc, doc));
	}

	/**
	 * @internal
	 * Adiciona uma rota do tipo DELETE.
	 */
	delete(path: string, handle: Array<HandlerFC | MiddlewareFC>, doc: MiddlewareFCDoc = {}) {
		return this.pushPath("layer", "delete", joinPath(this.path, path), handle, joinDocs(this.doc, doc));
	}

	/**
	 * @internal
	 * Adiciona uma rota do tipo PATCH.
	 */
	patch(path: string, handle: Array<HandlerFC | MiddlewareFC>, doc: MiddlewareFCDoc = {}) {
		return this.pushPath("layer", "patch", joinPath(this.path, path), handle, joinDocs(this.doc, doc));
	}

	/**
	 * @internal
	 * Adiciona uma rota do tipo OPTIONS.
	 */
	options(path: string, handle: Array<HandlerFC | MiddlewareFC>, doc: MiddlewareFCDoc = {}) {
		return this.pushPath("layer", "options", joinPath(this.path, path), handle, joinDocs(this.doc, doc));
	}

	/**
	 * @internal
	 * Adiciona uma rota do tipo HEAD.
	 */
	head(path: string, handle: Array<HandlerFC | MiddlewareFC>, doc: MiddlewareFCDoc = {}) {
		return this.pushPath("layer", "head", joinPath(this.path, path), handle, joinDocs(this.doc, doc));
	}

	/**
	 * @internal
	 * Adiciona uma rota que corresponde a todos os métodos HTTP.
	 */
	all(path: string, handle: Array<HandlerFC | MiddlewareFC>, doc: MiddlewareFCDoc = {}) {
		return this.pushPath("layer", "all", joinPath(this.path, path), handle, joinDocs(this.doc, doc));
	}

	/**
	 * @internal
	 * Adiciona um middleware a um caminho específico.
	 */
	use(path: string, handle: Array<HandlerFC | MiddlewareFC>, doc: MiddlewareFCDoc = {}) {
		return this.pushPath("layer", "use", joinPath(this.path, path), handle, joinDocs(this.doc, doc));
	}
}
