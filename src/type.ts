import type { Request as ExpressRequest, Response as ExpressResponse, NextFunction, Router as ExpressRouter, Express as ExpressApp, RequestHandler, Locals } from "express";
import type swaggerJSDoc from "swagger-jsdoc";
import type { Middleware, MiddlewareRouter, RequestMiddleware } from "./middleware";
import type { Handler } from "./handler";
import type { Readable } from "stream";

export { ExpressRequest, NextFunction, ExpressRouter, ExpressApp };

type Send<ResBody = any, T = Response<ResBody>> = (body?: ResBody) => T;

// helper: detecta `any`
type IsAny<T> = 0 extends 1 & T ? true : false;

// mesclagem de objetos por chave (se ambos tem a mesma chave, usa union dos tipos)
type MergeObjects<A, B> = {
	[K in keyof A | keyof B]: K extends keyof A
		? K extends keyof B
			? A[K] | B[K] // se ambos definem a chave, junta como union (você pode trocar por A[K] & B[K])
			: A[K]
		: K extends keyof B
			? B[K]
			: never;
};

// prefere um lado quando o outro é `any`, caso contrário mescla
export type PreferMerge<A, B> = IsAny<A> extends true ? B : IsAny<B> extends true ? A : MergeObjects<A, B>;

// combina chaves tipo string (ReqQuery / ReqParams), preferindo o não-any, senão união
export type CombineKeys<A, B> = IsAny<A> extends true ? B : IsAny<B> extends true ? A : A | B;

export type Identity<T> = IsAny<T> extends true ? Record<PropertyKey, any> : T;

export type Prettify<T> = { [K in keyof T]: T[K] } & {};

export type RouterMethods = "get" | "post" | "put" | "delete" | "patch" | "options" | "head" | "all" | "use";

export interface Request<ReqQuery extends string = any, ReqBody = any, ReqParams extends string = any, ResBody = any> extends ExpressRequest<
	Record<ReqParams, any>,
	ResBody,
	Identity<ReqBody>,
	Record<ReqQuery, any>
> {
	clientIp: string;
	body: Identity<ReqBody>;
	params: Record<ReqParams, any>;
	query: Record<ReqQuery, any>;
}

export interface Response<ResBody = any, LocalsObj extends Record<string, any> = Record<string, any>> extends ExpressResponse<ResBody, LocalsObj> {
	send: Send<ResBody, this>;
	json: Send<ResBody, this>;
	jsonp: Send<ResBody, this>;
	locals: LocalsObj & Locals;
}

export type ExpressRequestHandler<Rq, Rs> =
	Rq extends ExpressRequest<infer P, any, infer ReqBody, infer ReqQuery, any>
		? Rs extends ExpressResponse<infer ResBody, infer LocalsObj>
			? RequestHandler<P, ResBody, ReqBody, ReqQuery, LocalsObj>
			: never
		: never;

/**
 * Define a estrutura da documentação Swagger/OpenAPI que pode ser anexada a um middleware.
 * Permite que middlewares contribuam com definições de segurança, parâmetros, etc., que são
 * mescladas com a documentação da rota final.
 *
 * @see MiddlewareFC
 * @example
 * const authMiddleware: MiddlewareFC = (req, res, next) => { next(); };
 * authMiddleware.doc = {
 *   security: [{ BearerAuth: [] }],
 *   components: {
 *     securitySchemes: { BearerAuth: { type: "http", scheme: "bearer" } }
 *   }
 * };
 */
export type MiddlewareFCDoc = swaggerJSDoc.Operation & {
	components?: swaggerJSDoc.Components;
};

/**
 * Estende o objeto de requisição do Express com funcionalidades adicionais para o middleware.
 * @template Req O tipo do objeto de requisição do Express.
 */
export type MiddlewareRequest<Req = Request> = Request &
	Req & {
		/**
		 * Controla a execução do middleware para a requisição atual.
		 * Útil para garantir que um middleware seja executado apenas uma vez, mesmo que seja
		 * aplicado em múltiplos níveis de rotas.
		 *
		 * @param {boolean} [isOnce=true] - Se `true`, o middleware não será executado novamente para a mesma requisição. Se `false`, permite que o middleware seja executado novamente.
		 *
		 * @example
		 * // Middleware que executa uma lógica apenas uma vez por requisição.
		 * const myMiddleware: MiddlewareFC = (req, res, next) => {
		 *   // Garante que este bloco de código execute apenas uma vez.
		 *   req.executeOnce();
		 *
		 *   console.log("Este middleware só roda uma vez!");
		 *   next();
		 * };
		 */
		executeOnce(isOnce?: boolean): void;
	};

