import swaggerJSDoc from "swagger-jsdoc";
import type { ExpressRequest, MiddlewareFC, ExpressRouter, NextFunction, Response, Request } from "./type";
import { HandleError } from "./HandleError";
import fs from "fs";
import { deepEqual } from "@ismael1361/utils";

export const isConstructedObject = (value: any): boolean => {
	return typeof value === "object" && value !== null && value.constructor !== Object;
};

export const joinObject = <T extends Object = any>(obj: T, ...objs: Array<Partial<T>>): T => {
	if (!Array.isArray(obj) && isConstructedObject(obj)) {
		return obj;
	}

	objs.filter((o) => !(!Array.isArray(obj) && isConstructedObject(obj)) && Object.keys(o).length > 0).forEach((o) => {
		for (let key in o) {
			if (o[key] === undefined) {
				continue;
			}

			if (o[key] === null || (!Array.isArray(o[key]) && isConstructedObject(o[key]))) {
				obj[key] = o[key] as any;
				continue;
			}

			if (Array.isArray(o[key])) {
				obj[key] = [...((obj[key] as any) ?? []), ...(o[key] as any)].filter((v, i, l) => {
					return i === l.findIndex((v2) => deepEqual(v2, v));
				}) as any;
				continue;
			} else if (typeof o[key] === "object") {
				obj[key] = joinObject((obj[key] ?? {}) as any, o[key] as any);
				continue;
			}

			obj[key] = o[key] as any;
		}
	});

	return obj;
};

/**
 * Converte uma expressão regular que representa um caminho em uma string de caminho limpa e normalizada.
 * Remove delimitadores de regex, caracteres especiais de âncora e garante que o caminho comece e termine com uma barra.
 *
 * @param {RegExp} regexp A expressão regular a ser convertida.
 * @returns {string} O caminho limpo e normalizado.
 *
 * @example
 * // Exemplo de uso:
 * const regex = /^\/users\/(?<id>[^/]+)\/?$/i;
 * const path = regexpToPath(regex);
 * console.log(path); // Saída esperada: "/users/{id}/"
 */
