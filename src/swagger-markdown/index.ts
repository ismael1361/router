import swaggerJSDoc from "swagger-jsdoc";

import transformInfo from "./transformers/info";
import transformExternalDocs from "./transformers/externalDocs";
import transformSecurityDefinitions from "./transformers/securityDefinitions";
import transformPath, { ALLOWED_METHODS } from "./transformers/path";
import transformDefinition from "./transformers/definitions";
import inArray from "./lib/inArray";
import { RequestHandler } from "express";

import fs from "fs";
import path from "path";

export const convert = (options: swaggerJSDoc.Options) => {
	const inputDoc: swaggerJSDoc.SwaggerDefinition = swaggerJSDoc(options) as any;

	const document: Array<string | null> = [];

	if (inputDoc.info) {
		document.push(transformInfo(inputDoc.info));
	}

	if (inputDoc.externalDocs) {
		document.push(transformExternalDocs(inputDoc.externalDocs));
	}

	// Security definitions
	if (inputDoc.securityDefinitions) {
		document.push(transformSecurityDefinitions(inputDoc.securityDefinitions));
	}

	// Process Paths
	if (inputDoc.paths) {
		document.push("## Summary\n");

		for (const path in inputDoc.paths) {
			if (inputDoc.paths[path].summary) {
				document.push(`* [${inputDoc.paths[path].summary}](#${path})`);
			} else {
				document.push(`* [${path}](#${path})`);
			}

			for (const method in inputDoc.paths[path]) {
				if (inArray(method, ALLOWED_METHODS)) {
					if (inputDoc.paths[path][method].summary) {
						document.push(`  * [${method.toUpperCase()} - ${inputDoc.paths[path][method].summary}](#${path}-${method})`);
					} else {
						document.push(`  * [${method.toUpperCase()}](#${path}-${method})`);
					}
				}
			}
		}

		Object.keys(inputDoc.paths).forEach((path) => document.push(transformPath(path, inputDoc.paths![path], {})));
	}
	// Models (definitions)
	if (inputDoc.definitions) {
		document.push("\n---\n\n");
		document.push(transformDefinition(inputDoc.definitions));
	}

	return document.length ? document.filter((v) => typeof v === "string").join("\n") : "";
};

export const setup = (swagger: swaggerJSDoc.Options): RequestHandler => {
	return async (req, res) => {
		const content = `<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8">
        <title></title>
        <script type="importmap">
            {
                "imports": {
                    "remark": "https://esm.sh/remark?bundle",
                    "remark-parse": "https://esm.sh/remark-parse?bundle",
                    "remark-directive": "https://esm.sh/remark-directive?bundle",
                    "remark-frontmatter": "https://esm.sh/remark-frontmatter?bundle",
                    "remark-gfm": "https://esm.sh/remark-gfm?bundle",
                    "remark-math": "https://esm.sh/remark-math?bundle",
                    "remark-rehype": "https://esm.sh/remark-rehype?bundle",
                    "rehype-format": "https://esm.sh/rehype-format?bundle",
                    "rehype-raw": "https://esm.sh/rehype-raw?bundle",
                    "rehype-sanitize": "https://esm.sh/rehype-sanitize?bundle",
                    "rehype-stringify": "https://esm.sh/rehype-stringify?bundle",
                    "remark-heading-id": "https://esm.sh/remark-heading-id?bundle",
                    "rehype-pretty-code": "https://esm.sh/rehype-pretty-code?bundle"
                }
            }
        </script>
        <style>${fs.readFileSync(path.join(__dirname, "style.css"), "utf8")}</style>
    </head>
    <body>
        <div class="markdown-body" id="content"></div>
        <script type="module">
            import { remark } from 'remark';
            import remarkParse from 'remark-parse';
            import remarkDirective from "remark-directive";
            import remarkFrontmatter from 'remark-frontmatter';
            import remarkGfm from "remark-gfm";
            import remarkMath from "remark-math";
            import remarkRehype from 'remark-rehype';
            import rehypeFormat from "rehype-format";
            import rehypeRaw from "rehype-raw";
            import rehypeSanitize from "rehype-sanitize";
            import rehypeStringify from 'rehype-stringify';
            import remarkHeadingId from "remark-heading-id";
            import rehypePrettyCode from 'rehype-pretty-code';

            remark()
                .use(remarkHeadingId, { defaults: true, prefix: '' })
                .use(remarkParse)
                .use(remarkDirective)
                .use(remarkFrontmatter)
                .use(remarkGfm)
                .use(remarkMath)
                .use(remarkRehype, {allowDangerousHtml: true})
                .use(rehypePrettyCode, {
                    theme: 'github-dark', // Temas: 'github-light', 'vesper', etc.
                    keepBackground: false,
                })
                .use(rehypeRaw)
                .use(rehypeFormat)
                .use(rehypeStringify)
                .process(\`${convert(swagger)}\`)
                .then((result) => {
                    document.getElementById("content").innerHTML = result.toString();
                });
        </script>
    </body>
</html>`;

		res.setHeader("Content-Type", "text/html");
		res.send(Buffer.from(content, "utf8"));
	};
};

export default { convert, setup };
