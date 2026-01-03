import { Readable } from "stream";
import { HandleError } from "./HandleError";
import { FileInfo, FilesRequest, MiddlewareFC, Request, Response } from "./type";
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

type CorsOptionsMethods = "GET" | "POST" | "PUT" | "DELETE" | "OPTIONS" | "PATCH" | "HEAD";

interface CorsOptions {
	/**
	 * Informa quais métodos HTTP são permitidos quando a requisição é cross-origin.
	 * - OPTIONS é essencial para preflight requests (verificação prévia feita pelo navegador).
	 * - Sem esse header, o navegador bloqueia métodos não listados.
	 */
	allowedMethods?: CorsOptionsMethods[] | string;
	/**
	 * Define quais headers customizados o cliente pode enviar.
	 *
	 * Casos comuns:
	 * - Authorization → tokens JWT / Bearer
	 * - Content-Type → JSON, multipart/form-data
	 * - X-Requested-With → requisições AJAX antigas
	 *
	 * Se o cliente enviar um header que não esteja nessa lista, o navegador bloqueia a requisição.
	 */
	allowedHeaders?: string[] | string;
	/**
	 * Permite que a requisição inclua credenciais, como:
	 * - Cookies
	 * - Headers de autenticação
	 * - Certificados TLS do cliente
	 */
	credentials?: boolean;
	/**
	 * Esse header define quais headers adicionais podem ser lidos via:
	 *
	 * ```js
	 * response.headers.get("Content-Length");
	 * ```
	 *
	 * Exemplo de uso:
	 * - Paginação (Content-Range)
	 * - Download de arquivos (Content-Length)
	 */
	exposeHeaders?: string[] | string;
}

export const cors = (allowOrigin: string = "*", options: CorsOptions = {}): MiddlewareFC<Request, Response> => {
	return (req, res, next) => {
		// Configuração mais robusta de CORS
		const origin = req.headers.origin;

		options = { allowedMethods: "*", allowedHeaders: "*", credentials: true, exposeHeaders: "*", ...options };

		// Definir headers CORS
		res.setHeader("Access-Control-Allow-Origin", allowOrigin === "*" ? "*" : origin || "*");

		if (options.allowedMethods) res.setHeader("Access-Control-Allow-Methods", Array.isArray(options.allowedMethods) ? options.allowedMethods.join(",") : options.allowedMethods);

		if (options.allowedHeaders) res.setHeader("Access-Control-Allow-Headers", Array.isArray(options.allowedHeaders) ? options.allowedHeaders.join(",") : options.allowedHeaders);

		res.setHeader("Access-Control-Allow-Credentials", options.credentials ? "true" : "false");

		if (options.exposeHeaders) res.setHeader("Access-Control-Expose-Headers", Array.isArray(options.exposeHeaders) ? options.exposeHeaders.join(",") : options.exposeHeaders);

		// Responder a requisições OPTIONS
		if (req.method === "OPTIONS") {
			return res.status(200).end();
		}

		next();
	};
};

/**
 * Middleware para analisar arquivos de uma solicitação.
 * Os arquivos com suas informações são armazenados no objeto `req.files`, sua tipagem: `FileInfo[]`.
 * Ao usar esse middleware, é necessário que o corpo da requisição seja um objeto `FormData`.
 * Se caso o middleware não encontrar nenhum arquivo, ele irá lançar um erro.
 *
 * @example
 * ```ts
 * Router.middleware(Middleware.files()).handler(async (req, res) => {
 * });
 *
 * Router.middleware(Middleware.files(Middleware.files('image/jpeg', 'image/png', 'application/pdf')).handler(async (req, res) => {
 * });
 * ```
 */
export const files = (...allowedMimes: string[]): MiddlewareFC<FilesRequest> => {
	return async (req, res, next) => {
		allowedMimes = allowedMimes.map((mime) => mime.trim().toLowerCase());

		const rawBody = await new Promise<Buffer>((resolve, reject) => {
			const chunks: Buffer[] = [];
			req.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
			req.on("end", () => resolve(Buffer.concat(chunks)));
			req.on("error", reject);
		});

		if (!req.headers["content-type"] || !req.headers["content-type"].startsWith("multipart/form-data")) {
			throw new HandleError("Invalid content type", "BAD_REQUEST", 400);
		}

		const boundary = req.headers["content-type"].split("boundary=")[1];
		const parts = rawBody.toString("binary").split(`--${boundary}`);
		const files: FileInfo[] = [];

		for (const part of parts) {
			if (part.includes('filename="')) {
				const [header, ...body] = part.split("\r\n\r\n");
				const content = body.join("\r\n\r\n").trim();
				const buffer = Buffer.from(content, "binary");

				// Extrair nome do campo e nome do arquivo
				const fieldnameMatch = header.match(/name="([^"]+)"/);
				const filenameMatch = header.match(/filename="([^"]+)"/);
				const mimetypeMatch = header.match(/Content-Type: ([^\r\n]+)/);

				if (fieldnameMatch && filenameMatch && mimetypeMatch) {
					const fieldname = fieldnameMatch[1];
					const filename = filenameMatch[1];
					const contentType = mimetypeMatch[1].trim().toLowerCase();
					if (allowedMimes.length > 0 && !allowedMimes.includes(contentType)) {
						continue;
					}
					files.push({
						fieldname: fieldname,
						originalname: filename,
						encoding: "",
						mimetype: contentType,
						size: content.length,
						stream: new Readable(),
						destination: "",
						filename: filename,
						path: "",
						buffer: buffer.slice(0, -2),
					});
				}
			}
		}

		if (!files.length) {
			throw new HandleError("No files were uploaded", "BAD_REQUEST", 400);
		}

		req.file = files[0];
		req.files = files;

		next();
	};
};
