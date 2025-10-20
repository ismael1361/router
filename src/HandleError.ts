const codes = {
	100: "Continue",
	101: "Switching Protocols",
	102: "Processing",
	103: "Early Hints",
	200: "OK",
	201: "Created",
	202: "Accepted",
	203: "Non-Authoritative Information",
	204: "No Content",
	205: "Reset Content",
	206: "Partial Content",
	207: "Multi-Status",
	208: "Already Reported",
	226: "IM Used",
	300: "Multiple Choices",
	301: "Moved Permanently",
	302: "Found",
	303: "See Other",
	304: "Not Modified",
	305: "Use Proxy",
	307: "Temporary Redirect",
	308: "Permanent Redirect",
	400: "Bad Request",
	401: "Unauthorized",
	402: "Payment Required",
	403: "Forbidden",
	404: "Not Found",
	405: "Method Not Allowed",
	406: "Not Acceptable",
	407: "Proxy Authentication Required",
	408: "Request Timeout",
	409: "Conflict",
	410: "Gone",
	411: "Length Required",
	412: "Precondition Failed",
	413: "Payload Too Large",
	414: "URI Too Long",
	415: "Unsupported Media Type",
	416: "Range Not Satisfiable",
	417: "Expectation Failed",
	418: "I'm a Teapot",
	421: "Misdirected Request",
	422: "Unprocessable Entity",
	423: "Locked",
	424: "Failed Dependency",
	425: "Too Early",
	426: "Upgrade Required",
	428: "Precondition Required",
	429: "Too Many Requests",
	431: "Request Header Fields Too Large",
	451: "Unavailable For Legal Reasons",
	500: "Internal Server Error",
	501: "Not Implemented",
	502: "Bad Gateway",
	503: "Service Unavailable",
	504: "Gateway Timeout",
	505: "HTTP Version Not Supported",
	506: "Variant Also Negotiates",
	507: "Insufficient Storage",
	508: "Loop Detected",
	510: "Not Extended",
	511: "Network Authentication Required",
} as const;

/**
 * Uma classe de erro personalizada projetada para lidar com erros operacionais em uma aplicação,
 * especialmente em um contexto de API HTTP. Permite encapsular uma mensagem de erro, um nome,
 * um código de status HTTP e um nível de log.
 *
 * @example
 * // Exemplo 1: Erro com mensagem e código de status.
 * try {
 *   throw new HandleError("Recurso não encontrado.", "NOT_FOUND", 404);
 * } catch (e) {
 *   if (e instanceof HandleError) {
 *     // Em um handler de API, você poderia usar e.code para definir o status da resposta.
 *     // res.status(e.code).json({ message: e.message, name: e.name });
 *     console.log(e.message); // "Recurso não encontrado."
 *     console.log(e.name);    // "NOT_FOUND"
 *     console.log(e.code);    // 404
 *     console.log(e.status);  // { code: 404, message: 'Not Found' }
 *   }
 * }
 *
 * // Exemplo 2: Erro de validação com nível de log 'WARN'.
 * const validationError = new HandleError(
 *   "O campo 'email' é inválido.",
 *   "VALIDATION_ERROR",
 *   400, // Bad Request
 *   "WARN"
 * );
 *
 * // Exemplo 3: Erro genérico, usando os valores padrão.
 * const genericError = new HandleError("Algo deu errado.");
 * console.log(genericError.name);  // "DEFAULT"
 * console.log(genericError.code);  // 200 (comportamento padrão quando 'cause' não é número)
 * console.log(genericError.level); // "ERROR"
 */
export class HandleError extends Error {
	/**
	 * @param {string} message A mensagem de erro principal, legível para humanos.
	 * @param {string} [name="DEFAULT"] Um nome/código para categorizar o erro (ex: "VALIDATION_ERROR").
	 * @param {keyof typeof codes | HandleError | Error | string | object} [cause] A causa raiz do erro. Se for um número, será tratado como um código de status HTTP.
	 * @param {"ERROR" | "WARN" | "INFO" | "NONE"} [level="ERROR"] O nível de severidade do erro, usado para controle de logs.
	 */
	constructor(
		readonly message: string,
		readonly name: string = "DEFAULT",
		readonly cause?: keyof typeof codes | HandleError | Error | string | object,
		readonly level: "ERROR" | "WARN" | "INFO" | "NONE" = "ERROR",
	) {
		super(message);
	}

	/** Retorna o código de status HTTP associado ao erro. Extraído da propriedade `cause` se for um número, caso contrário, o padrão é 200. */
	get code() {
		return typeof this.cause === "number" ? this.cause : 200;
	}

	/** Retorna um objeto contendo o código de status e a mensagem HTTP correspondente. */
	get status() {
		return {
			code: this.code,
			message: codes[this.code],
		};
	}
}
