import type { MiddlewareFCDoc, IStackFrame, SnippetTargets, IRouter, RequestHandler, Request, Response, NextFunction } from "./type";
import { deepEqual } from "@ismael1361/utils";
import path from "path";
import { HandleError } from "./HandleError";

export const parseStack = (stack: string = new Error().stack || "") => {
	return (
		stack
			?.split("\n")
			.slice(2)
			.map((line) => line.trim()) || []
	).map((line): IStackFrame => {
		const match = line.match(/at\s+(.*)\s+\((.*):(\d+):(\d+)\)/) || line.match(/at\s+(.*):(\d+):(\d+)/);
		if (match) {
			if (match.length === 5) {
				const [, functionName, filePath, lineNumber, columnNumber] = match;
				return { functionName, filePath, dir: path.dirname(filePath), lineNumber: parseInt(lineNumber), columnNumber: parseInt(columnNumber) };
			} else if (match.length === 4) {
				const [, filePath, lineNumber, columnNumber] = match;
				return { functionName: "<anonymous>", filePath, dir: path.dirname(filePath), lineNumber: parseInt(lineNumber), columnNumber: parseInt(columnNumber) };
			}
		}
		return { functionName: "<unknown>", filePath: line, dir: "<unknown>", lineNumber: 0, columnNumber: 0 };
	});
};

export const rootStack = parseStack();

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

export const isRouter = (router: any): router is IRouter => {
	return router && typeof router === "function" && "path" in router && "getSwagger" in router;
};

/**
 * Junta múltiplos segmentos de path em uma única string de rota,
 * garantindo que não existam barras duplas e tratando barras extras nas extremidades.
 */
export const joinPaths = (...paths: string[]): string => {
	return (
		paths
			.map((path) => path.trim()) // Remove espaços em branco
			.filter((path) => path.length > 0) // Ignora strings vazias
			.join("/") // Une tudo com uma barra
			.replace(/\/+/g, "/") // Substitui múltiplas barras (////) por uma única (/)
			.replace(/\/$/, "") || // Remove a barra final, se existir (opcional, dependendo do seu gosto)
		"/"
	); // Se o resultado for vazio, retorna a raiz
};

export const targetLabels: Record<SnippetTargets, string> = {
	c_libcurl: "C (libcurl)",
	csharp_restsharp: "C# (RestSharp)",
	csharp_httpclient: "C# (HttpClient)",
	go_native: "Go (Native)",
	java_okhttp: "Java (OkHttp)",
	java_unirest: "Java (Unirest)",
	javascript_jquery: "JavaScript (jQuery)",
	javascript_xhr: "JavaScript (XHR)",
	node_native: "Node.js (Native)",
	node_request: "Node.js (Request)",
	node_unirest: "Node.js (Unirest)",
	objc_nsurlsession: "Objective-C (NSURLSession)",
	ocaml_cohttp: "OCaml (Cohttp)",
	php_curl: "PHP (cURL)",
	php_http1: "PHP (HTTP v1)",
	php_http2: "PHP (HTTP v2)",
	python_python3: "Python 3 (http.client)",
	python_requests: "Python (Requests)",
	ruby_native: "Ruby (Native)",
	shell_curl: "Shell (cURL)",
	shell_httpie: "Shell (HTTPie)",
	shell_wget: "Shell (Wget)",
	swift_nsurlsession: "Swift (NSURLSession)",
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
export function tryHandler(handler: RequestHandler<any, any>) {
	return typeof handler === "function" && !("stack" in handler)
		? async (req: Request, res: Response, next: NextFunction) => {
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
						else if (level === "WARN") console.warn(error);
						else console.info(error);
						// fs.appendFileSync(path.join(process.cwd(), "stacks.log"), `time=${new Date().toISOString()} level=${level} message=${JSON.stringify(stack)}\n`);
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
export function createDynamicMiddleware<Req extends Request = Request, Res extends Response = Response>(middleware: RequestHandler<Req, Res>): RequestHandler<Req, Res> {
	const callback: RequestHandler<Req, Res> = (req: Request, res: Response, next: NextFunction) => {
		try {
			const xForwardedFor = ((v) => (Array.isArray(v) ? v.join(",") : v))(req.headers["x-forwarded-for"] || "").replace(/:\d+$/, "");
			req.clientIp = xForwardedFor || req.connection.remoteAddress;
		} catch {}

		if (!(req.__executedMiddlewares__ instanceof Set)) req.__executedMiddlewares__ = new Set();

		if (res.headersSent) {
			return;
		}

		const executedSet = req.__executedMiddlewares__;

		const id = typeof (middleware as any).id === "string" ? (middleware as any).id : middleware;

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

	(callback as any).id = (middleware as any).id || undefined;

	return Object.setPrototypeOf(callback.bind(middleware), Object.getPrototypeOf(middleware));
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
		typeof corsOptions.origin === "boolean" ? (corsOptions.origin ? (currentOrigin ?? "*") : "") : corsOptions.origin instanceof Array ? corsOptions.origin.join(",") : corsOptions.origin;
	return {
		"Access-Control-Allow-Origin": origins,
		"Access-Control-Allow-Methods": corsOptions.methods,
		"Access-Control-Allow-Headers": corsOptions.allowedHeaders,
		"Access-Control-Expose-Headers": "Content-Length, Content-Range",
	};
};

export function once(fn: Function) {
	const f: { (): any; called: boolean; value?: any } = function (this: any) {
		if (f.called) return f.value;
		f.called = true;
		return (f.value = fn.apply(this, arguments));
	};

	f.called = false;

	return f;
}
