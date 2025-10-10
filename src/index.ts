import type { Request, Response, MiddlewareFC, ExpressRouter, ExpressApp, MiddlewareFCDoc } from "./type";
import { Router } from "./router";
import Express from "express";

export type * from "./type";

/**
 * Cria uma nova instância da classe `Router`, que oferece uma API fluente para a construção de rotas em Express.
 * Esta função serve como um ponto de entrada para iniciar a definição de rotas,
 * podendo opcionalmente ser integrada diretamente a uma aplicação ou roteador Express existente.
 *
 * @template Req - O tipo base para o objeto de requisição (request) em todas as rotas deste roteador.
 * @template Res - O tipo base para o objeto de resposta (response) em todas as rotas.
 *
 * @param {ExpressApp | ExpressRouter} [app] - (Opcional) Uma instância de uma aplicação Express ou de um roteador Express.
 *   - Se fornecido, um novo roteador será criado e automaticamente montado na aplicação/roteador com `app.use(router)`.
 *   - Se omitido, um roteador independente é criado, que pode ser exportado e usado posteriormente.
 *
 * @returns {Router<Req, Res>} Uma nova instância da classe `Router`, pronta para a definição de rotas.
 *
 * @example
 * // Exemplo 1: Criando um roteador independente
 * import express from "express";
 * import { create } from "./Router2";
 *
 * const app = express();
 * const userRouter = create(); // Cria uma nova instância
 *
 * userRouter.get("/", (req, res) => {
 *   res.send("Lista de usuários");
 * });
 *
 * // O roteador precisa ser usado na aplicação
 * app.use("/users", userRouter.router);
 *
 * @example
 * // Exemplo 2: Anexando o roteador diretamente a uma aplicação
 * const app = express();
 * // O roteador é criado e já anexado à raiz da aplicação
 * const mainRouter = create(app);
 *
 * mainRouter.get("/status", (req, res) => res.send("API está online"));
 */
export function create<Req extends Request = Request, Res extends Response = Response>(app?: ExpressApp | ExpressRouter): Router<Req, Res> {
	if (app instanceof Express.Router) return new Router<Req, Res>([], app);
	if (app && "use" in app) {
		const router = Express.Router();
		app.use(router);
		return new Router<Req, Res>([], router);
	}
	return new Router<Req, Res>([], Express.Router());
}

/**
 * Cria um middleware reutilizável e documentado.
 *
 * Esta função atua como um construtor (factory) que anexa uma documentação OpenAPI/Swagger
 * a uma função de middleware do Express. O middleware resultante pode ser usado em qualquer
 * lugar onde um middleware padrão é aceito, e sua documentação (como esquemas de segurança)
 * será automaticamente coletada pelo método `.getSwagger()` do roteador.
 *
 * @template Req - A extensão de tipo para o objeto `Request` que este middleware fornece.
 * @template Res - A extensão de tipo para o objeto `Response` que este middleware fornece.
 * @param {MiddlewareFC<Req, Res>} callback - A função de middleware do Express.
 * @param {MiddlewareFCDoc} [doc] - (Opcional) Um objeto contendo a documentação OpenAPI,
 *   geralmente usado para definir `securitySchemes` ou `components` reutilizáveis.
 * @returns {MiddlewareFC<Req, Res>} A função de middleware original, agora com a propriedade `.doc` anexada.
 *
 * @example
 * import { middleware, create, MiddlewareFC } from "./Router2";
 * import { Request, Response, NextFunction } from "express";
 *
 * // 1. Defina a extensão de tipo e a documentação do middleware.
 * interface AuthRequest {
 *   user: { id: string; roles: string[] };
 * }
 *
 * const authDoc = {
 *   securitySchemes: {
 *     BearerAuth: {
 *       type: "http",
 *       scheme: "bearer",
 *       bearerFormat: "JWT",
 *     },
 *   },
 * };
 *
 * // 2. Crie o middleware reutilizável usando a função factory.
 * export const authMiddleware = middleware<AuthRequest>(
 *   (req, res, next) => {
 *     // Lógica para validar um token e anexar o usuário ao request.
 *     const token = req.headers.authorization?.split(" ")[1];
 *     if (token) {
 *       req.user = { id: "user-123", roles: ["member"] };
 *       next();
 *     } else {
 *       res.status(401).send("Unauthorized");
 *     }
 *   },
 *   authDoc
 * );
 *
 * // 3. Use o middleware em uma rota.
 * const userRouter = create();
 *
 * userRouter
 *   .get("/profile")
 *   .middleware(authMiddleware) // Aplica o middleware à rota
 *   .handler((req, res) => {
 *     // 'req.user' está disponível e fortemente tipado aqui.
 *     res.json({ profile: req.user });
 *   })
 *   .doc({
 *     summary: "Get user profile",
 *     security: [{ BearerAuth: [] }], // Refere-se ao securityScheme definido no doc.
 *   });
 *
 * // Ao chamar `userRouter.getSwagger()`, o `securitySchemes` de `authDoc`
 * // será incluído na documentação final.
 */
export function middleware<Req extends Request = Request, Res extends Response = Response>(callback: MiddlewareFC<Req, Res>, doc?: MiddlewareFCDoc): MiddlewareFC<Req, Res> {
	callback.doc = doc;
	return callback;
}

/**
 * Cria um novo sub-roteador `Router` montado em um prefixo de caminho específico.
 *
 * Esta função é um atalho para `new Router().route(path)`. Ela cria um roteador principal
 * anônimo e, em seguida, cria e retorna um sub-roteador montado no `path` fornecido.
 *
 * @note Para que o prefixo de caminho tenha efeito, o roteador principal que contém
 * o sub-roteador precisa ser utilizado na aplicação. Como esta função de atalho não
 * retorna o roteador principal, o padrão de uso recomendado é instanciar o `Router`
 * manualmente para ter controle total.
 *
 * @template Req - O tipo base para o objeto de requisição (request).
 * @template Res - O tipo base para o objeto de resposta (response).
 * @param {string} path - O prefixo do caminho para o novo sub-roteador.
 * @returns {Router<Req, Res>} Uma nova instância de `Router` para definir rotas dentro do caminho especificado.
 *
 * @example
 * // Padrão de uso recomendado para criar sub-rotas:
 * import express from "express";
 * import { route } from "./router"; // Importe a classe Router diretamente
 *
 * const app = express();
 *
 * // 1. Crie sub-rotas a partir do roteador principal usando o método `route()`.
 * const usersRouter = route("/users");
 *
 * // 2. Defina os handlers para a sub-rota.
 * usersRouter.get("/:id").handler((req, res) => {
 *   // Este endpoint será acessível em /api/users/:id
 *   res.send(`Detalhes do usuário: ${req.params.id}`);
 * });
 *
 * // 3. Use o roteador principal na aplicação.
 * // Ele gerencia todos os sub-roteadores montados nele.
 * app.use("/api", usersRouter.router);
 *
 * app.listen(3000, () => console.log("Servidor rodando."));
 */
export function route<Req extends Request = Request, Res extends Response = Response>(path: string): Router<Req, Res> {
	return new Router<Req, Res>().route(path);
}
