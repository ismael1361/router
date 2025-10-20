import { MiddlewareFC, Request, Response } from "./type";
import BodyParser, { OptionsJson, Options, OptionsText, OptionsUrlencoded } from "body-parser";

/**
 * Retorna um middleware que analisa corpos de requisição JSON.
 * Este middleware é um wrapper em torno do `body-parser.json()`.
 *
 * @param {OptionsJson} [options] - Opções de configuração para o `body-parser`.
 * @returns {MiddlewareFC<Request, Response>} Uma função de middleware do Express.
 *
 * @example
 * import { create, Middlewares } from '@ismael1361/router';
 *
 * const app = create();
 *
 * // Aplica o middleware para analisar JSON em todas as rotas
 * app.middleware(Middlewares.json());
 *
 * app.post('/data').handler((req, res) => {
 *   // req.body agora contém o objeto JSON enviado
 *   res.json({ received: req.body });
 * });
 */
export const json = (options?: OptionsJson | undefined): MiddlewareFC<Request, Response> => {
	return BodyParser.json(options);
};

/**
 * Retorna um middleware que analisa corpos de requisição como um Buffer.
 * Este middleware é um wrapper em torno do `body-parser.raw()`.
 *
 * @param {Options} [options] - Opções de configuração para o `body-parser`.
 * @returns {MiddlewareFC<Request, Response>} Uma função de middleware do Express.
 *
 * @example
 * import { create, Middlewares } from '@ismael1361/router';
 *
 * const app = create();
 *
 * // Analisa corpos do tipo 'application/octet-stream' como Buffer
 * app.middleware(Middlewares.raw({ type: 'application/octet-stream', limit: '10mb' }));
 *
 * app.post('/upload-raw').handler((req, res) => {
 *   // req.body é um Buffer com os dados brutos
 *   console.log('Buffer recebido:', req.body.length, 'bytes');
 *   res.send('Raw data received');
 * });
 */
export const raw = (options?: Options): MiddlewareFC<Request, Response> => {
	return BodyParser.raw(options);
};

/**
 * Retorna um middleware que analisa corpos de requisição como texto.
 * Este middleware é um wrapper em torno do `body-parser.text()`.
 *
 * @param {OptionsText} [options] - Opções de configuração para o `body-parser`.
 * @returns {MiddlewareFC<Request, Response>} Uma função de middleware do Express.
 *
 * @example
 * import { create, Middlewares } from '@ismael1361/router';
 *
 * const app = create();
 *
 * // Analisa corpos do tipo 'text/plain' como string
 * app.middleware(Middlewares.text({ type: 'text/plain' }));
 *
 * app.post('/log').handler((req, res) => {
 *   // req.body é uma string com o conteúdo do corpo
 *   console.log('Log recebido:', req.body);
 *   res.send('Log received');
 * });
 */
export const text = (options?: OptionsText): MiddlewareFC<Request, Response> => {
	return BodyParser.text(options);
};

/**
 * Retorna um middleware que analisa corpos de requisição com o formato `application/x-www-form-urlencoded`.
 * Este middleware é um wrapper em torno do `body-parser.urlencoded()`.
 *
 * @param {OptionsUrlencoded} [options] - Opções de configuração para o `body-parser`.
 * @returns {MiddlewareFC<Request, Response>} Uma função de middleware do Express.
 *
 * @example
 * import { create, Middlewares } from '@ismael1361/router';
 *
 * const app = create();
 *
 * // Aplica o middleware para analisar dados de formulário
 * app.middleware(Middlewares.urlencoded({ extended: true }));
 *
 * app.post('/submit-form').handler((req, res) => {
 *   // req.body contém os dados do formulário
 *   res.json({ form_data: req.body });
 * });
 */
export const urlencoded = (options?: OptionsUrlencoded): MiddlewareFC<Request, Response> => {
	return BodyParser.urlencoded(options);
};
