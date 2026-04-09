import { IDoc, TDocOperation } from "./type";
import { joinObject } from "./utils";

export const doc: IDoc<TDocOperation> = (operation, components) => {
	const { components: comp = {}, ...op } = operation;

	return {
		...op,
		components: joinObject(comp, components || {}),
	};
};