export const regexpToPath = (regexp?: RegExp): string => {
	if (!regexp) {
		return "";
	}
	// Converte a expressão regular em uma string
	let path = regexp.toString();

	// Remove os delimitadores de regexp (/, /g, /i, etc.)
	path = path.slice(1, path.lastIndexOf("/"));

	// Remove padrões desnecessários como ^, $, (?=\/|$), etc.
	path = path
		.replace(/^\^/, "") // Remove o ^ no início
		.replace(/\$$/, "") // Remove o $ no final
		.replace(/\(\?\=\\\/\|\$\)$/g, "") // Remove (?=\/|$)
		.replace(/\\\//g, "/") // Substitui \/ por /
		.replace(/\\/g, ""); // Remove qualquer outra barra invertida

	if (path.endsWith("/?")) {
		path = path.slice(0, -2);
	}

	if (!path.startsWith("/")) {
		path = "/" + path;
	}

	if (!path.endsWith("/")) {
		path += "/";
	}

	return path;
};

/**
 * Normaliza uma string de caminho para um formato consistente, adequado para documentação Swagger/OpenAPI.
 * Esta função realiza duas tarefas principais:
 * 1. Consolida múltiplos slashes (`//`, `///`, etc.) em um único slash (`/`).
 * 2. Converte parâmetros de rota no estilo Express (ex: `/:id`) para o formato OpenAPI (ex: `/{id}`).
 *
 * @param {string} path O caminho da rota a ser normalizado.
 * @returns {string} O caminho normalizado.
 *
 * @example
 * const rawPath = "//users/:userId//posts";
 * const normalized = normalizePath(rawPath);
 * console.log(normalized); // Saída: "/users/{userId}/posts"
 */
export const normalizePath = (path: string) => {
	return path
		.replace(/(\/+)/gi, "/")
		.split("/")
		.map((v) => (/^:[\S]+/gi.test(v) ? `{${v.replace(":", "")}}` : v))
		.join("/");
};

/**
 * Percorre recursivamente um roteador Express para extrair uma lista de todas as rotas e middlewares.
 * A função identifica rotas, sub-roteadores e middlewares, normalizando seus caminhos e
 * extraindo métodos HTTP e documentação Swagger, se disponível no handler.
 *
 * @param {ExpressRouter} router A instância do roteador Express a ser inspecionada.
 * @param {string} [basePath=""] Um caminho base para prefixar todas as rotas encontradas, útil para roteadores aninhados.
 * @returns {Array<{path: string, methods: string[], type: 'ROUTE' | 'MIDDLEWARE', swagger?: object}>} Uma matriz de objetos representando cada rota ou middleware.
 *
 * @example
 * // Suponha a seguinte configuração de rotas:
 * const mainRouter = Express.Router();
 * const userRouter = Express.Router();
 *
 * const getUserHandler = (req, res) => res.send('User data');
 * // Anexa a documentação Swagger ao handler
 * (getUserHandler as any).swagger = (path: string) => ({
 *   paths: { [path]: { get: { summary: 'Get a specific user' } } }
 * });
 *
 * userRouter.get('/:id', getUserHandler);
 * mainRouter.use('/users', userRouter);
 *
 * const routesInfo = getRoutes(mainRouter);
 * console.log(routesInfo);
 * // Saída esperada (simplificada):
 * // [
 * //   { path: '/users/{id}/', methods: ['GET'], type: 'ROUTE', swagger: { ... } }
 * // ]
 */
export const getRoutes = (router: ExpressRouter, basePath: string = "") => {
	try {
		let routes: Array<{
			path: string;
			methods: string[];
			type: "ROUTE" | "MIDDLEWARE";
			swagger?: Pick<swaggerJSDoc.OAS3Definition, "paths" | "components">;
		}> = [];

		router.stack.forEach(function (layer) {
			if (layer.route) {
				const path = normalizePath(basePath + layer.route.path);
				const methods = Object.keys((layer.route as any).methods)
					.filter((method) => method !== "_all")
					.map((method) => method.toUpperCase());

				const { handle } = layer.route.stack.find(({ handle }) => typeof (handle as any).swagger === "function") ?? {};

				routes.push({ path, methods, type: "ROUTE", swagger: (handle as any)?.swagger(path) });
			} else if (layer.handle) {
				if (layer.name === "router") {
					const routerPath = normalizePath(basePath + (layer.path || regexpToPath(layer.regexp) || ""));
					const nestedRoutes = getRoutes(layer.handle as any, routerPath);
					routes.push(...nestedRoutes);
				} else {
					routes.push({
						path: normalizePath(basePath + (layer.path || regexpToPath(layer?.regexp) || "")),
						methods: ["ALL"], // Middlewares respondem a todos os métodos
						type: "MIDDLEWARE",
					});
				}
			}
		});

		return routes;
	} catch (e) {
		// console.error(e);
	}

	return [];
};

/**
 * Envolve um middleware Express com um manipulador de erros (try-catch) centralizado.
 * Se o handler lançar um erro, esta função o captura, formata uma resposta JSON padronizada
 * e registra o erro. Ele lida com handlers síncronos e assíncronos (Promises).
 *
 * @param {MiddlewareFC<any, any>} handler O middleware a ser envolvido.
 * @returns {MiddlewareFC<any, any>} Um novo middleware com tratamento de erro ou o handler original se for um roteador.
 *
 * @example
 * // Esta função é usada internamente por `createDynamicMiddleware`.
 * // Exemplo conceitual de como ela age:
 *
 * const myRiskyHandler: MiddlewareFC = (req, res, next) => {
 *   throw new HandleError("Algo deu errado!", 400);
 * };
 *
 * // Em vez de usar `myRiskyHandler` diretamente, o sistema usa `tryHandler(myRiskyHandler)`.
 * // Se `myRiskyHandler` for chamado, o erro será capturado e uma resposta como
 * // { "message": "Algo deu errado!", "name": "HandleError", "code": 400 }
 * // será enviada automaticamente.
 */
export function tryHandler(handler: MiddlewareFC<any, any>) {
	return typeof handler === "function" && !("stack" in handler)
		? async (req: ExpressRequest, res: Response, next: NextFunction) => {
				if (res.headersSent) {
					return;
				}

				try {
					await new Promise((resolve) => setTimeout(resolve, 0));
					const response: any = handler(req as any, res, next);
					if (response instanceof Promise) await response;
				} catch (error) {
					const code: number = error instanceof HandleError && typeof error.cause === "number" ? error.code : 400;
					const message = error instanceof HandleError || error instanceof Error ? error.message : "Bad ExpressRequest";
					const name = error instanceof HandleError || error instanceof Error ? error.name : "Error";
					const level = error instanceof HandleError && typeof error.level === "string" ? error.level : "ERROR";

					res.status(code).json({ message, name, code });

					if (["ERROR", "WARN", "INFO"].includes(level)) {
						const stack = (error as any).stack || error;
						if (level === "ERROR") console.error(error);
						if (level === "WARN") console.warn(error);
						fs.appendFileSync("stacks.log", `time=${new Date().toISOString()} level=${level} message=${JSON.stringify(stack)}\n`);
					}
				}
		  }
		: (handler as any);
}

/**
 * Cria um middleware dinâmico que adiciona funcionalidades extras a um middleware Express padrão.
 * Funcionalidades adicionadas:
 * 1.  **Tratamento de Erros:** Envolve o middleware com `tryHandler` para captura centralizada de erros.
 * 2.  **Execução Única:** Previne que o mesmo middleware seja executado mais de uma vez na mesma requisição,
 *     útil para middlewares aplicados em roteadores aninhados. Fornece `req.executeOnce()` para controle.
 * 3.  **IP do Cliente:** Adiciona `req.clientIp` com o endereço de IP do cliente.
 *
 * @template Req - O tipo de objeto de requisição (Request) que o middleware espera.
 * @template Res - O tipo de objeto de resposta (Response) que o middleware espera.
 * @param {MiddlewareFC<Req, Res>} middleware O middleware original a ser aprimorado.
 * @returns {MiddlewareFC<Req, Res>} O novo middleware aprimorado.
 *
 * @example
 * // Middleware de autenticação que só deve rodar uma vez.
 * const authMiddleware: MiddlewareFC<{ user: any }> = (req, res, next) => {
 *   // Garante que a lógica de autenticação não seja executada novamente.
 *   req.executeOnce();
 *   console.log('Verificando autenticação...');
 *   (req as any).user = { id: 123 };
 *   next();
 * };
 *
 * // Em um roteador:
 * router.use(authMiddleware); // Aplicado a todas as rotas
 * router.get("/profile", authMiddleware, (req, res) => {
 *   // Mesmo sendo declarado duas vezes, o console.log só aparecerá uma vez.
 *   res.send(`Perfil do usuário: ${(req as any).user.id}, IP: ${req.clientIp}`);
 * });
 */
export function createDynamicMiddleware<Req extends Request = Request, Res extends Response = Response>(middleware: MiddlewareFC<Req, Res>): MiddlewareFC<Req, Res> {
	middleware.doc = middleware?.doc || {};
	if ("name" in middleware && middleware.name === "router") {
		return middleware as any;
	}
	const callback: MiddlewareFC<Req, Res> = (req: any, res: Response, next: NextFunction) => {
		try {
			const xForwardedFor = (req.headers["x-forwarded-for"] || "").replace(/:\d+$/, "");
			req.clientIp = xForwardedFor || req.connection.remoteAddress;
		} catch {}

		if (!(req.__executedMiddlewares__ instanceof Set)) req.__executedMiddlewares__ = new Set();

		if (res.headersSent) {
			return;
		}

		const executedSet = req.__executedMiddlewares__;

		const id = typeof middleware.id === "string" ? middleware.id : middleware;

		if (!executedSet.has(id)) {
			req.executeOnce = (isOnce: boolean = true) => {
				if (isOnce) executedSet.add(id);
				else executedSet.delete(id);
			};

			tryHandler(middleware)(req, res, next);
		} else {
			next();
		}
	};
	callback.id = middleware.id || undefined;
	callback.doc = middleware.doc || {};
	return callback;
}
