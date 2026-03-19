import { Readable } from "stream";
import { HandleError } from "./HandleError";
import { FileInfo, FilesRequest, MiddlewareFC, Request, Response } from "./type";
import BodyParser, { OptionsJson, Options, OptionsText, OptionsUrlencoded } from "body-parser";
import fs from "fs";

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
	 * Define quais origens são permitidas para requisições cross-origin.
	 * - Use "*" para permitir todas as origens.
	 * - Use uma URL específica (ex: "https://example.com") para restringir a uma origem.
	 */
	allowOrigin?: string;
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

/**
 * Middleware para configurar CORS (Cross-Origin Resource Sharing).
 * Permite controlar quais domínios podem acessar a API, quais métodos HTTP são permitidos, headers, etc.
 *
 * @param {string} allowOrigin - Origem permitida (ex: "*", "https://site.com").
 * @param {CorsOptions} options - Opções de configuração do CORS.
 * @returns {MiddlewareFC<Request, Response>} Middleware configurado.
 *
 * @example
 * // Permitir qualquer origem (padrão se nenhuma opção for passada ou passar apenas "*")
 * app.middleware(Middlewares.cors({ allowOrigin: "*" }));
 *
 * // Permitir origem específica com opções
 * app.middleware(Middlewares.cors("https://meusite.com", {
 *   allowedMethods: ["GET", "POST"],
 *   credentials: true
 * }));
 *
 * // Passando apenas objeto de opções
 * app.middleware(Middlewares.cors({
 *   allowOrigin: "https://api.meusite.com",
 *   exposeHeaders: ["Content-Length"]
 * }));
 */
export function cors(allowOrigin?: string, options?: CorsOptions): MiddlewareFC<Request, Response>;
export function cors(options?: CorsOptions): MiddlewareFC<Request, Response>;
export function cors(allowOrigin: string | CorsOptions = "*", options: CorsOptions = {}): MiddlewareFC<Request, Response> {
	options = { ...(typeof allowOrigin === "string" ? { allowOrigin } : allowOrigin), ...options };
	return (req, res, next) => {
		// Configuração mais robusta de CORS
		const origin = req.headers.origin;

		options = { allowedMethods: "*", allowedHeaders: "*", credentials: true, exposeHeaders: "*", ...options };

		// Definir headers CORS
		res.setHeader("Access-Control-Allow-Origin", options.allowOrigin || origin || "*");

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
}

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

export const StacksController =
	(filePath: string): MiddlewareFC<Request, Response> =>
	(req, res, next) => {
		const parseJSON = (json: string) => {
			const regex = /(\w+)=("(?:[^"\\]|\\.)*"|\S+)/g;
			const result: any = {};

			let match: RegExpExecArray | null;

			while ((match = regex.exec(json)) !== null) {
				const key = match[1];
				let value = match[2];

				if (value.startsWith('"') && value.endsWith('"')) {
					value = JSON.parse(value);
				}

				try {
					value = JSON.parse(value);
				} catch {
					result[key] = value;
				}
			}

			return result;
		};

		const stacks_file = fs.existsSync(filePath) ? fs.readFileSync(filePath).toString() : "";

		const stacks = stacks_file
			.trim()
			.split("\n")
			.slice(-50)
			.map((stack) => {
				const { time = "", level = "log", message = "" } = parseJSON(stack);

				const [title, ...lines] = message.split("\n") as string[];

				return `<div class="${level.toLowerCase()}"><h3>${title}</h3><p>${new Date(time).toLocaleString("pt-BR")}</p><div class="message"><pre><code>${lines.join(
					"</code></pre><pre><code>",
				)}</code></pre></div></div>`;
			})
			.reverse()
			.join("\n");

		res.setHeader("Content-Type", "text/html");

		res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stacks</title>
    <style>
    body{
   --background: #212121;
   background: var(--background);
   color: #fafafa;
}

body > .main{
   position: relative;
   width: 90%;
   max-width: 800px;
   margin: 20px auto;
}

body > .main::before {
    content: "";
    position: absolute;
    bottom: 0px;
    left: 0px;
    right: 0px;
    height: 100vh;
    background-image: linear-gradient(to top, var(--background), transparent);
    z-index: 1;
}

body > .main > div{
   --color: #424242;
   width: 100%;
   margin: 20px auto;
   border: 2px solid var(--color);
   border-radius: 18px;
   box-sizing: border-box;
   background-image: linear-gradient(rgba(0, 0, 0, .5));
   background-color: var(--color);
   overflow: hidden;
   z-index: 0;
}

body > .main > div.error{
   --color: #b71c1c;
}

body > .main > div.warn{
   --color: #e65100;
}

body > .main > div.info{
   --color: #01579b;
}

body > .main > div > h3 {
   margin: 0px;
   padding: 1rem 1rem 0px;
}

body > .main > div > p {
   margin: 0px;
   padding: 0.4rem 1rem 1rem;
   opacity: .8;
   font-style: italic;
}

body > .main > div > .message{
   overflow-x: auto;
   padding: 1rem;
   background: rgba(0, 0, 0, .5);
   border-top: 2px solid var(--color);
   font-size: .6rem;
}
    </style>
</head>
<body><div class="main">${stacks}</div></body>
</html>
`);
	};
