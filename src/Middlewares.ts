import { MiddlewareFC, Request, Response } from "./type";
import BodyParser, { OptionsJson, Options, OptionsText, OptionsUrlencoded } from "body-parser";

export const json = (options?: OptionsJson | undefined): MiddlewareFC<Request, Response> => {
	return BodyParser.json(options);
};

export const raw = (options?: Options): MiddlewareFC<Request, Response> => {
	return BodyParser.raw(options);
};

export const text = (options?: OptionsText): MiddlewareFC<Request, Response> => {
	return BodyParser.text(options);
};

export const urlencoded = (options?: OptionsUrlencoded): MiddlewareFC<Request, Response> => {
	return BodyParser.urlencoded(options);
};
