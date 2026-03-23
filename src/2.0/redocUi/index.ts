import swaggerJSDoc from "swagger-jsdoc";
import path from "path";
import fs from "fs";
import { RequestHandler } from "express";

export const setup = (swagger: swaggerJSDoc.Options): RequestHandler => {
	return async (req, res) => {
		if (req.url.endsWith("openapisnippet.min.js")) {
			const snippet = fs.readFileSync(path.resolve(__dirname, "../../resources/openapisnippet.min.js"), "utf-8");
			res.setHeader("Content-Type", "application/javascript");
			res.send(Buffer.from(snippet, "utf8"));
			return;
		}

		const content = `<!DOCTYPE html>
<html lang="en">
    <head>
        <meta charset="UTF-8">
        <title></title>
        <style>
            body {
                margin:0;
            }
        </style>
    </head>
    <body>
    <div id="redoc-container"></div>
    <script src="${req.originalUrl.replace(/(\/+)$/gi, "")}/openapisnippet.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/redoc@2.4.0/bundles/redoc.standalone.js"></script>
    <script>
        const schema = ${JSON.stringify(swagger.definition)};

        if(schema.info && schema.info.title && typeof schema.info.title === "string"){
            document.title = schema.info.title;
        }

        const targets = {
            "shell_curl": "Shell", 
            "shell_httpie": "Shell",
            "node_request": "JavaScript", 
            "python_python3": "Python", 
            "php_curl": "PHP",
            "php_http1": "PHP", 
            "php_http2": "PHP"
        };
  
        for(var path in schema.paths){
            for(var method in schema.paths[path]){
                var generatedCode = OpenAPISnippets.getEndpointSnippets(schema, path, method, Object.keys(targets));
                schema.paths[path][method]["x-codeSamples"] = [];
                for(var snippetIdx in generatedCode.snippets){
                    var snippet = generatedCode.snippets[snippetIdx];
                    schema.paths[path][method]["x-codeSamples"][snippetIdx] = { "lang": targets[snippet.id], "label": snippet.title, "source": snippet.content };
                }
            }
        }

        Redoc.init(
            schema,
            {
                scrollYOffset: 'nav',
                hideDownloadButton: true,
                schemaExpansionLevel: 3,
                showObjectSchemaExamples: true
            },
            document.getElementById('redoc-container')
        );
    </script>
    </body>
</html>`;

		res.setHeader("Content-Type", "text/html");
		res.send(Buffer.from(content, "utf8"));
	};
};
