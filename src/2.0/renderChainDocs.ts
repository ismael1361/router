import type { ITreeDoc, SwaggerOptions, IChildrenDoc, IParentDoc, IStackFrame } from "./type";
import { joinObject, joinPaths } from "./utils";

const isOAS3Definition = (obj: any): obj is SwaggerOptions => {
	return obj && typeof obj === "object" && ("openapi" in obj || "swagger" in obj);
};

const isTreeDoc = (obj: any): obj is ITreeDoc => {
	return obj && typeof obj === "object" && "parent" in obj && "children" in obj;
};

const isChildrenDoc = (obj: any): obj is IChildrenDoc => {
	return obj && typeof obj === "object" && "operation" in obj && "components" in obj;
};

/**
 * Normaliza os children de um ITreeDoc, que podem ser:
 * - Um array (vindo de um router)
 * - Um ITreeDoc único com parent=null (vindo de um handler)
 *
 * Desempacota automaticamente wrappers de handler (ITreeDoc com parent=null).
 */
const flattenChildren = (children: any): (IChildrenDoc | ITreeDoc)[] => {
	const items: any[] = Array.isArray(children) ? children : isTreeDoc(children) ? [children] : [];
	const result: (IChildrenDoc | ITreeDoc)[] = [];

	for (const item of items) {
		if (isTreeDoc(item) && (item as ITreeDoc).parent === null) {
			result.push(...flattenChildren((item as ITreeDoc).children));
		} else {
			result.push(item);
		}
	}

	return result;
};

export const renderChainDocs = (docs: ITreeDoc[]): Partial<SwaggerOptions> => {
	let doc: Partial<SwaggerOptions> = {
		paths: {},
		components: {},
	};

	for (const d of docs) {
		if (!isTreeDoc(d)) continue;

		// Parent é SwaggerOptions → mescla configuração global
		if (isOAS3Definition(d.parent)) {
			doc = joinObject<Partial<SwaggerOptions>>({}, d.parent, doc);
			continue;
		}

		if (d.path === undefined) continue;

		const parentDoc = isChildrenDoc(d.parent) ? (d.parent as IParentDoc) : null;
		const children = flattenChildren(d.children);

		// Coleta operations, components e stackFrames do parent + todos IChildrenDoc filhos
		let mergedOperation: Record<string, any> = parentDoc ? { ...parentDoc.operation } : {};
		let mergedComponents: Record<string, any> = parentDoc ? { ...parentDoc.components } : {};
		const stackFrames: IStackFrame[] = parentDoc ? [parentDoc.stackFrame] : [];
		const componentStackFrames: IStackFrame[] = parentDoc && Object.keys(parentDoc.components ?? {}).length > 0 ? [parentDoc.stackFrame] : [];

		for (const c of children) {
			if (!isTreeDoc(c) && isChildrenDoc(c)) {
				mergedOperation = joinObject(mergedOperation, c.operation);
				mergedComponents = joinObject(mergedComponents, c.components);
				stackFrames.push(c.stackFrame);
				if (Object.keys(c.components ?? {}).length > 0) {
					componentStackFrames.push(c.stackFrame);
				}
			}
		}

		// Mescla components coletados no doc global
		if (Object.keys(mergedComponents).length > 0) {
			const existingCompFrames: IStackFrame[] = (doc.components as any)?.stackFrames ?? [];
			doc.components = {
				...joinObject(doc.components ?? {}, mergedComponents),
				stackFrames: [...existingCompFrames, ...componentStackFrames],
			};
		}

		// Se o nó tem method, é um endpoint → cria entrada em paths
		if (d.method) {
			const fullPath = joinPaths(d.path);
			const existing = doc.paths?.[fullPath]?.[d.method] ?? {};
			const existingFrames: IStackFrame[] = existing.stackFrames ?? [];
			doc.paths = {
				...doc.paths,
				[fullPath]: {
					...doc.paths?.[fullPath],
					[d.method]: {
						...joinObject(existing, mergedOperation),
						stackFrames: [...existingFrames, ...stackFrames],
					},
				},
			};
		}

		// Processa ITreeDoc filhos (sub-rotas aninhadas)
		for (const c of children) {
			if (!isTreeDoc(c)) continue;

			if (isOAS3Definition((c as ITreeDoc).parent)) {
				doc = joinObject<Partial<SwaggerOptions>>({}, (c as ITreeDoc).parent as SwaggerOptions, doc);
				continue;
			}

			const childDoc = renderChainDocs([c as ITreeDoc]);

			// Mescla propriedades que não são paths (components, tags, etc.)
			const { paths: childPaths, path: _, ...childRest } = childDoc;
			doc = joinObject<Partial<SwaggerOptions>>({}, childRest, doc);

			// Mescla paths com prefixo correto
			for (const p in childPaths) {
				const fullPath = joinPaths(d.path || "", p);

				for (const m in childPaths[p]) {
					const childEntry = childPaths[p][m];
					const childStackFrames: IStackFrame[] = childEntry.stackFrames ?? [];
					const existing = doc.paths?.[fullPath]?.[m] ?? {};
					const existingFrames: IStackFrame[] = existing.stackFrames ?? [];
					doc.paths = {
						...doc.paths,
						[fullPath]: {
							...doc.paths?.[fullPath],
							[m]: {
								...joinObject(existing, mergedOperation, childEntry),
								stackFrames: [...existingFrames, ...stackFrames, ...childStackFrames],
							},
						},
					};
				}
			}
		}
	}

	// Aplica defaultResponses em cada operação que não definiu responses
	if (doc.defaultResponses && doc.paths) {
		for (const path in doc.paths) {
			for (const method in doc.paths[path]) {
				const operation = doc.paths[path][method];
				if (typeof operation === "object" && operation !== null) {
					doc.paths[path][method] = {
						...operation,
						responses: joinObject(doc.defaultResponses, operation.responses ?? {}),
					};
				}
			}
		}
	}

	return doc;
};
