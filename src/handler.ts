import type { Request, Response, RouterProps, MiddlewareFC, RouterMethods, HandlerFC, MiddlewareFCDoc, HandlerCallback, MiddlewareCallback } from "./type";
import { createDynamicMiddleware, joinDocs, joinObject } from "./utils";
import { RequestMiddleware } from "./middleware";
import { Router } from "./router";
import type swaggerJSDoc from "swagger-jsdoc";
import { uuidv4 } from "@ismael1361/utils";

/**
 * Representa um construtor de rotas encadeável.
 *
 * Esta classe não deve ser instanciada diretamente. Em vez disso, uma instância é retornada
 * quando você chama um método de rota como `.get()`, `.post()`, etc., em uma instância de `Router`.
 *
 * Ela permite encadear middlewares específicos para a rota e, finalmente, definir o manipulador
 * da rota e sua documentação.
 *
 * @example
 * const router = create();
 *
 * // A chamada a `router.post()` retorna uma instância de RequestHandler.
 * router.post('/users')
 *   // .middleware() aplica um middleware apenas a esta rota.
 *   .middleware(validationMiddleware)
 *   // .handler() define o controlador final da rota.
 *   .handler((req, res) => {
 *     res.status(201).json({ id: 1, ...req.body });
 *   })
 *   // .doc() anexa a documentação OpenAPI ao endpoint finalizado.
 *   .doc({
 *     summary: 'Cria um novo usuário',
 *     tags: ['Users'],
 *     body: { description: 'Dados do usuário' }
 *   });
 */
export class RequestHandler<Rq extends Request = Request, Rs extends Response = Response> extends RequestMiddleware<Rq, Rs> {
	readonly middlewares: MiddlewareFC<any, any>[] = [];

	/** @internal */
	constructor(public readonly router: Router, public readonly type: RouterMethods, public readonly path: string, public doc?: MiddlewareFCDoc) {
		super(undefined, router);
	}

	/**
	 * Anexa um middleware que será executado especificamente para esta rota.
	 * Múltiplos middlewares podem ser encadeados.
	 *
	 * @template Req - Tipo de Request estendido pelo middleware.
	 * @template Res - Tipo de Response estendido pelo middleware.
	 * @param {MiddlewareCallback<Rq & Req, Rs & Res>} callback - A função de middleware a ser aplicada.
	 * @param {MiddlewareFCDoc} [doc] - Documentação OpenAPI opcional para este middleware.
	 * @returns {RequestHandler<Rq & Req, Rs & Res>} A mesma instância de `RequestHandler` para permitir encadeamento.
	 */
	middleware<Req extends Request = Request, Res extends Response = Response>(callback: MiddlewareCallback<Rq & Req, Rs & Res>, doc?: MiddlewareFCDoc): RequestHandler<Rq & Req, Rs & Res> {
		if (callback instanceof RequestMiddleware) {
			callback.router.layers
				.filter(({ type, handle }) => type === "middleware" && !!handle)
				.map(({ handle }) => handle!)
				.forEach((handle) => this.middlewares.push(...handle));
		} else {
			this.middlewares.push(createDynamicMiddleware(callback));
		}
		if (doc) {
			this.doc = joinDocs(this.doc || {}, doc);
		}
		return this;
	}

	/**
	 * Define a função de manipulador (controller) final para a rota.
	 * Esta chamada finaliza a cadeia de middlewares e registra a rota no roteador.
	 *
	 * @template Req - Tipo de Request estendido pelo manipulador.
	 * @template Res - Tipo de Response estendido pelo manipulador.
	 * @param {HandlerCallback<Rq & Req, Rs & Res>} callback - A função que processará a requisição.
	 * @param {MiddlewareFCDoc} [doc] - Documentação OpenAPI opcional para este manipulador.
	 * @returns {RouterProps} Um objeto que contém as propriedades da rota e um método `.doc()` para adicionar a documentação final.
	 */
	handler<Req extends Request = Request, Res extends Response = Response>(callback: HandlerCallback<Rq & Req, Rs & Res>, doc?: MiddlewareFCDoc): RouterProps {
		if (callback instanceof Handler) {
			callback.router.layers
				.filter(({ type, handle }) => type === "middleware" && !!handle)
				.map(({ handle }) => handle!)
				.forEach((handle) => this.middlewares.push(...handle));
		} else {
			this.middlewares.push(createDynamicMiddleware(callback));
		}

		const route = this.router.layers[this.type](this.path, this.middlewares, joinDocs(this.doc || {}, doc || {}));

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

/**
 * Cria um componente de manipulador (handler) reutilizável.
 *
 * Esta classe encapsula uma função de manipulador, permitindo que ela seja combinada
 * com outros middlewares e reutilizada em diferentes rotas.
 *
 * @example
 * // handler.ts
 * export const getUserProfile = handler<{ user: { id: string } }>((req, res) => {
 *   res.json({ user: req.user });
 * });
 *
 * // routes.ts
 * router.get('/profile')
 *   .middleware(authMiddleware) // Adiciona `req.user`
 *   .handler(getUserProfile);   // Reutiliza o handler
 */
export class Handler<Rq extends Request = Request, Rs extends Response = Response> {
	/** @internal */
	constructor(callback: HandlerCallback<Rq, Rs> | undefined, readonly router: Router = new Router(), public doc?: MiddlewareFCDoc) {
		if (callback) {
			if (callback instanceof Handler) {
				callback.router.layers.forEach((l) => {
					this.router.layers.push(l);
				});
			} else {
				callback.id = callback.id || uuidv4("-");
				callback.doc = joinDocs(callback?.doc || {}, doc || {});
				this.router.middleware(createDynamicMiddleware(callback));
			}
		}
	}
}
