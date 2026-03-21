import type { MiddlewareFCDoc, IStackFrame } from "./type";
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
