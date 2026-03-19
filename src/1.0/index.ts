import type { Request, Response, MiddlewareFCDoc, MiddlewareCallback, HandlerCallback } from "./type";
import { Router } from "./router";
import { Middleware } from "./middleware";
import { Handler } from "./handler";
import type swaggerJSDoc from "swagger-jsdoc";
import { joinObject } from "./utils";
// import "./Doc";

export { getCorsOptions, getCorsHeaders } from "./utils";

export { HandleError } from "./HandleError";

export type * from "./type";

export * as Middlewares from "./Middlewares";

/**
 * Inicializa uma nova instância do Router. Este é o ponto de partida para construir sua aplicação.
 *
 * @template Req - Tipo de Request base para o roteador.
 * @template Res - Tipo de Response base para o roteador.
 * @returns {Router<Req, Res>} Uma nova instância do Router.
 *
 * @example
 * import { create } from '@ismael1361/router';
 *
 * const router = create();
 *
 * router.get('/ping', { summary: 'Verifica a saúde da API' })
 *   .handler((req, res) => {
 *     res.send('pong');
 *   });
 *
 * router.listen(3000, () => {
 *   console.log('Servidor rodando na porta 3000');
 * });
 */
export function create<Req extends Request = Request, Res extends Response = Response>(): Router<Req, Res> {
	return new Router<Req, Res>();
}

/**
 * Cria um componente de middleware reutilizável e encadeável.
 * Permite encapsular lógicas (como autenticação, logging) e sua documentação OpenAPI associada.
 *
 * @template Req - Tipo de Request que o middleware espera ou adiciona.
 * @template Res - Tipo de Response que o middleware pode modificar.
 * @param {MiddlewareCallback<Req, Res>} callback - A função de middleware.
 * @param {MiddlewareFCDoc} [doc] - A documentação OpenAPI para este middleware.
 * @returns {Middleware<Req, Res>} Uma instância de Middleware que pode ser usada em rotas.
 *
 * @example
 * import { middleware } from '@ismael1361/router';
 *
 * // Middleware que adiciona um usuário à requisição
 * const authMiddleware = middleware<{ user: { id: string } }>((req, res, next) => {
 *   req.user = { id: 'user-123' };
 *   next();
 * }, {
 *   security: [{ bearerAuth: [] }], // Documenta o requisito de segurança
 *   responses: { '401': { description: 'Não autorizado' } }
 * });
 *
 * // Em uma rota:
 * // router.get('/profile').middleware(authMiddleware).handler(...)
 */
export function middleware<Req extends Request = Request, Res extends Response = Response>(callback: MiddlewareCallback<Req, Res>, doc?: MiddlewareFCDoc): Middleware<Req, Res> {
	return new Middleware(callback, undefined, doc);
}

/**
 * Cria um componente de manipulador (handler/controller) reutilizável.
 * Útil para definir a lógica final de uma rota em um local separado e importá-la onde for necessário.
 *
 * @template Req - Tipo de Request que o handler espera.
 * @template Res - Tipo de Response que o handler pode modificar.
 * @param {HandlerCallback<Req, Res>} callback - A função do manipulador.
 * @param {MiddlewareFCDoc} [doc] - Documentação OpenAPI para este handler.
 * @returns {Handler<Req, Res>} Uma instância de Handler.
 *
 * @example
 * import { handler } from '@ismael1361/router';
 *
 * const getUserProfile = handler<{ user: { id: string } }>((req, res) => {
 *   res.json({ profile: req.user });
 * });
 *
 * // Em uma rota:
 * // router.get('/profile').middleware(authMiddleware).handler(getUserProfile);
 */
export function handler<Req extends Request = Request, Res extends Response = Response>(callback: HandlerCallback<Req, Res>, doc?: MiddlewareFCDoc): Handler<Req, Res> {
	return new Handler(callback, undefined, doc);
}

/**
 * Cria uma nova instância do Router com um caminho de prefixo.
 * Ideal para agrupar rotas relacionadas sob um namespace comum (ex: '/api/v1').
 *
 * @template Req - Tipo de Request base para o roteador.
 * @template Res - Tipo de Response base para o roteador.
 * @param {string} path - O caminho do prefixo para todas as rotas definidas neste roteador.
 * @returns {Router<Req, Res>} Uma nova instância do Router com o prefixo definido.
 *
 * @example
 * import { route, create } from '@ismael1361/router';
 *
 * const mainRouter = create();
 * const usersRouter = route('/users'); // Todas as rotas aqui começarão com /users
 *
 * usersRouter.get('/:id').handler((req, res) => { ... }); // Acessível em GET /users/:id
 *
 * mainRouter.by(usersRouter); // Anexa o grupo de rotas ao roteador principal
 */
export function route<Req extends Request = Request, Res extends Response = Response>(path?: string): Router<Req, Res> {
	return new Router<Req, Res>(path);
}

/**
 * Cria uma nova instância do Router com um prefixo de versão na rota.
 * Útil para versionar APIs de forma limpa (ex: '/v1', '/v2').
 *
 * @template Req - Tipo de Request base para o roteador.
 * @template Res - Tipo de Response base para o roteador.
 * @param {number} version - O número da versão para o prefixo da rota.
 * @returns {Router<Req, Res>} Uma nova instância do Router com o prefixo de versão definido.
 *
 * @example
 * import { routeVersion, create } from '@ismael1361/router';
 *
 * const apiRouter = create();
 *
 * const v1Router = routeVersion(1); // Todas as rotas aqui começarão com /v1
 *
 * v1Router.get('/users').handler((req, res) => { ... }); // Acessível em GET /v1/users
 *
 * apiRouter.by(v1Router); // Anexa o grupo de rotas versionadas ao roteador principal
 */
export function routeVersion<Req extends Request = Request, Res extends Response = Response>(version: number): Router<Req, Res> {
	return new Router<Req, Res>(`/v${version}`);
}

/**
 * Um helper para criar um objeto de documentação OpenAPI de forma limpa.
 * Ele separa a operação principal dos componentes e os mescla em um único objeto.
 *
 * @param {MiddlewareFCDoc | swaggerJSDoc.Operation} operation - O objeto de operação OpenAPI (summary, tags, responses, etc.).
 * @param {swaggerJSDoc.Components} [components={}] - Componentes OpenAPI (schemas, securitySchemes, etc.).
 * @returns {MiddlewareFCDoc} Um objeto de documentação formatado.
 *
 * @example
 * import { doc } from '@ismael1361/router';
 *
 * const userDoc = doc({
 *   summary: 'Cria um usuário',
 *   tags: ['Users'],
 *   requestBody: { $ref: '#/components/requestBodies/UserBody' }
 * }, {
 *   requestBodies: { UserBody: { content: { 'application/json': { schema: { type: 'object' } } } } }
 * });
 *
 * // router.post('/users', userDoc).handler(...)
 */
export function doc(operation: MiddlewareFCDoc | swaggerJSDoc.Operation, components: swaggerJSDoc.Components = {}): MiddlewareFCDoc {
	const { components: comp = {}, ...op } = operation;
	return { ...op, components: joinObject(comp, components) };
}

export default {
	create,
	route,
	middleware,
	handler,
	doc,
};
