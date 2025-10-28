import swaggerJSDoc from "swagger-jsdoc";
import type { ExpressRequest, MiddlewareFC, NextFunction, Response, Request, HandlerFC, MiddlewareFCDoc } from "./type";
import { HandleError } from "./HandleError";
import fs from "fs";
import { deepEqual } from "@ismael1361/utils";
import { Layer } from "./Layer";
import path from "path";

export const isConstructedObject = (value: any): boolean => {
	return typeof value === "object" && value !== null && value.constructor !== Object;
};

export const joinObject = <T extends Object = any>(obj: T, ...objs: Array<Partial<T>>): T => {
	if (!Array.isArray(obj) && isConstructedObject(obj)) {
		return obj;
	}

	const result: any = {};

	[obj, ...objs]
		.filter((o) => !(!Array.isArray(0) && isConstructedObject(0)) && Object.keys(o).length > 0)
		.forEach((o) => {
			for (let key in o) {
				if (o[key] === undefined) {
					continue;
				}

				if (o[key] === null || (!Array.isArray(o[key]) && isConstructedObject(o[key]))) {
					result[key] = o[key] as any;
					continue;
				}

				if (Array.isArray(o[key])) {
					result[key] = [...((result[key] as any) ?? []), ...(o[key] as any)].filter((v, i, l) => {
						return i === l.findIndex((v2) => deepEqual(v2, v));
					}) as any;
					continue;
				} else if (typeof o[key] === "object") {
					result[key] = joinObject((result[key] ?? {}) as any, o[key] as any);
					continue;
				}

				result[key] = o[key] as any;
			}
		});

	return result;
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

export const joinPath = (...paths: string[]) => {
	return ["", ...paths.map((p) => p.replace(/(^\/+)|(\/+$)/gi, "")).filter((p) => p.trim() !== "")].join("/");
};

export const getDocHandles = (...handles: (HandlerFC<any, any> | MiddlewareFC<any, any>)[]) => {
	return (handles.map((handle) => handle.doc).filter((doc) => doc !== undefined) as MiddlewareFCDoc[]).filter((d) => Object.keys(d).length > 0);
};

export const joinDocs = (...docs: MiddlewareFCDoc[]) => {
	return docs
		.filter((d) => Object.keys(d).length > 0)
		.reduce((previous, current) => {
			return joinObject(previous, current);
		}, {} as MiddlewareFCDoc);
};

export const omit = <T extends object, K extends keyof T>(obj: T, ...keys: K[]): Omit<T, K> => {
	return Object.fromEntries(Object.entries(obj).filter(([key]) => !keys.includes(key as K))) as Omit<T, K>;
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
export const getRoutes = (router: Layer, basePath: string = "") => {
	try {
		let routes: Array<{
			path: string;
			methods: string[];
			type: "ROUTE" | "MIDDLEWARE";
			swagger?: Pick<swaggerJSDoc.OAS3Definition, "paths" | "components">;
		}> = router.routes.map((layer) => {
			const { path, method, doc } = layer;

			const p = joinPath(basePath, path);

			return {
				path: p,
				methods: [method],
				type: "ROUTE",
				swagger: {
					paths: { [p]: { [method]: doc?.operation || {} } },
					components: doc?.components || {},
				},
			};
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
						fs.appendFileSync(path.join(process.cwd(), "stacks.log"), `time=${new Date().toISOString()} level=${level} message=${JSON.stringify(stack)}\n`);
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

export const getCorsOptions = (allowedOrigins: string) => {
	return {
		origin: allowedOrigins === "*" ? true : allowedOrigins === "" ? false : allowedOrigins.split(/,\s*/),
		methods: "GET,PUT,POST,DELETE,OPTIONS",
		allowedHeaders: "Content-Type, Authorization, Content-Length, Accept, Origin, X-Requested-With",
	};
};

export const getCorsHeaders = (allowedOrigins: string, currentOrigin: string | undefined) => {
	const corsOptions = getCorsOptions(allowedOrigins);
	const origins =
		typeof corsOptions.origin === "boolean" ? (corsOptions.origin ? currentOrigin ?? "*" : "") : corsOptions.origin instanceof Array ? corsOptions.origin.join(",") : corsOptions.origin;
	return {
		"Access-Control-Allow-Origin": origins,
		"Access-Control-Allow-Methods": corsOptions.methods,
		"Access-Control-Allow-Headers": corsOptions.allowedHeaders,
		"Access-Control-Expose-Headers": "Content-Length, Content-Range",
	};
};
