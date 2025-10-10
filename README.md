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

## `create`

```typescript
create<Req extends Request, Res extends Response>(app?: e.Express | e.Router): Router<Req, Res>;
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