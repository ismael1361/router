import express from "express";
import { router } from "./router";
import { IApplication, IStackLog } from "./type";
import fs from "fs";
import path from "path";
import { HandleError } from "./HandleError";
import { StacksController } from "./Middlewares";
import http from "http";
import { once } from "./utils";

/**
 * Cria uma instância de {@link IApplication}, que encapsula uma aplicação Express
 * com roteamento tipado, documentação OpenAPI/Swagger e sistema de logging por stacks.
 *
 * A aplicação retornada herda todos os métodos de {@link IRouter} (`.get()`, `.post()`,
 * `.route()`, `.use()`, `.defineSwagger()`, etc.) além de métodos próprios do Express
 * (`listen`, `enable`, `disable`, etc.) e funcionalidades de rastreamento de requisições.
 *
 * @returns Instância de {@link IApplication} pronta para definir rotas e iniciar o servidor.
 *
 * @example
 * // Aplicação básica com rota GET
 * import { create } from '@ismael1361/router';
 *
 * const app = create();
 *
 * app.get("/hello/:name")
 *   .handler((req, res) => {
 *     res.send(`Hello, ${req.params.name}!`);
 *   });
 *
 * app.listen(3000, () => {
 *   console.log("Server is running on http://localhost:3000");
 * });
 *
 * @example
 * // Aplicação completa com middlewares, sub-routers, Swagger e stacks
 * import { create, router, middleware, Middlewares, Request } from '@ismael1361/router';
 *
 * const app = create();
 *
 * // Middlewares globais
 * app.use(Middlewares.json());
 * app.use(Middlewares.cors({ allowOrigin: "*" }));
 *
 * // Middleware de autenticação tipado
 * interface AuthRequest extends Request {
 *   user: { id: string; roles: string[] };
 * }
 *
 * const authMiddleware = middleware((req: AuthRequest, res, next) => {
 *   req.user = { id: "123", roles: ["admin"] };
 *   next();
 * }).doc({
 *   security: [{ bearerAuth: [] }],
 *   components: {
 *     securitySchemes: {
 *       bearerAuth: { type: "http", scheme: "bearer" },
 *     },
 *   },
 * });
 *
 * // Sub-router versionado
 * const v1 = router();
 * v1.get("/users")
 *   .handler(authMiddleware)
 *   .handler((req, res) => res.json([{ id: req.user.id }]))
 *   .doc({ tags: ["Users"], summary: "Listar usuários" });
 *
 * app.route("/v1", v1);
 *
 * // Documentação Swagger
 * app.defineSwagger({
 *   openapi: "3.0.0",
 *   info: { title: "My API", version: "1.0.0" },
 * });
 *
 * // Sistema de stacks (logging)
 * app.defineStacks({ path: "/stacks", limit: 100 });
 *
 * app.listen(8080);
 */
