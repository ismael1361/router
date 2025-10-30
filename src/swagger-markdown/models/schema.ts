import type swaggerJSDoc from "swagger-jsdoc";

class Schema {
	__type__: string | undefined;
	__format__: string | undefined;
	__ref__: string | undefined;
	__items__: Schema | undefined;
	__allOf__: Array<Schema> | undefined;

	/**
	 * constructor
	 *
	 * @param {Object} [schema=null]
	 */
	constructor(schema: swaggerJSDoc.Schema | null = null) {
		if (schema !== null) {
			if ("type" in schema) {
				this.type = schema.type;
			}
			if ("format" in schema) {
				this.format = schema.format;
			}
			if ("$ref" in schema) {
				this.ref = schema.$ref;
			}
			if ("items" in schema) {
				this.items = schema.items;
			}
			if ("allOf" in schema) {
				this.allOf = schema.allOf;
			}
		}
	}

	set type(type: string | undefined) {
		this.__type__ = type;
	}

	get type() {
		return this.__type__;
	}

	set allOf(allOf: Array<Schema> | undefined) {
		this.__allOf__ = allOf?.map((schema) => new Schema(schema));
	}

	get allOf() {
		return this.__allOf__;
	}

	set format(format: string | undefined) {
		this.__format__ = format;
	}

	get format() {
		return this.__format__;
	}

	set items(items: Schema | undefined) {
		this.__items__ = items ? new Schema(items) : undefined;
	}

	get items() {
		return this.__items__;
	}

	set reference(ref: string | undefined) {
		this.__ref__ = ref;
	}

	get reference() {
		return this.__ref__;
	}

	set ref(ref: string | undefined) {
		this.__ref__ = ref;
	}

	get ref() {
		return this.__ref__;
	}
}

export default Schema;
