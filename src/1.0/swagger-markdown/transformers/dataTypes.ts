import anchor from "../lib/anchor";
import type Schema from "../models/schema";

const resolver: Record<string, Record<string, string>> = {
	integer: {
		int32: "integer",
		int64: "long",
	},
	number: {
		float: "float",
		double: "double",
	},
	string: {
		"byte": "byte",
		"binary": "binary",
		"date": "date",
		"date-time": "dateTime",
		"password": "password",
	},
};

/**
 * Transform data types into common names
 * @param {Schema} schema
 * @return {String}
 */
const dataTypeResolver = (schema: Schema): string => {
	if (schema.allOf) {
		return schema.allOf
			.map((subSchema) => dataTypeResolver(subSchema))
			.filter((type: any) => type !== "")
			.join(" & ");
	}

	if (schema.ref) {
		const name = schema.ref.match(/\/([^/]*)$/i)?.[1];
		if (name) {
			const link = anchor(name);
			return `[${name}](#${link})`;
		}
	}

	if (schema.type && schema.type in resolver) {
		if (schema.format) {
			return schema.format in resolver[schema.type] ? resolver[schema.type][schema.format] : `${schema.type} (${schema.format})`;
		}
		return schema.type;
	}

	if (schema.format) {
		return `${schema.type} (${schema.format})`;
	}

	if (schema.type === "array" && schema.items) {
		const subType = dataTypeResolver(schema.items);
		return `[ ${subType} ]`;
	}

	if (schema.type) {
		return schema.type;
	}

	return "";
};

export default dataTypeResolver;
