import express from "express";
import type { Request, Response, RequestHandler, JoinRequest, JoinResponse, NextFunction, ITreeDoc, IHandler, IMiddleware } from "./type";
import type swaggerJSDoc from "swagger-jsdoc";
import { MiddlewareFCDoc } from "../1.0";
import { createDynamicMiddleware, joinObject, parseStack, rootStack } from "./utils";
import nodePath from "path";

/**
 * Representa um handler encadeável que combina execução de middlewares com documentação OpenAPI.
 * Estende {@link RequestHandler}, podendo ser usado diretamente como middleware do Express.
 *
 * Cada chamada a {@link IHandler.handler | `.handler()`} adiciona um middleware à cadeia e
 * mescla os tipos de `Request` e `Response` via {@link JoinRequest} e {@link JoinResponse},
 * garantindo inferência de tipos acumulada ao longo da cadeia.
 *
 * @typeParam Rq - Tipo cumulativo do request, mesclado a cada `.handler()` encadeado.
 * @typeParam Rs - Tipo cumulativo do response, mesclado a cada `.handler()` encadeado.
 *
 * @example
 * // Uso básico: definir uma rota GET e encadear um handler final
 * app.get("/users")
 *   .handler((req, res) => {
 *     res.json([{ name: "Alice" }]);
 *   });
 *
 * @example
 * // Encadear múltiplos handlers com inferência de tipos acumulada
 * interface AuthRequest extends Request {
 *   user: { userId: string; id: string; roles: string[] };
 * }
 *
 * const authMiddleware = middleware((req: AuthRequest, res, next) => {
 *   req.user = { userId: "123", id: "abc", roles: ["admin"] };
 *   next();
 * });
 *
 * app.get("/hello/:userId/:id")
 *   .handler(authMiddleware)
 *   .handler((req, res) => {
 *     // `req.user` e `req.params.userId` são inferidos automaticamente
 *     res.send(`Hello, ${req.user.userId}!`);
 *   });
 *
 * @example
 * // Encadear handlers e documentação OpenAPI alternadamente
 * app.post("/items")
 *   .handler(authMiddleware)
 *   .handler((req, res, next) => {
 *     console.log("Validando...");
 *     next();
 *   })
 *   .doc({
 *     tags: ["Items"],
 *     summary: "Criar item",
 *     requestBody: {
 *       content: {
 *         "application/json": {
 *           schema: { type: "object", properties: { name: { type: "string" } } },
 *         },
 *       },
 *     },
 *   })
 *   .handler((req, res) => {
 *     res.status(201).json({ id: 1, name: "Novo item" });
 *   });
 */
export const handler = <Rq extends Request = Request, Rs extends Response = Response>(fn: RequestHandler<Rq, Rs>) => {
	const router = express.Router({ mergeParams: true });

	const props = {
		__chain_docs__: {
			parent: null,
			children: [],
		} as ITreeDoc,
		handler<Req extends Request = Request, Res extends Response = Response>(fn: RequestHandler<Req & Rq, Res & Rs> | IHandler<Req & Rq, Res & Rs> | IMiddleware<Req & Rq, Res & Rs>) {
			router.use(createDynamicMiddleware(fn) as any);
			if ("__chain_docs__" in fn) {
				this.__chain_docs__.children.push((fn as any).__chain_docs__);
			}
			return this as unknown as IHandler<JoinRequest<Rq, Req>, JoinResponse<Rs, Res>>;
		},
		doc(operation: MiddlewareFCDoc | swaggerJSDoc.Operation, components: swaggerJSDoc.Components = {}) {
			const { components: comp = {}, ...op } = operation;

			const stack = parseStack().filter(({ dir }) => !nodePath.resolve(dir).startsWith(nodePath.resolve(rootStack[0].dir)))[0];

			this.__chain_docs__.children.push({
				stackFrame: stack,
				operation: op,
				components: joinObject(comp, components),
			});
			return this as unknown as IHandler<Rq, Rs>;
		},
	};

	const rootHandler = Object.setPrototypeOf(function (req: Rq, res: Rs, next: NextFunction) {
		return router(req, res, next);
	}, props) as unknown as IHandler<Rq, Rs>;

	return rootHandler.handler<Rq, Rs>(fn);
};

/**
 * Cria um middleware reutilizável com suporte a documentação OpenAPI, mas sem encadeamento
 * via `.handler()`. Internamente utiliza {@link handler}, porém remove o método `.handler()`
 * para deixar claro que um middleware não deve iniciar uma nova cadeia de handlers.
 *
 * O middleware resultante pode ser passado para `.handler()` de um {@link IHandler},
 * e seus tipos genéricos serão mesclados automaticamente na cadeia.
 *
 * @typeParam Req - Tipo do request que o middleware espera/enriquece.
 * @typeParam Res - Tipo do response que o middleware espera/enriquece.
 * @param fn - Função de middleware que recebe `(req, res, next)`.
 * @returns Instância de {@link IMiddleware} com método `.doc()` disponível.
 *
 * @example
 * // Middleware simples de logging
 * const logMiddleware = middleware((req, res, next) => {
 *   console.log(`${req.method} ${req.url}`);
 *   next();
 * });
 *
 * app.get("/users")
 *   .handler(logMiddleware)
 *   .handler((req, res) => {
 *     res.json([]);
 *   });
 *
 * @example
 * // Middleware de autenticação com tipo customizado e documentação OpenAPI
 * interface AuthRequest extends Request {
 *   user: { userId: string; roles: string[] };
 * }
 *
 * const authMiddleware = middleware((req: AuthRequest, res, next) => {
 *   req.user = { userId: "123", roles: ["admin"] };
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
 * // Ao encadear, `req.user` é inferido automaticamente
 * app.get("/profile")
 *   .handler(authMiddleware)
 *   .handler((req, res) => {
 *     res.json({ userId: req.user.userId });
 *   });
 *
 * @example
 * // Middleware de validação de corpo da requisição
 * interface BodyRequest extends Request<string, { name: string; email: string }> {}
 *
 * const validateBody = middleware((req: BodyRequest, res, next) => {
 *   if (!req.body.name || !req.body.email) {
 *     res.status(400).json({ error: "name e email são obrigatórios" });
 *     return;
 *   }
 *   next();
 * }).doc({
 *   requestBody: {
 *     required: true,
 *     content: {
 *       "application/json": {
 *         schema: {
 *           type: "object",
 *           required: ["name", "email"],
 *           properties: {
 *             name: { type: "string" },
 *             email: { type: "string", format: "email" },
 *           },
 *         },
 *       },
 *     },
 *   },
 * });
 *
 * app.post("/users")
 *   .handler(validateBody)
 *   .handler((req, res) => {
 *     // `req.body.name` e `req.body.email` são inferidos como string
 *     res.status(201).json({ name: req.body.name });
 *   });
 */
export const middleware = <Req extends Request = Request, Res extends Response = Response>(fn: RequestHandler<Req, Res>) => {
	const middleware = handler<Req, Res>(fn);
	middleware.handler = undefined as any; // Remove a referência ao handler para evitar confusão
	return middleware as unknown as IMiddleware<Req, Res>;
};