export const create = () => {
	const app = express();

	const innerRouter = router();
	app.use(innerRouter as any);

	const innerApplication = function (req: express.Request, res: express.Response, next: express.NextFunction) {
		return app(req, res, next);
	} as unknown as IApplication;

	const servers: Set<http.Server> = new Set();
	const beforeListenHandlers: Array<(server: http.Server) => void | Promise<void>> = [];

	innerApplication.listen = function listen() {
		const innerServer = http.createServer(app);
		servers.add(innerServer);
		const args = Array.prototype.slice.call(arguments);
		if (typeof args[args.length - 1] === "function") {
			const done = (args[args.length - 1] = once(args[args.length - 1]));
			innerServer.once("error", done);
		}
		beforeListenHandlers.forEach((handler) => handler(innerServer));
		return innerServer.listen.apply(innerServer, args as any);
	};

	innerApplication.disable = app.disable.bind(app);
	innerApplication.enable = app.enable.bind(app);
	innerApplication.disabled = app.disabled.bind(app);
	innerApplication.enabled = app.enabled.bind(app);
	innerApplication.engine = app.engine.bind(app);
	innerApplication.param = app.param.bind(app);
	innerApplication.render = app.render.bind(app);

	let filePath = "./stacks.log";

	innerApplication.getStacks = () => {
		if (!fs.existsSync(path.resolve(filePath))) {
			return [];
		}

		const records = fs
			.readFileSync(path.resolve(filePath), "utf-8")
			.trim()
			.split(/\n(?=time=)/);
		const result: IStackLog[] = [];

		const pairRegex = /(\w+)=(?:"((?:\\[^]|[^"\\])*)"|(\S+))/g;

		for (const record of records) {
			if (!record.trim()) continue;

			const entry: IStackLog = {
				time: new Date(),
				level: "INFO",
				name: "",
				message: "",
				source: "",
				statusCode: 0,
				duration: 0,
				meta: "",
			};

			let match;
			pairRegex.lastIndex = 0; // reinicia a busca para cada registro

			while ((match = pairRegex.exec(record)) !== null) {
				const key = match[1];
				try {
					switch (key) {
						case "time":
							entry.time = new Date(match[2] || match[3]);
							continue;
						case "level":
							entry.level = (match[2] || match[3]) as any;
							continue;
						case "name":
							entry.name = match[2] || match[3] || "";
							continue;
						case "message":
							entry.message = match[2] || match[3] || "";
							continue;
						case "source":
							entry.source = match[2] || match[3] || "";
							continue;
						case "statusCode":
							entry.statusCode = Number(match[2] || match[3] || 0);
							continue;
						case "duration":
							entry.duration = Number(match[2] || match[3] || 0);
							continue;
						case "meta":
							try {
								entry.meta = match[2] || match[3] || "";
							} catch {
								entry.meta = "";
							}
							continue;
						default:
							(entry as any)[key] = (match[2] !== undefined ? match[2] : match[3]) ?? (entry as any)[key];
							continue;
					}
				} catch {}
			}

			result.push(entry);
		}

		return result;
	};

	const __registerStacks__ = {
		register(level: "ERROR" | "WARN" | "INFO" = "INFO", ...reasons: IStackLog[]) {},
		error(...reasons: IStackLog[]) {
			this.register?.("ERROR", ...reasons);
		},
		warn(...reasons: IStackLog[]) {
			this.register?.("WARN", ...reasons);
		},
		info(...reasons: IStackLog[]) {
			this.register?.("INFO", ...reasons);
		},
	};

	innerApplication.defineStacks = (options = {}) => {
		const { path: stacksPath = "/stacks", limit = 100, filePath: stacksFilePath = "./stacks.log", beforeStack } = options;

		let filePath = stacksFilePath;
		let timer: NodeJS.Timeout;

		__registerStacks__.register = (level = "INFO", ...reasons) => {
			const stack: string = (beforeStack?.(...reasons) || reasons)
				.map((reason) => {
					if (typeof reason === "string") {
						let stack: string = "";
						stack += `time=${new Date().toISOString()} `;
						stack += `level=${level} `;
						stack += `name="Log" `;
						stack += `message=${JSON.stringify(reason)} `;
						stack += `source="String" `;
						stack += `statusCode=0 duration=0 meta=${JSON.stringify(reason)}`;
						return stack;
					}

					if (reason instanceof Error) {
						let stack: string = "";
						stack += `time=${new Date().toISOString()} `;
						stack += `level=${"level" in reason ? reason.level : level} `;
						stack += `name=${JSON.stringify("name" in reason ? reason.name : "Error")} `;
						stack += `message=${JSON.stringify("message" in reason ? reason.message : reason)} `;
						stack += `source="Error" `;
						stack += `statusCode=${"code" in reason ? reason.code : 0} `;
						stack += `duration=${"duration" in reason ? reason.duration : 0} `;
						stack += `meta=${JSON.stringify("stack" in reason ? reason.stack : reason)}`;
						return stack;
					}

					let stack: string = "";

					for (const key in reason) {
						if (Object.prototype.hasOwnProperty.call(reason, key)) {
							const value: any = (reason as any)[key];
							stack += `${key}=`;
							if (typeof value === "number") {
								stack += value + " ";
							} else if (value instanceof Date) {
								stack += value.toISOString() + " ";
							} else {
								stack += JSON.stringify(value) + " ";
							}
						}
					}

					return stack.trim();
				})
				.join("\n");

			if (!fs.existsSync(path.resolve(filePath))) {
				fs.writeFileSync(path.resolve(filePath), "");
			}
			fs.appendFileSync(path.resolve(filePath), stack + "\n");
			clearTimeout(timer);
			timer = setTimeout(() => {
				const lines = fs.readFileSync(path.resolve(filePath), "utf-8").trim().split("\n");
				if (lines.length > limit) {
					const excess = lines.length - limit;
					const updatedLines = lines.slice(excess);
					fs.writeFileSync(path.resolve(filePath), updatedLines.join("\n") + "\n");
				}
			}, 1000 * 10);
		};

		process.on("unhandledRejection", __registerStacks__.error);
		process.on("uncaughtException", __registerStacks__.error);
		process.on("warning", __registerStacks__.warn);

		const processArgs = (level = "INFO", ...args: any[]): IStackLog[] => {
			return args.map((arg) => {
				if (arg instanceof HandleError) {
					return {
						time: arg.time,
						level: arg.level === "NONE" ? level : arg.level,
						name: arg.name,
						message: arg.message,
						source: arg.source,
						statusCode: arg.code,
						duration: arg.duration,
						meta: "stack" in arg ? arg.stack : (arg.meta ?? arg),
					};
				} else if (arg instanceof Error) {
					return {
						time: new Date(),
						level,
						name: arg.name,
						message: arg.message,
						source: "Error",
						statusCode: 500,
						duration: 0,
						meta: "stack" in arg ? arg.stack : arg,
					};
				} else if (typeof arg === "object") {
					return {
						time: "time" in arg ? arg.time : new Date(),
						level: "level" in arg ? arg.level : level,
						name: "name" in arg ? arg.name : "Log",
						message: "message" in arg ? arg.message : JSON.stringify(arg),
						source: "source" in arg ? arg.source : "Object",
						statusCode: "code" in arg ? arg.code : 0,
						duration: "duration" in arg ? arg.duration : 0,
						meta: "stack" in arg ? arg.stack : (arg?.meta ?? arg),
					};
				}

				return {
					time: new Date(),
					level,
					name: "Log",
					message: String(arg),
					source: String(arg),
					statusCode: 0,
					duration: 0,
					meta: arg,
				};
			});
		};

		const originalError = globalThis.console.error;
		globalThis.console.error = (...args: any[]) => {
			__registerStacks__.error(...processArgs("ERROR", ...args));
			originalError(...args);
		};

		const originalWarn = globalThis.console.warn;
		globalThis.console.warn = (...args: any[]) => {
			__registerStacks__.warn(...processArgs("WARN", ...args));
			originalWarn(...args);
		};

		const originalInfo = globalThis.console.info;
		globalThis.console.info = (...args: any[]) => {
			__registerStacks__.info(...processArgs("INFO", ...args));
			originalInfo(...args);
		};

		app.get(stacksPath, StacksController(filePath) as any);

		return {
			stacksPath,
		};
	};

	innerApplication.beforeListen = (event) => {
		beforeListenHandlers.push(event);
	};

	Object.setPrototypeOf(innerApplication, {
		get servers(): Set<http.Server> {
			return servers;
		},

		get server(): http.Server | undefined {
			return Array.from(servers)[0];
		},
	});

	return Object.setPrototypeOf(innerApplication, Object.getPrototypeOf(innerRouter)) as unknown as IApplication;
};
