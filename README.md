# Admin Catálogo

Painel administrativo para o catálogo de peças Fios na Areia, construído com Next.js App Router, React e TypeScript.

## Desenvolvimento

```bash
npm run dev
```

## API e configuração

O servidor usa a conexão PostgreSQL configurada em `DATABASE` (somente server-side) e expõe:

- `GET /api/products` — lista as peças;
- `POST /api/products` — cria uma peça;
- `PATCH /api/products/:id` — atualiza campos enviados;
- `DELETE /api/products/:id` — exclui a peça.

As rotas usam as colunas existentes `id`, `"productName"`, `price`, `description`, `images` e `category` da tabela `products`. Listagem não exige token; as operações de escrita exigem `ADMIN_API_TOKEN` no servidor e o mesmo token deve ser informado no campo do painel. O token digitado permanece apenas na memória da página e não é registrado em logs.

O esquema atual aceita uma URL em `images`. A interface permite cadastrar ou remover essa URL, mas upload de arquivos e várias imagens por peça precisam de armazenamento e alteração compatível do esquema e do catálogo público. As categorias encontradas não têm enumeração oficial, então as opções existentes são preservadas na edição.

Não há gravação simulada nem acesso do navegador ao banco de dados. Configure `DATABASE` e `ADMIN_API_TOKEN` no ambiente do servidor; não use prefixo `NEXT_PUBLIC_` nem inclua valores secretos no repositório.

## Verificação

```bash
npm run lint
npm run build
```
