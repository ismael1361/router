import type { MiddlewareFCDoc, IStackFrame, ITreeDoc, SwaggerOptions, IChildrenDoc, IParentDoc, Methods, SnippetTargets } from "./type";
import { deepEqual } from "@ismael1361/utils";
import path from "path";

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
