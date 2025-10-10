# @ismael1361/router

Esse módulo foi criado para preparar e centralizar rotas em um Express.js com tipagem encadeada, útil para tipar conteúdo de escobo e propriedades de requisição como `body`, `params` e `query`. Também oferece a geração de documentação OpenAPI/Swagger integrada.

## Instalação

```bash
npm install @ismael1361/router
# ou
yarn add @ismael1361/router
```

---

## Indice

- [@ismael1361/router](#ismael1361router)
  - [Instalação](#instalação)
  - [Indice](#indice)
  - [`create`](#create)
    - [Parâmetros](#parâmetros)
    - [Retorno](#retorno)
    - [Exemplo de Uso](#exemplo-de-uso)
  - [`middleware`](#middleware)
    - [Parâmetros](#parâmetros-1)
    - [Retorno](#retorno-1)
    - [Exemplo de Uso](#exemplo-de-uso-1)
  - [`route`](#route)
    - [Parâmetros](#parâmetros-2)
    - [Retorno](#retorno-2)
    - [Exemplo de Uso](#exemplo-de-uso-2)
  - [`Router`](#router)
    - [Propriedades da Instância](#propriedades-da-instância)
      - [`router`](#router-1)
      - [`routes`](#routes)
    - [Métodos da Instância](#métodos-da-instância)
      - [`get`](#get)
      - [`post`](#post)
      - [`put`](#put)
      - [`delete`](#delete)
      - [`patch`](#patch)
      - [`options`](#options)
      - [`head`](#head)
      - [`all`](#all)
      - [`use`](#use)
      - [`route`](#route-1)
      - [`middleware`](#middleware-1)
      - [`handler`](#handler)
      - [`by`](#by)
      - [`getSwagger`](#getswagger)

## `create`

```typescript
create<Req extends Request, Res extends Response>(app?: express.Express | express.Router): Router<Req, Res>;
```

A função `create` é o ponto de partida para a criação de rotas. Ela inicializa uma instância de um roteador aprimorado que pode ser anexado a uma aplicação Express existente ou usado de forma independente.

Este roteador oferece uma API fluente e fortemente tipada para definir rotas, ao mesmo tempo que integra a geração de documentação OpenAPI (Swagger).

### Parâmetros

- `app` (opcional): Uma instância de uma aplicação `Express` ou `Router` do Express. Se fornecido, o novo roteador será montado diretamente nesta instância.

### Retorno

Retorna uma nova instância do `Router`, que possui métodos encadeáveis (`.get()`, `.post()`, etc.) para a definição de rotas com metadados para a documentação.

### Exemplo de Uso

```typescript
import express from 'express';
import { create, Request, Response } from '@ismael1361/router';

// 1. (Opcional) Estenda os tipos de Request e Response se precisar de propriedades customizadas
interface CustomRequest extends Request {
  user?: { id: string; name: string };
}

interface CustomResponse extends Response {
  // ... propriedades customizadas para a resposta
}

const app = express();

// 2. Crie a instância do roteador, passando a aplicação Express
const router = create<CustomRequest, CustomResponse>(app).middleware(express.json());

// 3. Defina as rotas usando a API fluente
router
  .get('/users/:id')
  .handle((req, res) => {
    // req.params.id é totalmente tipado aqui
    res.json({ id: req.params.id, name: 'John Doe' });
  }).doc({
    summary: 'Obter um usuário pelo ID',
    description: 'Retorna os detalhes de um usuário específico.',
    tags: ['Users'],
    params: {
      id: {
        description: 'ID do usuário',
        type: 'string',
        required: true,
      },
    },
    responses: {
      200: { description: 'Usuário encontrado' },
      404: { description: 'Usuário não encontrado' },
    },
  });

// O roteador já está montado na 'app' e as rotas estão ativas.
app.listen(3000, () => {
  console.log('Servidor rodando na porta 3000');
});
```

## `middleware`

```ts
middleware<Req extends Request, Res extends Response>(
  callback: MiddlewareFC<Req, Res>,
  doc?: MiddlewareFCDoc
): MiddlewareFC<Req, Res>;
```

A função `middleware` é um wrapper que permite criar middlewares reutilizáveis para o Express, enriquecendo-os com metadados para a documentação OpenAPI (Swagger).

Ao envolver sua lógica de middleware com esta função, você pode definir como ele deve ser documentado (ex: quais cabeçalhos ele espera, quais respostas de erro ele pode retornar). Quando este middleware é aplicado a uma rota, sua documentação é automaticamente mesclada com a documentação da rota.

### Parâmetros

- `callback`: A função de middleware padrão do Express, com a assinatura `(req, res, next)`. É aqui que a lógica do seu middleware (autenticação, logging, etc.) reside.
- `doc` (opcional): Um objeto que descreve o middleware para a documentação OpenAPI. É útil para documentar requisitos globais como autenticação.

### Retorno

Retorna a própria função de `callback` do middleware, mas com os metadados da documentação anexados a ela. Isso permite que o roteador a utilize tanto como um middleware funcional quanto como uma fonte de documentação.

### Exemplo de Uso

Vamos criar e usar um middleware de autenticação que verifica um token no cabeçalho `Authorization`.

```typescript
import express from 'express';
import { create, middleware, Request, Response } from '@ismael1361/router';

interface AuthRequest extends Request {
  user: { id: string; roles: string[] };
}

// 1. Crie o middleware de autenticação com sua documentação
const isAuthenticated = middleware<AuthRequest>(
  (req, res, next) => {
    const token = req.headers.authorization;
    if (token === 'Bearer meu-token-secreto') {
      req.user = { id: '123', roles: ['admin', 'user'] };
      return next(); // Token válido, continue
    }
    res.status(401).json({ message: 'Não autorizado' });
  },
  {
    // 2. Documente os requisitos e possíveis respostas do middleware
    security: [{ bearerAuth: [] }], // Indica que a rota requer autenticação Bearer
    responses: {
      401: { description: 'Token de autenticação inválido ou não fornecido' },
    },
  }
);

const app = express();
const router = create(app);

// 3. Aplique o middleware a uma rota específica
router
  .get('/profile')
  .middleware(isAuthenticated) // O middleware é aplicado aqui
  .handle((req, res) => {
    res.json({ user: req.user });
  }).doc({
    summary: 'Obter perfil do usuário',
    description: 'Acessa informações do usuário autenticado. Requer um token válido.',
    tags: ['Users'],
    responses: {
      200: { description: 'Perfil do usuário' },
    },
  });

// A documentação OpenAPI gerada para a rota GET /profile agora incluirá
// automaticamente as seções 'security' e a resposta '401' definidas no middleware.

app.listen(3000, () => console.log('Servidor rodando na porta 3000'));
```

## `route`

```ts
route<Req extends Request, Res extends Response>(path: string): Router<Req, Res>;
```

A função `route` cria uma instância de rota encadeável para um caminho (path) específico. Isso permite agrupar múltiplos métodos HTTP (como GET, POST, PUT, etc.) para o mesmo endpoint de URL, o que é uma prática comum para organizar APIs RESTful.

Ao invés de definir `router.get('/tasks', ...)` e `router.post('/tasks', ...)` separadamente, você pode agrupar ambos sob `router.route('/tasks')`.

### Parâmetros

- `path`: A string do caminho da URL para a qual a rota será criada.

### Retorno

Retorna uma nova instância do `Router` que está "travada" no `path` especificado. Você pode então encadear os métodos HTTP (`.get()`, `.post()`, etc.) diretamente a esta instância.

### Exemplo de Uso

Vamos criar um endpoint `/tasks` que lida com a listagem (GET) e a criação (POST) de tarefas.

```typescript
import express from 'express';
import { route, Request, Response } from '@ismael1361/router';

const app = express();
const main = create(app).middleware(express.json());

// 1. Crie uma rota para o caminho '/tasks'
const router = route('/tasks');

// 2. Defina o handler para o método GET nesta rota
router
  .get("/items")
  .handle((req, res) => {
    res.json([{ id: 1, title: 'Aprender a usar o @ismael1361/router' }]);
  }).doc({
    summary: 'Listar todas as tarefas',
    tags: ['Tasks'],
    responses: { 200: { description: 'Lista de tarefas' } },
  });

// 3. Defina o handler para o método POST na mesma rota
router
  .post("item")
  .handle((req, res) => {
    const newTask = req.body;
    res.status(201).json({ id: 2, ...newTask });
  }).doc({
    summary: 'Criar uma nova tarefa',
    tags: ['Tasks'],
    body: { description: 'Dados da nova tarefa' },
    responses: { 201: { description: 'Tarefa criada com sucesso' } },
  });

// 4. Adicione a rota ao roteador principal
main.by(router);
// ou diretamente ao app
// app.use(router.router);

app.listen(3000, () => console.log('Servidor rodando na porta 3000'));
```

## `Router`

```ts
Router<Rq extends Request, Rs extends Response>;
```

A classe `Router` é o principal objeto com o qual você irá interagir. Ela encapsula o roteador do Express, fornecendo uma API encadeável e fortemente tipada para definir rotas, aplicar middlewares e gerar documentação OpenAPI.

Uma instância do `Router` é retornada pela função `create` ou pelo método `.route()`.

### Propriedades da Instância

#### `router`

```ts
.router: express.Router;
```

A instância do roteador do Express. Usada internamente para definir rotas e middlewares.

#### `routes`

```ts
.routes: Array<{
    path: string;
    methods: string[];
    type: "ROUTE" | "MIDDLEWARE";
    swagger?: Pick<swaggerJSDoc.OAS3Definition, "paths" | "components">;
}>;
```

Um array que armazena as rotas e middlewares definidos na instância. Essas rotas e middlewares serão usadas para gerar a documentação OpenAPI.

### Métodos da Instância

#### `get`

```ts
.get(path: string): RequestHandler<Rq, Rs>;
```

Registra uma rota que responde a requisições HTTP do método GET. Este método é o ponto de partida para definir um endpoint que recupera dados.

Após chamar `.get()`, você deve encadear o método `.handle()` para fornecer a lógica do controlador e, opcionalmente, o método `.doc()` para adicionar a documentação OpenAPI.

* Parâmetros
  - `path` (string): A string do caminho da URL para a rota. O caminho é relativo ao prefixo do roteador. Pode conter parâmetros de rota, como `/users/:id`.

* Retorno
    Retorna uma instância de `RequestHandler`, que é um objeto intermediário com os seguintes métodos encadeáveis:
  - `.middleware()`: Para aplicar middlewares específicos a esta rota.
  - `.handle()`: Para definir a função controladora que processará a requisição.
  - `.doc()`: Para fornecer metadados de documentação OpenAPI para a rota.

* Exemplo de Uso
```typescript
import express from 'express';
import { create, Request, Response } from '@ismael1361/router';

const app = express();
const router = create(app);

// Exemplo 1: Rota GET simples
router
  .get('/status')
  .handle((req, res) => {
    res.json({ status: 'ok' });
  })
  .doc({
    summary: 'Verificar o status da API',
    tags: ['Health'],
    responses: {
      200: { description: 'A API está funcionando corretamente' },
    },
  });

// Exemplo 2: Rota GET com parâmetros
router
  .get('/users/:id')
  .handle((req, res) => {
    // 'req.params.id' é totalmente tipado como string
    const userId = req.params.id;
    // Lógica para buscar o usuário...
    res.json({ id: userId, name: 'Usuário Exemplo' });
  })
  .doc({
    summary: 'Obter um usuário pelo ID',
    tags: ['Users'],
    params: { id: { description: 'ID do usuário', type: 'string', required: true } },
    responses: { 200: { description: 'Dados do usuário' }, 404: { description: 'Usuário não encontrado' } },
  });

app.listen(3000, () => console.log('Servidor rodando na porta 3000'));
```

#### `post`

```ts
.post(path: string): RequestHandler<Rq, Rs>;
```

Registra uma rota que responde a requisições HTTP do método POST. Este método é comumente utilizado para **criar novos recursos** no servidor.

Após chamar `.post()`, você deve encadear o método `.handle()` para fornecer a lógica do controlador (que geralmente acessa `req.body`) e, opcionalmente, o método `.doc()` para documentar o corpo da requisição e as possíveis respostas.

* Parâmetros
  - `path` (string): A string do caminho da URL para a rota.

* Retorno
    Retorna uma instância de `RequestHandler` para encadeamento dos métodos `.middleware()`, `.handle()` e `.doc()`.

* Exemplo de Uso
```typescript
import express from 'express';
import { create, Request, Response } from '@ismael1361/router';

const app = express();
// É essencial usar um middleware para parsear o corpo da requisição JSON
const router = create(app).middleware(express.json());

router
  .post('/users')
  .handle((req, res) => {
    // req.body contém os dados enviados pelo cliente
    const newUser = req.body;
    // Lógica para salvar o novo usuário no banco de dados...
    const createdUser = { id: Date.now().toString(), ...newUser };
    res.status(201).json(createdUser);
  })
  .doc({
    summary: 'Criar um novo usuário',
    tags: ['Users'],
    body: {
      description: 'Dados do novo usuário a ser criado.',
      required: true,
      // Você pode fornecer um schema para o corpo da requisição
      schema: {
        type: 'object',
        properties: {
          name: { type: 'string', example: 'Jane Doe' },
          email: { type: 'string', example: 'jane.doe@example.com' },
        },
        required: ['name', 'email'],
      },
    },
    responses: {
      201: { description: 'Usuário criado com sucesso' },
      400: { description: 'Dados inválidos fornecidos' },
    },
  });

app.listen(3000, () => console.log('Servidor rodando na porta 3000'));
```

#### `put`

```ts
.put(path: string): RequestHandler<Rq, Rs>;
```

Registra uma rota que responde a requisições HTTP do método PUT. Este método é usado para **substituir completamente um recurso existente** com os novos dados fornecidos no corpo da requisição.

* Parâmetros
  - `path` (string): O caminho da URL, geralmente contendo um parâmetro para identificar o recurso a ser atualizado (ex: `/users/:id`).

* Retorno
    Retorna uma instância de `RequestHandler` para encadeamento.

* Exemplo de Uso
```typescript
import express from 'express';
import { create, Request, Response } from '@ismael1361/router';

const app = express();
const router = create(app).middleware(express.json());

router
  .put('/users/:id')
  .handle((req, res) => {
    const { id } = req.params;
    const updatedData = req.body;
    // Lógica para substituir o usuário com o ID fornecido...
    res.json({ id, ...updatedData });
  })
  .doc({
    summary: 'Atualizar um usuário (substituição completa)',
    tags: ['Users'],
    params: { id: { description: 'ID do usuário a ser atualizado', type: 'string', required: true } },
    body: { description: 'Dados completos do usuário para substituição.' },
    responses: {
      200: { description: 'Usuário atualizado com sucesso' },
      404: { description: 'Usuário não encontrado' },
    },
  });

app.listen(3000, () => console.log('Servidor rodando na porta 3000'));
```

#### `delete`

```ts
.delete(path: string): RequestHandler<Rq, Rs>;
```

Registra uma rota que responde a requisições HTTP do método DELETE. Este método é utilizado para **remover um recurso específico**.

* Parâmetros
  - `path` (string): O caminho da URL, que deve conter um parâmetro para identificar o recurso a ser removido (ex: `/items/:id`).

* Retorno
    Retorna uma instância de `RequestHandler` para encadeamento.

* Exemplo de Uso
```typescript
import express from 'express';
import { create, Request, Response } from '@ismael1361/router';

const app = express();
const router = create(app);

router
  .delete('/items/:id')
  .handle((req, res) => {
    const { id } = req.params;
    // Lógica para deletar o item do banco de dados...
    console.log(`Item ${id} deletado.`);
    // Uma boa prática é retornar 204 (No Content) em caso de sucesso.
    res.status(204).send();
  })
  .doc({
    summary: 'Deletar um item',
    tags: ['Items'],
    params: { id: { description: 'ID do item a ser deletado', type: 'string', required: true } },
    responses: {
      204: { description: 'Item deletado com sucesso' },
      404: { description: 'Item não encontrado' },
    },
  });

app.listen(3000, () => console.log('Servidor rodando na porta 3000'));
```

#### `patch`

```ts
.patch(path: string): RequestHandler<Rq, Rs>;
```

Registra uma rota que responde a requisições HTTP do método PATCH. É usado para aplicar **atualizações parciais** a um recurso, modificando apenas os campos enviados no corpo da requisição.

* Parâmetros
  - `path` (string): O caminho da URL, geralmente com um parâmetro para identificar o recurso (ex: `/tasks/:id`).

* Retorno
    Retorna uma instância de `RequestHandler` para encadeamento.

* Exemplo de Uso
```typescript
import express from 'express';
import { create, Request, Response } from '@ismael1361/router';

const app = express();
const router = create(app).middleware(express.json());

router
  .patch('/tasks/:id')
  .handle((req, res) => {
    const { id } = req.params;
    const partialUpdates = req.body; // ex: { "completed": true }
    // Lógica para aplicar a atualização parcial na tarefa...
    res.json({ id, message: 'Tarefa atualizada parcialmente.', changes: partialUpdates });
  })
  .doc({
    summary: 'Atualizar uma tarefa (parcialmente)',
    tags: ['Tasks'],
    params: { id: { description: 'ID da tarefa', type: 'string', required: true } },
    body: { description: 'Campos da tarefa a serem atualizados.' },
    responses: {
      200: { description: 'Tarefa atualizada' },
      404: { description: 'Tarefa não encontrada' },
    },
  });

app.listen(3000, () => console.log('Servidor rodando na porta 3000'));
```

#### `options`

```ts
.options(path: string): RequestHandler<Rq, Rs>;
```

Registra uma rota que responde a requisições HTTP do método OPTIONS. Este método é usado pelo navegador para determinar as opções de comunicação para um recurso de destino, principalmente em requisições de **pré-voo (pre-flight) do CORS**.

* Parâmetros
  - `path` (string): O caminho da URL do recurso.

* Retorno
    Retorna uma instância de `RequestHandler` para encadeamento.

* Exemplo de Uso
```typescript
import express from 'express';
import { create, Request, Response } from '@ismael1361/router';

const app = express();
const router = create(app);

// Para um recurso específico, informa quais métodos são permitidos
router
  .options('/articles/:id')
  .handle((req, res) => {
    res.header('Access-Control-Allow-Methods', 'GET, PUT, DELETE');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).send();
  })
  .doc({
    summary: 'Verificar opções de comunicação para um artigo',
    tags: ['Articles'],
    responses: {
      204: { description: 'Sucesso. Os métodos permitidos estão nos cabeçalhos de resposta.' },
    },
  });

app.listen(3000, () => console.log('Servidor rodando na porta 3000'));
```

#### `head`

```ts
.head(path: string): RequestHandler<Rq, Rs>;
```

Registra uma rota que responde a requisições HTTP do método HEAD. É idêntico ao GET, mas o servidor **não envia o corpo da resposta**. É útil para verificar metadados de um recurso, como `Content-Length` ou `Last-Modified`, sem precisar baixar o conteúdo completo.

* Parâmetros
  - `path` (string): O caminho da URL do recurso.

* Retorno
    Retorna uma instância de `RequestHandler` para encadeamento.

* Exemplo de Uso
```typescript
import express from 'express';
import { create, Request, Response } from '@ismael1361/router';

const app = express();
const router = create(app);

// O Express lida com HEAD automaticamente se você tiver uma rota GET correspondente.
// No entanto, você pode definir um handler específico se precisar de lógica customizada.
router
  .head('/large-file.zip')
  .handle((req, res) => {
    // Lógica para obter o tamanho do arquivo sem lê-lo
    const fileSize = 104857600; // 100 MB
    res.header('Content-Length', fileSize.toString());
    res.status(200).send(); // O corpo é omitido pelo Express
  })
  .doc({
    summary: 'Obter metadados de um arquivo',
    tags: ['Files'],
    responses: {
      200: { description: 'Metadados do arquivo nos cabeçalhos.' },
      404: { description: 'Arquivo não encontrado.' },
    },
  });

app.listen(3000, () => console.log('Servidor rodando na porta 3000'));
```

#### `all`

```ts
.all(path: string): RequestHandler<Rq, Rs>;
```

Registra uma rota que responde a **todos os métodos HTTP** (GET, POST, PUT, etc.) para um caminho específico. É útil para aplicar lógica genérica a um endpoint, como logging ou validações que independem do método.

* Parâmetros
  - `path` (string): O caminho da URL.

* Retorno
    Retorna uma instância de `RequestHandler` para encadeamento.

* Exemplo de Uso
```typescript
import express from 'express';
import { create, Request, Response } from '@ismael1361/router';

const app = express();
const router = create(app);

router
  .all('/secret-data')
  .handle((req, res) => {
    // Este handler será executado para GET, POST, DELETE, etc. em '/secret-data'
    console.log(`Requisição ${req.method} recebida em /secret-data`);
    res.status(403).send('Acesso negado a este endpoint.');
  })
  .doc({
    summary: 'Endpoint genérico de captura',
    tags: ['Utils'],
    description: 'Este endpoint responde a todos os métodos HTTP com uma mensagem padrão.',
    responses: {
      403: { description: 'Acesso sempre negado.' },
    },
  });

app.listen(3000, () => console.log('Servidor rodando na porta 3000'));
```

#### `use`

```ts
.use(path: string): Router<Rq, Rs>;
```

Monta uma função de middleware ou uma série de middlewares em um caminho específico. Diferente dos métodos de rota (GET, POST, etc.), `use` é projetado para interceptar requisições e executar código **antes** que elas cheguem ao handler final da rota.

É ideal para tarefas como logging, parsing de corpo de requisição, autenticação e tratamento de erros. Se nenhum caminho for especificado, o middleware será aplicado a todas as rotas definidas no roteador.

* Parâmetros
  - `path` (opcional): O caminho no qual o middleware será aplicado. Suporta wildcards (ex: `/api/*`).

* Retorno
    Retorna a própria instância do `Router`, permitindo o encadeamento de mais definições.

* Exemplo de Uso
```typescript
import express from 'express';
import { create, Request, Response, NextFunction } from '@ismael1361/router';

const app = express();
const router = create(app);

// Aplica o middleware no caminho /api
router.use('/api').handle((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next(); // Passa o controle para o próximo middleware ou handler
});

// Define uma rota dentro do escopo do middleware
router
  .get('/api/status')
  .handle((req, res) => {
    res.json({ status: 'ok' });
  });

// Uma requisição para GET /api/status irá primeiro executar o loggerMiddleware.

app.listen(3000, () => console.log('Servidor rodando na porta 3000'));
```

#### `route`

```ts
.route(path: string): Router<Rq, Rs>;
```

Cria e retorna uma nova instância de `Router` que é montada sob um caminho (prefixo) específico. É uma maneira poderosa de agrupar um conjunto de rotas relacionadas sob um namespace comum, promovendo a organização e a modularidade do código.

Todas as rotas definidas no roteador retornado serão relativas ao `path` fornecido.

* Parâmetros
  - `path` (string): O caminho do prefixo para o novo roteador. Por exemplo, `/api/v1`.

* Retorno
    Retorna uma nova instância de `Router` que pode ser usada para definir um grupo de rotas.

* Exemplo de Uso
```typescript
import express from 'express';
import { create, Request, Response } from '@ismael1361/router';

const app = express();
const mainRouter = create(app);

// 1. Crie um sub-roteador para os endpoints de usuários
const usersRouter = mainRouter.route('/users');

// 2. Defina as rotas neste sub-roteador. Os caminhos são relativos a '/users'.
usersRouter
  .get('/')
  .handle((req, res) => {
    // Este handler responde a GET /users
    res.json([{ id: '1', name: 'Alice' }]);
  })
  .doc({ summary: 'Listar todos os usuários', tags: ['Users'] });

usersRouter
  .get('/:id')
  .handle((req, res) => {
    // Este handler responde a GET /users/:id
    res.json({ id: req.params.id, name: 'Alice' });
  })
  .doc({ summary: 'Obter um usuário pelo ID', tags: ['Users'] });

// O mainRouter já está conectado ao 'app', então as rotas estão ativas.
app.listen(3000, () => console.log('Servidor rodando na porta 3000'));
```

#### `middleware`

```ts
.middleware<Req extends Request, Res extends Response>(callback: MiddlewareFC<Req, Res>): Router<Rq & Req, Rs & Res>;
```

Aplica uma função de middleware a **todas as rotas subsequentes** definidas nesta instância do roteador. É o método ideal para aplicar middlewares que devem ser executados para um grupo de endpoints, como parsing de corpo de requisição (`express.json()`) ou autenticação.

A tipagem do `Request` e `Response` é inteligentemente mesclada, garantindo que as propriedades adicionadas por um middleware (ex: `req.user`) estejam disponíveis e corretamente tipadas nos handlers das rotas.

* Parâmetros
  - `callbacks`: Uma função de middleware do Express.

* Retorno
    Retorna a própria instância do `Router`, com os tipos de `Request` e `Response` atualizados, permitindo o encadeamento contínuo.

* Exemplo de Uso
```typescript
import express from 'express';
import { create, middleware, Request, Response, NextFunction } from '@ismael1361/router';

interface AuthRequest extends Request {
  user?: { id: string };
}

const app = express();

// Middleware de autenticação simples
const authMiddleware = middleware<AuthRequest>((req, res, next) => {
  req.user = { id: 'user-123' };
  next();
});

// 1. Crie o roteador e aplique middlewares globais a ele
const router = create<AuthRequest>(app)
  .middleware(express.json());

// 2. Todas as rotas definidas a partir daqui terão acesso a `req.body` e `req.user`
router
  .get('/profile')
  .middleware(authMiddleware)
  .handle((req, res) => {
    // req.user é totalmente tipado como { id: string }
    res.json({ profile: req.user });
  });

app.listen(3000, () => console.log('Servidor rodando na porta 3000'));
```

#### `handler`

```ts
.handler<Req extends Request, Res extends Response>(callback: HandlerFC<Req, Res>): PreparedHandler<Rq & Req, Rs & Res>;
```

Define a função controladora (handler) que processará a requisição para uma rota ou middleware específico. Este método é o coração da sua rota, onde a lógica de negócios é executada.

Ele deve ser encadeado após a definição de um método HTTP (como `.get()`, `.post()`) ou de um middleware (`.use()`). A função de `callback` recebe os objetos `req` e `res`, que são fortemente tipados com base nos middlewares aplicados anteriormente.

* Parâmetros
  - `callback`: A função controladora que processará a requisição, com a assinatura `(req, res, next)`.

* Retorno
    Retorna uma instância de `PreparedHandler`, que permite encadear o método `.doc()` para adicionar a documentação OpenAPI.

* Exemplo de Uso
```typescript
import express from 'express';
import { create, Request, Response, NextFunction } from '@ismael1361/router';

const app = express();
const router = create(app);

// Exemplo 1: Handler para uma rota GET
router
  .get('/status')
  .handler((req, res) => {
    res.json({ status: 'ok' });
  });

// Exemplo 2: Handler para um middleware
router.use('/api').handler((req, res, next) => {
  console.log('Requisição recebida na API');
  next(); // Passa para o próximo handler
});

app.listen(3000, () => {
  console.log('Servidor rodando na porta 3000');
  console.log('Acesse /status ou /health-check');
});
```

#### `by`

```ts
.by(router: ExpressRouter | Router<Request, Response>): this;
```

#### `getSwagger`

```ts
.getSwagger(options?: swaggerJSDoc.OAS3Definition, defaultResponses?: swaggerJSDoc.Responses): swaggerJSDoc.Options;
```