export type HandlerFC<Req extends Request = any, Res extends Response = any> = {
	(req: MiddlewareRequest<Req>, res: Response & Res, next: NextFunction): any;
	id?: string;
	doc?: MiddlewareFCDoc;
};

export type MiddlewareFC<Req extends Request = any, Res extends Response = any> = HandlerFC<Req, Res>;

export type HandlerCallback<Rq extends Request = Request, Rs extends Response = Response> = HandlerFC<Rq, Rs> | Handler<Rq, Rs>;

export type MiddlewareCallback<Rq extends Request = Request, Rs extends Response = Response> = MiddlewareFC<Rq, Rs> | RequestMiddleware<Rq, Rs> | Middleware<Rq, Rs> | MiddlewareRouter<Rq, Rs>;

export type ILayer = {
	method: RouterMethods;
	type: "layer" | "route" | "middleware";
	doc?: MiddlewareFCDoc;
} & (
	| {
			path?: string;
			type: "route";
			route: ILayer[];
			handle?: Array<HandlerFC | MiddlewareFC>;
	  }
	| {
			path: string;
			method: RouterMethods;
			type: "layer";
			handle: Array<HandlerFC | MiddlewareFC>;
	  }
	| {
			method: RouterMethods;
			type: "middleware";
			handle: Array<HandlerFC | MiddlewareFC>;
	  }
);

export interface IRoute {
	index: number;
	path: string;
	method: RouterMethods;
	handle: Array<HandlerFC | MiddlewareFC>;
	doc?: MiddlewareFCDoc;
}

export interface RouterProps<Req extends Request = any, Res extends Response = any> {
	type: RouterMethods;
	path: string;
	middlewares: MiddlewareFC<Req, Res>[];
	handler: HandlerFC<Req, Res>;
	doc(operation: MiddlewareFCDoc | swaggerJSDoc.Operation, components?: swaggerJSDoc.Components): RouterProps;
}

export interface SwaggerOptions extends swaggerJSDoc.OAS3Definition {
	path?: string;
	defaultResponses?: swaggerJSDoc.Responses;
}

export interface FileInfo {
	/** Name of the form field associated with this file. */
	fieldname: string;
	/** Name of the file on the uploader's computer. */
	originalname: string;
	/**
	 * Value of the `Content-Transfer-Encoding` header for this file.
	 * @deprecated since July 2015
	 * @see RFC 7578, Section 4.7
	 */
	encoding: string;
	/** Value of the `Content-Type` header for this file. */
	mimetype: string;
	/** Size of the file in bytes. */
	size: number;
	/**
	 * A readable stream of this file. Only available to the `_handleFile`
	 * callback for custom `StorageEngine`s.
	 */
	stream: Readable;
	/** `DiskStorage` only: Directory to which this file has been uploaded. */
	destination: string;
	/** `DiskStorage` only: Name of this file within `destination`. */
	filename: string;
	/** `DiskStorage` only: Full path to the uploaded file. */
	path: string;
	/** `MemoryStorage` only: A Buffer containing the entire file. */
	buffer: Buffer;
}

export interface FilesRequest extends Request {
	file: FileInfo;
	files: FileInfo[];
}

export interface StackLog {
	time: Date;
	level: "ERROR" | "WARN" | "INFO" | "DEBUG";
	name: string;
	message: string;
	source?: string;
	statusCode: number;
	duration: number;
	meta?: Record<string, any>;
}

export interface StacksOptions {
	/** Caminho de rota de empilhamento dos logs */
	path?: string;
	/** Limite máximo de logs a serem empilhadas */
	limit?: number;
	/** Caminho base para o arquivo dos logs empilhados */
	filePath?: string;

	beforeStack?(...stacks: StackLog[]): Array<StackLog | string | Error>;
}

export interface APPAddress {
	protocol: string;
	host: string;
	port: string;
	url: string;
}
