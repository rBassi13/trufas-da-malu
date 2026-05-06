# Documentação Técnica Completa - Trufas da Malu

Este documento detalha tecnicamente a estrutura, funcionamento, módulos, funções e mapeamento de arquivos do sistema "Trufas da Malu", um E-commerce baseado em PWA (Progressive Web App) com arquitetura Serverless hospedada na Cloudflare.

---

## 1. Mapeamento de Arquivos e Diretórios (Árvore do Projeto)

Abaixo encontra-se a árvore completa de diretórios e arquivos do projeto, com a explicação técnica do propósito de cada um:

```text
.
├── .gitignore                    # Arquivo que especifica arquivos/pastas intencionalmente não rastreados que o Git deve ignorar (ex: node_modules, build artifacts).
├── Documento.md                  # Documentação técnica detalhada do sistema (este arquivo).
├── LICENSE                       # Licença de código aberto do projeto.
├── README.md                     # Visão geral do projeto, instruções básicas, funcionalidades e links importantes.
├── backend                       # Diretório contendo a API RESTful e lógica de backend.
│   ├── dist                      # Diretório de artefatos de build do backend. Arquivos gerados não devem ser editados diretamente.
│   │   ├── README.md             # Instruções sobre o dist.
│   │   ├── index.js              # Código compilado/empacotado do Worker (resultado do build).
│   │   └── index.js.map          # Source map para debug do código compilado.
│   ├── package-lock.json         # Versões exatas das dependências instaladas no backend via npm.
│   ├── package.json              # Dependências do Node.js para o backend, incluindo `@pushforge/builder`.
│   ├── src                       # Código-fonte original do backend.
│   │   └── index.js              # Ponto de entrada do Cloudflare Worker. Contém o roteamento, integração com D1 e regras de negócio.
│   └── wrangler.toml             # Configurações do ambiente de deploy do Worker (binds do D1, variáveis de ambiente).
├── database                      # Diretório contendo os scripts SQL para banco de dados.
│   ├── schema.sql                # DDL (Data Definition Language). Define a estrutura do banco (tabelas e relacionamentos).
│   └── seed.sql                  # DML (Data Manipulation Language). Script com inserções iniciais (produtos base).
├── frontend                      # Diretório da aplicação web estática PWA.
│   ├── admin.html                # Interface HTML do painel administrativo (login, pedidos, estoque).
│   ├── index.html                # Interface HTML da loja voltada ao cliente final (catálogo, carrinho, checkout).
│   ├── manifest.json             # Manifesto Web App que define a aplicação como PWA instalável no dispositivo.
│   ├── sw.js                     # Service Worker. Script rodando em background para suporte offline, cache e recepção de notificações Push.
│   ├── assets                    # Diretório contendo mídia (imagens de produtos e ícones PWA).
│   │   ├── icon-192.png          # Ícone para PWA (resolução 192x192).
│   │   ├── icon-512.png          # Ícone para PWA (resolução 512x512).
│   │   └── trufa-*.png           # Imagens dos produtos individuais. Note o padrão `-g.png` usado para trufas gourmet.
│   ├── css                       # Diretório de folhas de estilo.
│   │   └── style.css             # Arquivo CSS principal da aplicação (Mobile First).
│   └── js                        # Diretório contendo os scripts do cliente (Vanilla JS).
│       ├── admin.js              # Lógica da interface do administrador (painel.html). Autenticação, controle de pedidos e de estoque.
│       └── app.js                # Lógica da interface do cliente (index.html). Renderização de catálogo, carrinho, checkout e promoção dinâmica.
├── guia.md                       # Tutorial e guia passo-a-passo detalhado para deploy da aplicação do zero na Cloudflare.
├── test-cors2.js                 # Arquivo auxiliar de script de teste para validar políticas de CORS.
├── test.db                       # Instância local do banco SQLite para testes e desenvolvimento.
└── wrangler.jsonc                # Arquivo de configuração alternativo e abrangente do wrangler para gerência do projeto Cloudflare no topo da hierarquia.
```

---

## 2. Banco de Dados (Cloudflare D1 - SQLite)

O sistema de persistência de dados utiliza SQLite via Cloudflare D1. Os arquivos relacionados estão no diretório `database/`.

### 2.1. Tabelas e Relacionamentos (`database/schema.sql`)

*   **`products` (Produtos)**
    *   **Função:** Armazena os itens disponíveis no catálogo do E-commerce.
    *   **Colunas:**
        *   `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
        *   `name` (TEXT NOT NULL)
        *   `description` (TEXT)
        *   `price` (REAL NOT NULL) - Preço base unitário.
        *   `stock` (INTEGER NOT NULL DEFAULT 0) - Quantidade em estoque.
        *   `image_url` (TEXT) - Caminho da imagem (ex: `/assets/trufa-nutella.png`).
        *   `is_gourmet` (BOOLEAN NOT NULL DEFAULT 0) - Flag de visualização especial (estrelas e borda).

*   **`customers` (Clientes)**
    *   **Função:** Armazena dados essenciais de clientes para não depender de um sistema complexo de senhas. A chave primária orgânica no sistema é o telefone.
    *   **Colunas:**
        *   `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
        *   `phone` (TEXT NOT NULL UNIQUE) - Usado como identificador para não duplicar usuários (WhatsApp).
        *   `name` (TEXT NOT NULL)

*   **`orders` (Pedidos)**
    *   **Função:** Armazena os registros de compras, vinculando ao cliente.
    *   **Colunas:**
        *   `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
        *   `customer_id` (INTEGER NOT NULL) - *Chave Estrangeira* (`customers.id`).
        *   `total_amount` (REAL NOT NULL) - Valor final pago com desconto de promoção aplicado.
        *   `payment_method` (TEXT NOT NULL) - 'pix', 'dinheiro' ou 'cartao'.
        *   `payment_status` (TEXT NOT NULL DEFAULT 'PENDING') - Pode ser 'PENDING' (pendente) ou 'PAID' (pago).
        *   `status` (TEXT NOT NULL DEFAULT 'NEW') - Estado da produção: 'NEW', 'PREPARING', 'READY', 'DELIVERED'.
        *   `created_at` (DATETIME DEFAULT CURRENT_TIMESTAMP)

*   **`order_items` (Itens do Pedido)**
    *   **Função:** Tabela de junção (N:N) que registra a quantidade e valor exato de cada produto por pedido.
    *   **Colunas:**
        *   `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
        *   `order_id` (INTEGER NOT NULL) - *Chave Estrangeira* (`orders.id`).
        *   `product_id` (INTEGER NOT NULL) - *Chave Estrangeira* (`products.id`).
        *   `quantity` (INTEGER NOT NULL)
        *   `price` (REAL NOT NULL) - Snapshot do preço do produto no momento do pedido.

*   **`push_subscriptions` (Assinaturas Push)**
    *   **Função:** Armazena os dados das sessões de navegação e as chaves de criptografia VAPID usadas para enviar notificações Web Push nativas para o cliente ou admin.
    *   **Colunas:**
        *   `id` (INTEGER PRIMARY KEY AUTOINCREMENT)
        *   `endpoint` (TEXT NOT NULL) - URL do servidor push do navegador.
        *   `p256dh` (TEXT NOT NULL) - Chave pública do cliente.
        *   `auth` (TEXT NOT NULL) - Segredo de autenticação.
        *   `user_type` (TEXT NOT NULL) - Define se o destinatário é 'admin' ou 'customer'.
        *   `customer_id` (INTEGER) - *Chave Estrangeira Opcional* (`customers.id`), preenchida caso `user_type` seja 'customer'.

### 2.2. Dados Iniciais (`database/seed.sql`)
O script preenche a tabela `products` com 18 variedades de trufas (Nutella, Cacau, Ferrero, etc), definindo `price` (4.00), `stock` inicial (50) e links relativos para `image_url` mapeando para os arquivos em `frontend/assets/`.

---

## 3. Backend e API (Cloudflare Worker)

**Arquivo principal:** `backend/src/index.js`
Esta API em JavaScript atende todas as requisições HTTP do frontend e interage com o Cloudflare D1 através do binding `env.DB`.

### 3.1. Funções de Roteamento Base e Utilidades
*   **`fetch(request, env, ctx)`**: Ponto de entrada padrão (handler) da aplicação Worker. Trata os cabeçalhos CORS, responde ao preflight de `OPTIONS`, e roteia as requisições HTTP baseadas em `method` e `url.pathname` (todas iniciadas com `/api/`).
*   **`checkAuth(request, env)`**: Verifica a autenticação do Admin checando se o Header de autorização do tipo Bearer bate com a variável de ambiente secreta `env.ADMIN_PASSWORD`. Retorna booleano.

### 3.2. Endpoints e Manipulação de Dados (DB Interactions)

#### Catálogo e Estoque (`/api/products`)
*   **`GET /api/products`**
    *   *Ação:* Executa uma query simples `SELECT * FROM products ORDER BY name ASC`.
    *   *Retorno:* JSON com o array de produtos ativos.
*   **`POST /api/products`** (Requer Auth)
    *   *Ação:* Adiciona uma nova trufa.
    *   *DB:* Executa `INSERT INTO products (name, description, price, stock, image_url, is_gourmet) VALUES (...)`.
    *   *Retorno:* Recupera e retorna o ID usando `info.meta.last_row_id` (específico da API do Worker do D1).
*   **`PATCH /api/products/:id`** (Requer Auth)
    *   *Ação:* Atualiza parcialmente dados de um produto (`stock`, `price`, `description`).
    *   *DB:* Prepara um `UPDATE products SET...` dinâmico montando a string baseada nos parâmetros recebidos e executa contra o `id`.

#### Pedidos (`/api/orders`)
*   **`POST /api/orders`**
    *   *Ação:* Aciona a função delegada `handleCreateOrder`.
*   **`GET /api/orders`** (Requer Auth)
    *   *Ação:* Lista relatórios.
    *   *DB:* Executa um `SELECT` com `JOIN` entre `orders` e `customers` para trazer dados ricos do pedido junto ao nome e telefone de quem o realizou, ordenado de forma decrescente pela data.
*   **`PATCH /api/orders/:id`** (Requer Auth)
    *   *Ação:* Atualiza status de andamento (`status`) e status financeiro (`payment_status`) do pedido.
    *   *DB:* Dinamicamente executa `UPDATE orders SET ... WHERE id = ?`.
    *   *Lógica:* Após atualizar o banco de dados, se o novo `status` recebido for `"READY"`, ele chama assincronamente (usando `ctx.waitUntil` para não bloquear a resposta da rota) a função `notifyCustomer(orderId, env)`.

#### Assinaturas e Autenticação
*   **`POST /api/push/subscribe`**
    *   *Ação:* Cadastra ou atualiza o endpoint do navegador para Push Notifications.
    *   *DB:* Checa a tabela `customers` se houver telefone (`SELECT id FROM customers WHERE phone = ?`), resolve o `customer_id` e executa um `INSERT INTO push_subscriptions`.
*   **`POST /api/admin/login`**
    *   *Ação:* Endpoint que compara o payload recebido com `env.ADMIN_PASSWORD` (definido no `wrangler.toml` e no painel Cloudflare) e emite `200 OK` para confirmar login no painel, sem geração de JWT (o "token" usado é o próprio hash da senha enviado no header nas requisições seguintes).

### 3.3. Regras de Negócio e Notificações (Módulos de Funções)

*   **`handleCreateOrder(request, env, headers)`**:
    *   *Validação/Proteção:* Os preços informados pelo frontend são ignorados. O backend faz iteração consultando individualmente o banco (`SELECT id, price FROM products WHERE id = ?`) e forma os itens verificados.
    *   *Promoção:* Contém a regra de negócio do e-commerce (Aplica descontos locais calculando blocos de 3 trufas como R$10 e sobras como R$4 e R$7).
    *   *DB:* Procura o cliente, usa `INSERT` se novo ou `UPDATE` de nome se já existir, capturando o `id` (usando `RETURNING id`). Insere na tabela `orders`.
    *   *Batch DB:* Insere itens em `order_items` e decrementa do estoque (`UPDATE products SET stock = stock - ?`) usando o recurso de execução transacional em lote do D1: `env.DB.batch(stmts)`.
    *   *Notificação:* Chama o módulo `notifyAdmin` após salvar o pedido com sucesso.

*   **Subsistema de Push (`@pushforge/builder`)**
    *   **`notifyAdmin(customerName, totalAmount, env)`**:
        *   Busca endpoints em `push_subscriptions` onde `user_type = 'admin'`. Monta string do JSON do Notification Payload ("Novo pedido recebido") com nome e valor. Invoca `sendPushNotifications`.
    *   **`notifyCustomer(orderId, env)`**:
        *   Busca primeiro o `customer_id` em `orders`. Consulta as subscriptions ligadas àquele ID. Monta o Payload ("Seu pedido está pronto!") e invoca `sendPushNotifications`.
    *   **`sendPushNotifications(subscriptions, payload, env)`**:
        *   Lê variáveis `VAPID_PUBLIC_KEY` e `VAPID_PRIVATE_KEY` para o processo de assinatura VAPID.
        *   Itera sobre as subscriptions, usa o pacote alternativo `@pushforge/builder` (contornando os limites do ambiente Cloudflare Workers do node puro) para assinar as requisições, faz o fetch nativo e dispara HTTP requests contra os serviços push de browsers (Mozilla, Firebase/Google).
        *   Se retorna 410 (Gone) ou 404 (Not Found), entende que a assinatura expirou, executando limpeza (`DELETE FROM push_subscriptions WHERE id = ?`).

---

## 4. Frontend Application (HTML/JS/CSS)

A aplicação reside no diretório `frontend/` e é gerida puramente via arquivos estáticos servidos pela edge (Cloudflare Pages).

### 4.1. Lógica do Cliente (`frontend/js/app.js` e `frontend/index.html`)

O `index.html` fornece a vitrine (`#products-grid`), o menu lateral com carrinho de compras (`#cart-sidebar`), e o modal de Checkout (`#checkout-modal`).

*   **Módulo de Inicialização:** Event listener de `DOMContentLoaded` que chama `loadProducts()`, `loadCartFromStorage()` e `registerServiceWorker()`.
*   **Módulo de Produtos:**
    *   `loadProducts()`: Faz GET para `/api/products` e guarda numa lista em memória (`let products = []`).
    *   `renderProducts()`: Itera a lista criando DOM (cards) programaticamente. Renderiza tags de imagem ou um fallback de emoji dependendo se a URL estiver presente. Emprega a classe CSS `.gourmet` se a flag boolean for true.
*   **Módulo de Carrinho e Regras PWA:**
    *   `addToCart(id)` / `removeFromCart(id)`: Aumenta/reduz a propriedade `quantity` e armazena em memória no array `let cart = []`. Utiliza localStorage `malu_cart` para persistência de dados em caso de fechamento do navegador via `saveCart()`.
    *   `calculateTotal()`: Executa novamente no front (para visualização prévia, replicando regras) os cálculos de desconto de progressões de blocos de 3 trufas.
*   **Módulo de Checkout:**
    *   `submitOrder(event)`: Prevê o refresh do form, captura os dados (`cust-name`, `cust-phone`, `payment-method`), serializa tudo em um objeto e faz `POST` para `/api/orders`. Armazena `malu_user_phone` e `malu_user_name` localmente no Storage para facilitar recompras. Ao sucesso, limpa os caches, ativa o delay e mostra a caixa modal para ativação de notificação (`#push-prompt`).
*   **Módulo de Inscrição Push:**
    *   `subscribeToPush()`: Pede permissão de alerta ao browser pela API nativa de `serviceWorker.ready` através do método `.pushManager.subscribe()` usando uma chave pública genérica hardcoded (dummy para compilação). Envia a resposta final base64 transformada (através das funçôes utils de conversão ArrayBuffer `urlBase64ToUint8Array` e `arrayBufferToBase64`) na rota de backend `/api/push/subscribe` indicando o tipo `customer`.
*   **Service Worker (`frontend/sw.js`)**: Configurado para interceptar chamadas HTTP para cacheamento offline (embora num PWA completo deveria conter as rotas de cache, atualmente focado apenas na ativação global) e receber o evento de "push" do navegador, acionando uma janela de notificação ao usuário.

### 4.2. Lógica Administrativa (`frontend/js/admin.js` e `frontend/admin.html`)

O arquivo `admin.html` oferece a entrada restrita via tela de login simples (`#login-section`). Ao passar da barreira, revela o `dashboard-section` subdividido em abas: **Pedidos, Estoque, Relatórios**.

*   **Módulo de Autenticação:**
    *   `login()`: Dispara tentativa para a API enviando o input string como JSON. Em caso de 200, guarda o input sem criptografia no `localStorage` como `malu_admin_token` e recarrega.
*   **Módulo de Gestão de Pedidos:**
    *   `loadOrders()`: Requisita a API via `GET` injetando o Bearer token.
    *   `renderOrders(orders)`: Monta no DOM os cards. Insere programaticamente elementos `<select>` no HTML cuja marcação `onchange` executa `updateOrderStatus(id, newValue, field)`.
    *   `updateOrderStatus()`: Chama a rota de `PATCH` na API, possibilitando enviar requisições de mudança de string de enum (ex: de 'PREPARING' para 'READY').
*   **Módulo de Gestão de Catálogo (Estoque):**
    *   `loadInventory()` / `renderInventory()`: Obtem todos os produtos do backend e popula inputs numéricos de edição rápida em cards HTML.
    *   `updateProduct(id)`: Recolhe os novos valores inseridos manualmente pelo admin sobre um item nos inputs `stock-${id}`, `price-${id}` e `desc-${id}` e manda o `PATCH` pro backend.
    *   `addProduct(event)`: Captura o formulário HTML (`#add-product-form`).
        *   **Utilitário:** `normalizeName(name)`: Remove acentos e converte os espaços para traços, e gera a formatação de slug automática para o caminho do arquivo base de imagem que subirá pro backend: `/assets/trufa-${slug}${isGourmet ? '-g' : ''}.png`.
*   **Módulo Relatórios e Push de Admin:**
    *   `loadReports()`: Uma re-requisição dos `/api/orders` que processa no lado do cliente com `.filter()` os arrays mostrando separadamente "Pendentes de Pagamento" e "Pendentes de Entrega" nas caixas DOM apropriadas.
    *   `subscribeAdminPush()`: Função idêntica ao app principal, porém acionada pelo click do botão da header enviando parâmetro `userType: 'admin'`.

---
*Fim da Documentação Técnica.*
---

## 5. Arquivos de Código-Fonte (Repositório)

Abaixo estão os códigos-fonte completos de todos os arquivos de texto do projeto, ordenados seguindo a estrutura da árvore de diretórios.
*(Nota: Arquivos binários como imagens `.png`, banco local `.db`, pasta `node_modules`, `package-lock.json` e a pasta `dist` de build foram omitidos desta lista).*

### `.gitignore`
```text
.dev.vars
node_modules/

# wrangler files
.wrangler
.dev.vars*
!.dev.vars.example
.env*
!.env.example

```

### `LICENSE`
```text
MIT License

Copyright (c) 2026 Bassi

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

```

### `README.md`
```markdown
# Trufas da Malu 🍫💕

Bem-vindo ao projeto do sistema de E-commerce das **Trufas da Malu**!

Este projeto foi desenvolvido utilizando uma arquitetura 100% serverless, utilizando exclusivamente serviços em plano gratuito da Cloudflare, com um frontend PWA responsivo mobile-first focado na conversão de vendas das trufas.

## 🏗 Arquitetura e Stack

- **Frontend:** HTML, CSS e JavaScript puros (Vanilla JS), configurado como PWA (Progressive Web App) para instalação nos dispositivos móveis.
- **Backend:** Cloudflare Workers (API REST) fornecendo endpoints sem a necessidade de manter servidores ligados 24/7.
- **Banco de Dados:** Cloudflare D1 (SQLite) totalmente escalável e gratuito.
- **Hospedagem:** Cloudflare Pages (Frontend) integrando-se via variáveis e bindings com o Worker (ou rodando ambos no mesmo escopo).

## 💡 Funcionalidades do Sistema

### Para os Clientes (Loja)
- **Catálogo de Produtos:** Visualização rápida com foco na experiência mobile.
- **Promoção Dinâmica:** O carrinho calcula o valor promocional automaticamente (1 por R$4,00 | 2 por R$7,00 | 3 por R$10,00).
- **Checkout Simplificado:** Sem necessidade de login com senha, usando apenas o nome e o telefone (WhatsApp) do cliente.
- **Opções de Pagamento:** Exibição clara de que o pagamento é feito diretamente para a Malu via Pix, Dinheiro ou Cartão.
- **Notificações Push:** O cliente pode ativar as notificações para ser avisado quando o pedido estiver "Pronto".

### Para a Malu (Painel de Administração)
- Acesso restrito protegido por senha (via API).
- Visualização de todos os pedidos, clientes e totais da compra.
- Botões simples para atualizar o **Status do Pedido** (Novo, Em preparo, Pronto, Entregue) e o **Status de Pagamento** (Pendente, Pago).
- Notificação Push ativa para o navegador da Malu sempre que um novo pedido for gerado.

## 🗂 Estrutura de Pastas

- `/frontend` - Todo o código do site e do painel admin. Contém arquivos HTML, CSS, Javascript puro e Service Worker (`sw.js`).
- `/backend` - Código-fonte da API no Cloudflare Worker (`wrangler.toml` e `src/index.js`).
- `/database` - Arquivos de migração e de inserção de dados falsos iniciais (Seed) em SQL (`schema.sql` e `seed.sql`).

## 🚀 Como fazer o Deploy?

O passo a passo completo e detalhado para colocar esse site no ar de forma gratuita está no arquivo [guia.md](./guia.md).

---
*Feito com muito código e chocolate!*

```

### `backend/package.json`
```json
{
  "name": "backend",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "type": "commonjs",
  "dependencies": {
    "@pushforge/builder": "^2.0.5"
  }
}

```

### `backend/src/index.js`
```javascript
import { buildPushHTTPRequest } from "@pushforge/builder";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const method = request.method;

    // 🛠️ Pílula da Liia: Limpando a URL para evitar o bug da barra dupla/trailing slash
    const cleanPath = url.pathname.replace(/\/+$/, "") || "/";

    // 1. Centralizando os Headers de CORS para não repetir código
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // 2. Ajustando o Preflight (OPTIONS) com status correto e cache (Max-Age)
    if (method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          ...corsHeaders,
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    // 3. Injetando os headers do CORS nas respostas padrão da API
    const headers = {
      ...corsHeaders,
      "Content-Type": "application/json",
    };

    try {
      if (cleanPath === "/api/products" && method === "GET") {
        const { results } = await env.DB.prepare(
          "SELECT * FROM products ORDER BY name ASC",
        ).all();
        return new Response(JSON.stringify(results), { headers });
      }

      if (cleanPath === "/api/products" && method === "POST") {
        if (!checkAuth(request, env))
          return new Response("Unauthorized", { status: 401, headers });
        const data = await request.json();
        const info = await env.DB.prepare(
          "INSERT INTO products (name, description, price, stock, image_url, is_gourmet) VALUES (?, ?, ?, ?, ?, ?)"
        )
          .bind(data.name, data.description, data.price, data.stock, data.image_url, data.is_gourmet ? 1 : 0)
          .run();
        return new Response(JSON.stringify({ success: true, id: info.meta.last_row_id }), { headers });
      }

      if (cleanPath.startsWith("/api/products/") && method === "PATCH") {
        if (!checkAuth(request, env))
          return new Response("Unauthorized", { status: 401, headers });
        const productId = cleanPath.split("/").pop();
        const data = await request.json();

        const updates = [];
        const params = [];

        if (data.stock !== undefined) {
          updates.push("stock = ?");
          params.push(data.stock);
        }
        if (data.price !== undefined) {
          updates.push("price = ?");
          params.push(data.price);
        }
        if (data.description !== undefined) {
          updates.push("description = ?");
          params.push(data.description);
        }

        if (updates.length > 0) {
          params.push(productId);
          await env.DB.prepare(`UPDATE products SET ${updates.join(", ")} WHERE id = ?`)
            .bind(...params)
            .run();
        }
        return new Response(JSON.stringify({ success: true }), { headers });
      }

      if (cleanPath === "/api/orders" && method === "POST") {
        return await handleCreateOrder(request, env, headers);
      }

      if (cleanPath === "/api/orders" && method === "GET") {
        // Protected route
        if (!checkAuth(request, env))
          return new Response("Unauthorized", { status: 401, headers });
        const { results } = await env.DB.prepare(
          `
          SELECT o.*, c.name as customer_name, c.phone as customer_phone
          FROM orders o
          JOIN customers c ON o.customer_id = c.id
          ORDER BY o.created_at DESC
        `,
        ).all();
        return new Response(JSON.stringify(results), { headers });
      }

      if (cleanPath.startsWith("/api/orders/") && method === "PATCH") {
        if (!checkAuth(request, env))
          return new Response("Unauthorized", { status: 401, headers });
        const orderId = cleanPath.split("/").pop();
        const data = await request.json();

        const updates = [];
        const params = [];
        if (data.status) {
          updates.push("status = ?");
          params.push(data.status);
        }
        if (data.payment_status) {
          updates.push("payment_status = ?");
          params.push(data.payment_status);
        }

        if (updates.length > 0) {
          params.push(orderId);
          await env.DB.prepare(
            `UPDATE orders SET ${updates.join(", ")} WHERE id = ?`,
          )
            .bind(...params)
            .run();

          // Se o status mudou para READY, tentar notificar o cliente
          if (data.status === "READY") {
            ctx.waitUntil(notifyCustomer(orderId, env));
          }
        }
        return new Response(JSON.stringify({ success: true }), { headers });
      }

      if (cleanPath === "/api/push/subscribe" && method === "POST") {
        const data = await request.json();
        const { endpoint, keys, userType, customerPhone } = data;
        let customerId = null;

        if (customerPhone) {
          const customer = await env.DB.prepare(
            "SELECT id FROM customers WHERE phone = ?",
          )
            .bind(customerPhone)
            .first();
          if (customer) customerId = customer.id;
        }

        await env.DB.prepare(
          `
          INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_type, customer_id)
          VALUES (?, ?, ?, ?, ?)
        `,
        )
          .bind(endpoint, keys.p256dh, keys.auth, userType, customerId)
          .run();

        return new Response(JSON.stringify({ success: true }), { headers });
      }

      // 🛠️ Pílula da Liia: O Boss final do seu erro tava aqui. normalizedPath arrumado!
      if (cleanPath === "/api/admin/login" && method === "POST") {
        const { password } = await request.json();
        if (password === env.ADMIN_PASSWORD) {
          return new Response(JSON.stringify({ success: true }), { headers });
        }
        return new Response("Unauthorized", { status: 401, headers });
      }

      return new Response("Not found", { status: 404, headers });
    } catch (error) {
      console.error(error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers,
      });
    }
  },
};

function checkAuth(request, env) {
  const authHeader = request.headers.get("Authorization");
  return authHeader === `Bearer ${env.ADMIN_PASSWORD}`;
}

async function handleCreateOrder(request, env, headers) {
  const data = await request.json();
  const { customer, items, payment_method } = data;

  // Validar itens e calcular total pelo banco de dados
  let totalItems = 0;
  const dbItems = [];

  for (const item of items) {
    const dbProduct = await env.DB.prepare(
      "SELECT id, price FROM products WHERE id = ?",
    )
      .bind(item.product_id)
      .first();
    if (!dbProduct) throw new Error(`Product ${item.product_id} not found`);

    totalItems += item.quantity;
    dbItems.push({
      product_id: item.product_id,
      quantity: item.quantity,
      price: dbProduct.price,
    });
  }

  // Regra da promoção: 1 por 4, 2 por 7, 3 por 10
  const combosDeTres = Math.floor(totalItems / 3);
  const sobra = totalItems % 3;

  let calculatedTotal = combosDeTres * 10;
  if (sobra === 2) calculatedTotal += 7;
  if (sobra === 1) calculatedTotal += 4;

  // 1. Verificar/Criar cliente
  let customerId;
  let existingCustomer = await env.DB.prepare(
    "SELECT id FROM customers WHERE phone = ?",
  )
    .bind(customer.phone)
    .first();
  if (existingCustomer) {
    customerId = existingCustomer.id;
    // Atualizar nome do cliente
    await env.DB.prepare("UPDATE customers SET name = ? WHERE id = ?")
      .bind(customer.name, customerId)
      .run();
  } else {
    const info = await env.DB.prepare(
      "INSERT INTO customers (phone, name) VALUES (?, ?) RETURNING id",
    )
      .bind(customer.phone, customer.name)
      .first();
    customerId = info.id;
  }

  // 2. Criar pedido
  const orderInfo = await env.DB.prepare(
    `
    INSERT INTO orders (customer_id, total_amount, payment_method)
    VALUES (?, ?, ?) RETURNING id
  `,
  )
    .bind(customerId, calculatedTotal, payment_method)
    .first();
  const orderId = orderInfo.id;

  // 3. Inserir itens e reduzir estoque (usando batch do D1)
  const stmts = [];
  for (const item of dbItems) {
    stmts.push(
      env.DB.prepare(
        "INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)",
      ).bind(orderId, item.product_id, item.quantity, item.price),
    );
    stmts.push(
      env.DB.prepare("UPDATE products SET stock = stock - ? WHERE id = ?").bind(
        item.quantity,
        item.product_id,
      ),
    );
  }
  await env.DB.batch(stmts);

  // 4. Notificar Admin sobre o novo pedido
  try {
    await notifyAdmin(customer.name, calculatedTotal, env);
  } catch (e) {
    console.error("Push notification to admin failed", e);
  }

  return new Response(JSON.stringify({ success: true, orderId, customerId }), {
    headers,
  });
}

// -----------------------------------------------------
// PUSH NOTIFICATIONS LOGIC (VAPID)
// Utiliza a biblioteca web-push instalada no Worker
// -----------------------------------------------------

async function notifyAdmin(customerName, totalAmount, env) {
  const { results } = await env.DB.prepare(
    "SELECT * FROM push_subscriptions WHERE user_type = 'admin'",
  ).all();
  if (results.length === 0) return;

  const payload = JSON.stringify({
    title: "Novo pedido recebido \uD83C\uDF6C",
    body: `Cliente: ${customerName} | Valor: R$ ${totalAmount.toFixed(2)}`,
    url: "/admin.html",
  });

  await sendPushNotifications(results, payload, env);
}

async function notifyCustomer(orderId, env) {
  const order = await env.DB.prepare(
    "SELECT customer_id FROM orders WHERE id = ?",
  )
    .bind(orderId)
    .first();
  if (!order) return;

  const { results } = await env.DB.prepare(
    "SELECT * FROM push_subscriptions WHERE customer_id = ?",
  )
    .bind(order.customer_id)
    .all();
  if (results.length === 0) return;

  const payload = JSON.stringify({
    title: "Seu pedido está pronto! \u2728",
    body: "Suas trufas deliciosas já estão prontas para retirada/entrega.",
    url: "/",
  });

  await sendPushNotifications(results, payload, env);
}

async function sendPushNotifications(subscriptions, payload, env) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    console.error("VAPID Keys não configuradas. Pulando notificação.");
    return;
  }

  const vapidDetails = {
    subject: env.VAPID_SUBJECT || "mailto:admin@trufasdamalu.com.br",
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };

  for (const sub of subscriptions) {
    const pushSubscription = {
      endpoint: sub.endpoint,
      keys: {
        auth: sub.auth,
        p256dh: sub.p256dh,
      },
    };

    try {
      const requestDetails = await buildPushHTTPRequest(
        pushSubscription,
        payload,
        vapidDetails,
      );
      const pushResponse = await fetch(requestDetails.endpoint, {
        method: requestDetails.method,
        headers: requestDetails.headers,
        body: requestDetails.body,
      });

      if (!pushResponse.ok) {
        console.error(
          "Erro ao enviar push:",
          pushResponse.status,
          await pushResponse.text(),
        );
        if (pushResponse.status === 410 || pushResponse.status === 404) {
          await env.DB.prepare("DELETE FROM push_subscriptions WHERE id = ?")
            .bind(sub.id)
            .run();
        }
      }
    } catch (err) {
      console.error("Erro interno ao montar push:", err);
    }
  }
}

```

### `backend/wrangler.toml`
```toml
name = "trufas-da-malu-api"
main = "src/index.js"
compatibility_date = "2024-03-01"

# Cors é necessário para o desenvolvimento local.
# Quando publicado, se API e Frontend ficarem no mesmo domínio, pode não ser necessário,
# mas deixaremos configurado no código.

[[d1_databases]]
binding = "DB"
database_name = "trufas-malu-db"
database_id = "1bdb3def-78c2-406c-944a-4701df2dc6e8" # Substitua pelo ID gerado ao criar o DB
migrations_dir = "../database"

[vars]
# Variáveis e segredos de produção devem ser configurados via dashboard ou wrangler secret.
# Para desenvolvimento local, crie um arquivo .dev.vars (já ignorado pelo git).
# VAPID_SUBJECT = "mailto:seuemail@dominio.com"

compatibility_flags = ["nodejs_compat"]

```

### `database/schema.sql`
```sql
-- Criação das tabelas do banco de dados D1

CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    image_url TEXT,
    is_gourmet BOOLEAN NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL,
    total_amount REAL NOT NULL,
    payment_method TEXT NOT NULL, -- 'pix', 'dinheiro', 'cartao'
    payment_status TEXT NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PAID'
    status TEXT NOT NULL DEFAULT 'NEW', -- 'NEW', 'PREPARING', 'READY', 'DELIVERED'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    price REAL NOT NULL,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_type TEXT NOT NULL, -- 'admin', 'customer'
    customer_id INTEGER,
    FOREIGN KEY (customer_id) REFERENCES customers(id)
);

```

### `database/seed.sql`
```sql
-- Inserção de dados iniciais (Seed)
-- Os preços estão baseados na promoção (1 por 4,00 | 2 por 7,00 | 3 por 10,00)
-- Mas no banco salvaremos o preço unitário base (R$ 4,00).
-- A lógica de desconto (combo) será aplicada no backend/frontend na hora do checkout.

INSERT INTO products (name, description, price, stock, image_url, is_gourmet) VALUES
('Nutella', 'Trufa de chocolate recheada com Nutella', 4.00, 50, '/assets/trufa-nutella.png', 0),
('70% Cacau', 'Trufa de chocolate intenso 70% cacau', 4.00, 50, '/assets/trufa-cacau.png', 0),
('Ferrero', 'Trufa com avelãs inspirada no Ferrero Rocher', 4.00, 50, '/assets/trufa-ferrero.png', 0),
('Tradicional', 'A clássica trufa de chocolate ao leite', 4.00, 50, '/assets/trufa-tradicional.png', 0),
('Morango', 'Trufa recheada com creme de morango', 4.00, 50, '/assets/trufa-morango.png', 0),
('Galak', 'Trufa de chocolate branco Galak', 4.00, 50, '/assets/trufa-galak.png', 0),
('Prestígio', 'Trufa recheada com muito coco', 4.00, 50, '/assets/trufa-prestigio.png', 0),
('Brigadeiro', 'A queridinha trufa de brigadeiro', 4.00, 50, '/assets/trufa-brigadeiro.png', 0),
('Kit Kat', 'Trufa com pedaços crocantes de Kit Kat', 4.00, 50, '/assets/trufa-kitkat.png', 0),
('Banoffee', 'Trufa sabor doce de leite com banana', 4.00, 50, '/assets/trufa-banoffee.png', 0),
('Cereja', 'Trufa recheada com cereja e licor', 4.00, 50, '/assets/trufa-cereja.png', 0),
('Beijinho', 'Trufa de beijinho cremoso', 4.00, 50, '/assets/trufa-beijinho.png', 0),
('Chokito', 'Trufa com flocos crocantes e caramelo', 4.00, 50, '/assets/trufa-chokito.png', 0),
('Sulflair', 'Trufa com textura aerada Suflair', 4.00, 50, '/assets/trufa-suflair.png', 0),
('Ninho', 'Trufa deliciosa de leite Ninho', 4.00, 50, '/assets/trufa-ninho.png', 0),
('Maracujá', 'Trufa recheada com mousse de maracujá', 4.00, 50, '/assets/trufa-maracuja.png', 0),
('Pistache', 'A sofisticada trufa de pistache', 4.00, 50, '/assets/trufa-pistache.png', 0),
('Limão', 'Trufa cítrica e refrescante de limão', 4.00, 50, '/assets/trufa-limao.png', 0);

```

### `frontend/admin.html`
```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Admin - Trufas da Malu</title>
    <link rel="stylesheet" href="css/style.css">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;800&family=Pacifico&display=swap" rel="stylesheet">
</head>
<body class="admin-body">

    <header class="admin-header">
        <h1>Painel 👑</h1>
        <button id="push-admin-btn" class="secondary-btn" onclick="subscribeAdminPush()">Ativar Notificações de Pedido 🔔</button>
    </header>

    <main class="admin-main">
        <div id="login-section" class="login-section">
            <h2>Acesso Restrito</h2>
            <input type="password" id="admin-pass" placeholder="Senha secreta" />
            <button onclick="login()">Entrar</button>
            <p id="login-error" class="error"></p>
        </div>

        <div id="dashboard-section" class="dashboard-section hidden">

            <div style="display: flex; justify-content: flex-end; margin-bottom: 15px; padding: 0 10px;">
                <button onclick="logout()" style="background-color: #ff4d4d; color: white; padding: 8px 16px; border: none; border-radius: 8px; font-family: 'Poppins', sans-serif; font-weight: bold; cursor: pointer; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">Sair do Painel 🚪</button>
            </div>

            <div class="admin-tabs">
                <button class="tab-btn active" onclick="switchTab('orders-tab')">Pedidos</button>
                <button class="tab-btn" onclick="switchTab('inventory-tab')">Estoque</button>
                <button class="tab-btn" onclick="switchTab('reports-tab')">Relatórios</button>
            </div>

            <div id="orders-tab" class="tab-content active">
                <button onclick="loadOrders()" class="refresh-btn">🔄 Atualizar Pedidos</button>
                <div class="orders-container" id="orders-container">
                    </div>
            </div>

            <div id="inventory-tab" class="tab-content hidden">
                <div class="add-product-section card">
                    <h3>Adicionar Nova Trufa</h3>
                    <form id="add-product-form" onsubmit="addProduct(event)">
                        <input type="text" id="new-name" placeholder="Nome (Ex: Pistache)" required>
                        <input type="text" id="new-desc" placeholder="Descrição" required>
                        <input type="number" id="new-price" placeholder="Preço" value="4.00" step="0.01" required>
                        <input type="number" id="new-stock" placeholder="Estoque Inicial" value="50" required>
                        <div class="checkbox-group">
                            <input type="checkbox" id="new-gourmet">
                            <label for="new-gourmet">Trufa Gourmet (Borda dourada)</label>
                        </div>
                        <button type="submit">Cadastrar Trufa</button>
                    </form>
                </div>
                <button onclick="loadInventory()" class="refresh-btn">🔄 Atualizar Estoque</button>
                <div class="inventory-container" id="inventory-container">
                    </div>
            </div>

            <div id="reports-tab" class="tab-content hidden">
                <div class="reports-section card">
                    <h3>Relatórios</h3>
                    <div class="report-box">
                        <h4>Pendentes de Pagamento</h4>
                        <div id="report-pending-payment">Carregando...</div>
                    </div>
                    <div class="report-box">
                        <h4>Pendentes de Entrega</h4>
                        <div id="report-pending-delivery">Carregando...</div>
                    </div>
                    <button onclick="loadReports()" class="refresh-btn">🔄 Atualizar Relatórios</button>
                </div>
            </div>
        </div>
    </main>

    <script src="js/admin.js"></script>
</body>
</html>

```

### `frontend/index.html`
```html
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Trufas da Malu</title>
    <link rel="stylesheet" href="css/style.css">
    <link rel="manifest" href="manifest.json">
    <meta name="theme-color" content="#ffb6c1">
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;800&family=Pacifico&display=swap" rel="stylesheet">
</head>
<body>

    <header>
        <div class="header-content">
            <h1>Trufas da Malu 💕</h1>
        </div>
        <div class="cart-icon" onclick="toggleCart()">
            🛒 <span id="cart-count">0</span>
        </div>
    </header>

    <main>
        <section class="promo-banner">
            <h2>💕 Preços 💕</h2>
            <div class="prices">
                <div><span>1 POR</span><br><strong>R$ 4,00</strong></div>
                <div><span>2 POR</span><br><strong>R$ 7,00</strong></div>
                <div><span>3 POR</span><br><strong>R$ 10,00</strong></div>
            </div>
            <p class="payment-methods">ACEITAMOS PIX, DINHEIRO E CARTÃO</p>
        </section>

        <section class="products-grid" id="products-grid">
            <!-- Produtos serão carregados via JS -->
            <p class="loading">Carregando as delícias...</p>
        </section>
    </main>

    <!-- Carrinho Sidebar -->
    <div class="cart-sidebar" id="cart-sidebar">
        <div class="cart-header">
            <h2>Seu Pedido 🛒</h2>
            <button class="close-btn" onclick="toggleCart()">✖</button>
        </div>
        <div class="cart-items" id="cart-items">
            <!-- Itens do carrinho aqui -->
        </div>
        <div class="cart-footer">
            <div class="cart-total">
                <span>Total:</span>
                <span id="cart-total-value">R$ 0,00</span>
            </div>
            <button class="checkout-btn" onclick="openCheckout()">Finalizar Pedido</button>
        </div>
    </div>

    <!-- Modal de Checkout -->
    <div class="modal" id="checkout-modal">
        <div class="modal-content">
            <button class="close-btn" onclick="closeCheckout()">✖</button>
            <h2>Finalizar Pedido</h2>
            <form id="checkout-form" onsubmit="submitOrder(event)">
                <div class="form-group">
                    <label>Seu Nome (ou Apelido) 💕</label>
                    <input type="text" id="cust-name" required placeholder="Ex: Maria">
                </div>
                <div class="form-group">
                    <label>Seu WhatsApp (apenas números)</label>
                    <input type="tel" id="cust-phone" required placeholder="Ex: 11999999999">
                </div>
                <div class="form-group">
                    <label>Forma de Pagamento</label>
                    <select id="payment-method" required>
                        <option value="pix">Pix (📱 11964143469)</option>
                        <option value="dinheiro">Dinheiro</option>
                        <option value="cartao">Cartão (Débito/Crédito)</option>
                    </select>
                </div>
                <button type="submit" class="checkout-btn" id="submit-btn">Enviar Pedido para a Malu!</button>
            </form>
        </div>
    </div>

    <!-- Toast / Push Prompt -->
    <div id="push-prompt" class="push-prompt hidden">
        <p>Quer ser avisado quando o pedido estiver pronto? 🔔</p>
        <button onclick="subscribeToPush()">Ativar Notificações</button>
        <button class="text-btn" onclick="closePushPrompt()">Agora não</button>
    </div>

    <script src="js/app.js"></script>
</body>
</html>

```

### `frontend/manifest.json`
```json
{
  "name": "Trufas da Malu",
  "short_name": "Trufas",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffe5ec",
  "theme_color": "#ffb6c1",
  "description": "As melhores trufas caseiras da Malu!",
  "icons": [
    {
      "src": "assets/icon-192.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "assets/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}

```

### `frontend/sw.js`
```javascript
const CACHE_NAME = 'trufas-da-malu-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/admin.html',
  '/css/style.css',
  '/js/app.js',
  '/js/admin.js',
  '/manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', event => {
  // Ignorar chamadas da API no cache
  if (event.request.url.includes('/api/')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      })
  );
});

self.addEventListener('push', event => {
  let data = { title: 'Nova Notificação', body: 'Você tem uma atualização!', url: '/' };

  if (event.data) {
    try {
      data = event.data.json();
    } catch(e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/assets/icon-192.png',
    badge: '/assets/icon-192.png',
    data: {
      url: data.url
    }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.notification.data && event.notification.data.url) {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});

```

### `frontend/css/style.css`
```css
:root {
    --primary-color: #ff6b8b;
    --secondary-color: #ff8fa3;
    --bg-color: #ffe5ec;
    --text-color: #4a2530;
    --card-bg: #ffffff;
    --font-main: 'Poppins', sans-serif;
    --font-accent: 'Pacifico', cursive;
}

* {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
}

body {
    font-family: var(--font-main);
    background-color: var(--bg-color);
    color: var(--text-color);
    line-height: 1.6;
    padding-bottom: 80px;
}

header {
    background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
    color: white;
    padding: 20px;
    text-align: center;
    position: sticky;
    top: 0;
    z-index: 100;
    box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    display: flex;
    justify-content: space-between;
    align-items: center;
}

header h1 {
    font-family: var(--font-accent);
    font-size: 1.8rem;
    margin: 0;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.2);
}

header p {
    font-size: 0.8rem;
    opacity: 0.9;
}

.cart-icon {
    font-size: 1.5rem;
    cursor: pointer;
    position: relative;
    background: rgba(255,255,255,0.2);
    padding: 8px 15px;
    border-radius: 20px;
}

.cart-icon span {
    font-weight: bold;
}

.promo-banner {
    background: var(--card-bg);
    margin: 15px;
    padding: 15px;
    border-radius: 15px;
    text-align: center;
    box-shadow: 0 4px 10px rgba(255,107,139,0.2);
    border: 2px dashed var(--primary-color);
}

.promo-banner h2 {
    color: var(--primary-color);
    font-size: 1.2rem;
    margin-bottom: 10px;
}

.prices {
    display: flex;
    justify-content: space-around;
    margin-bottom: 10px;
}

.prices div {
    background: var(--bg-color);
    padding: 10px;
    border-radius: 10px;
    width: 30%;
}

.prices span { font-size: 0.8rem; color: #666; }
.prices strong { color: var(--primary-color); font-size: 1.1rem; }

.payment-methods {
    font-size: 0.8rem;
    font-weight: bold;
    color: #555;
    background: #f1f1f1;
    display: inline-block;
    padding: 5px 15px;
    border-radius: 20px;
}

.products-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 15px;
    padding: 15px;
}

.product-card {
    background: var(--card-bg);
    border-radius: 15px;
    padding: 15px;
    text-align: center;
    box-shadow: 0 4px 8px rgba(0,0,0,0.05);
    position: relative;
    border-bottom: 4px solid var(--secondary-color);
}

.product-card img {
    width: 80px;
    height: 80px;
    object-fit: cover;
    border-radius: 50%;
    margin-bottom: 10px;
    background-color: var(--bg-color);
}

.product-card h3 {
    font-size: 1rem;
    margin-bottom: 5px;
}

.product-card p {
    font-size: 0.75rem;
    color: #666;
    margin-bottom: 10px;
    height: 35px;
    overflow: hidden;
}

.product-card.gourmet {
    border-bottom: 4px solid #d4af37;
}

/* Tabs */
.admin-tabs {
    display: flex;
    justify-content: center;
    gap: 10px;
    margin-bottom: 20px;
}

.tab-btn {
    padding: 10px 20px;
    background: #e0e0e0;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-weight: bold;
}

.tab-btn.active {
    background: var(--primary-color);
    color: white;
}

.card {
    background: white;
    padding: 15px;
    border-radius: 10px;
    box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    margin-bottom: 15px;
}

.add-product-section form {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 10px;
}

.add-product-section input[type="text"],
.add-product-section input[type="number"] {
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 5px;
}

.checkbox-group {
    display: flex;
    align-items: center;
    gap: 10px;
}

.add-product-section button {
    background: var(--primary-color);
    color: white;
    padding: 10px;
    border: none;
    border-radius: 5px;
    cursor: pointer;
    font-weight: bold;
}

.inventory-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
}

.stock-controls {
    display: flex;
    align-items: center;
    gap: 5px;
}

.stock-controls input {
    width: 60px;
    padding: 5px;
}

.stock-controls button {
    padding: 5px 10px;
    background: #2ecc71;
    color: white;
    border: none;
    border-radius: 3px;
    cursor: pointer;
}

.report-box {
    margin-top: 15px;
    padding: 10px;
    background: #f9f9f9;
    border-left: 4px solid var(--primary-color);
}

.add-to-cart-btn {
    background: var(--primary-color);
    color: white;
    border: none;
    padding: 8px 15px;
    border-radius: 20px;
    font-weight: bold;
    cursor: pointer;
    width: 100%;
    transition: transform 0.1s;
}

.add-to-cart-btn:active {
    transform: scale(0.95);
}

/* Sidebar Carrinho */
.cart-sidebar {
    position: fixed;
    top: 0;
    right: -100%;
    width: 300px;
    max-width: 100%;
    height: 100%;
    background: var(--card-bg);
    box-shadow: -5px 0 15px rgba(0,0,0,0.1);
    z-index: 200;
    transition: right 0.3s ease;
    display: flex;
    flex-direction: column;
}

.cart-sidebar.open {
    right: 0;
}

.cart-header {
    background: var(--primary-color);
    color: white;
    padding: 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}

.close-btn {
    background: none;
    border: none;
    color: white;
    font-size: 1.5rem;
    cursor: pointer;
}

.cart-items {
    flex: 1;
    overflow-y: auto;
    padding: 15px;
}

.cart-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid #eee;
    padding: 10px 0;
}

.cart-item-info h4 { font-size: 0.9rem; }
.cart-item-controls {
    display: flex;
    align-items: center;
    gap: 10px;
}

.cart-item-controls button {
    background: var(--bg-color);
    border: none;
    width: 25px;
    height: 25px;
    border-radius: 50%;
    font-weight: bold;
    color: var(--primary-color);
}

.cart-footer {
    padding: 20px;
    border-top: 1px solid #eee;
    background: #fafafa;
}

.cart-total {
    display: flex;
    justify-content: space-between;
    font-size: 1.2rem;
    font-weight: bold;
    margin-bottom: 15px;
}

.checkout-btn {
    background: var(--primary-color);
    color: white;
    border: none;
    width: 100%;
    padding: 15px;
    border-radius: 25px;
    font-size: 1.1rem;
    font-weight: bold;
    cursor: pointer;
}

/* Modais */
.modal {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.5);
    z-index: 300;
    display: none;
    justify-content: center;
    align-items: center;
}

.modal.active { display: flex; }

.modal-content {
    background: white;
    padding: 25px;
    border-radius: 20px;
    width: 90%;
    max-width: 400px;
    position: relative;
}

.modal-content .close-btn {
    position: absolute;
    top: 15px;
    right: 15px;
    color: #999;
}

.form-group {
    margin-bottom: 15px;
}

.form-group label {
    display: block;
    margin-bottom: 5px;
    font-size: 0.9rem;
    font-weight: 600;
}

.form-group input, .form-group select {
    width: 100%;
    padding: 10px;
    border: 1px solid #ddd;
    border-radius: 10px;
    font-family: var(--font-main);
}

/* Admin */
.admin-body { background-color: #f4f4f4; }
.admin-header { justify-content: center; flex-direction: column; gap: 10px; }
.login-section { text-align: center; margin-top: 50px; }
.login-section input { padding: 10px; margin-bottom: 10px; width: 80%; max-width: 300px; border-radius: 5px; border:1px solid #ccc; }
.login-section button { padding: 10px 20px; background: var(--primary-color); color: white; border:none; border-radius: 5px; cursor: pointer;}
.hidden { display: none !important; }

.orders-container { padding: 15px; }
.order-card { background: white; padding: 15px; margin-bottom: 15px; border-radius: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); border-left: 5px solid #ccc; }
.order-card.status-NEW { border-left-color: #3498db; }
.order-card.status-PREPARING { border-left-color: #f1c40f; }
.order-card.status-READY { border-left-color: #2ecc71; }
.order-card.status-DELIVERED { border-left-color: #95a5a6; opacity: 0.7; }

.order-actions { margin-top: 10px; display: flex; gap: 10px; flex-wrap: wrap;}
.order-actions button, .order-actions select { padding: 5px 10px; font-size: 0.8rem; border-radius: 5px; border: 1px solid #ddd;}

.push-prompt {
    position: fixed;
    bottom: 20px;
    left: 20px;
    right: 20px;
    background: white;
    padding: 15px;
    border-radius: 15px;
    box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    z-index: 500;
    text-align: center;
    border: 2px solid var(--primary-color);
}

.push-prompt p { margin-bottom: 10px; font-weight: bold; }
.push-prompt button { background: var(--primary-color); color:white; padding: 10px 20px; border:none; border-radius: 20px; width: 100%; margin-bottom: 5px;}
.push-prompt .text-btn { background: none; color: #666; text-decoration: underline; padding: 5px;}

```

### `frontend/js/admin.js`
```javascript
// const API_URL = '[https://trufas-da-malu-api.alan-ricardo.workers.dev/api/]';
const API_URL = "https://trufas-da-malu-api.alan-ricardo.workers.dev/api";

let adminToken = localStorage.getItem('malu_admin_token') || null;

document.addEventListener('DOMContentLoaded', () => {
    if (adminToken) {
        showDashboard();
    }
});

async function login() {
    const pass = document.getElementById('admin-pass').value;
    try {
        const response = await fetch(`${API_URL}/admin/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password: pass })
        });

        if (response.ok) {
            adminToken = pass; // Salvamos a senha como token simples
            localStorage.setItem('malu_admin_token', adminToken);
            showDashboard();
        } else {
            document.getElementById('login-error').innerText = "Senha incorreta!";
        }
    } catch (e) {
        document.getElementById('login-error').innerText = "Erro ao conectar.";
    }
}

// 🚪 Função NOVA: Logout do Painel
function logout() {
    // Remove o token do armazenamento do navegador
    localStorage.removeItem('malu_admin_token');

    // Limpa a variável em memória
    adminToken = null;

    // Dá um F5 forçado na página pra voltar pra tela de login
    location.reload();
}

function showDashboard() {
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('dashboard-section').classList.remove('hidden');
    loadOrders();
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));

    document.getElementById(tabId).classList.remove('hidden');
    document.querySelector(`button[onclick="switchTab('${tabId}')"]`).classList.add('active');

    if (tabId === 'orders-tab') loadOrders();
    if (tabId === 'inventory-tab') loadInventory();
    if (tabId === 'reports-tab') loadReports();
}

async function loadOrders() {
    try {
        const response = await fetch(`${API_URL}/orders`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });

        if (response.status === 401) {
            localStorage.removeItem('malu_admin_token');
            location.reload();
            return;
        }

        const orders = await response.json();
        renderOrders(orders);
    } catch (error) {
        console.error("Erro", error);
    }
}

function renderOrders(orders) {
    const container = document.getElementById('orders-container');
    container.innerHTML = '';

    if (orders.length === 0) {
        container.innerHTML = '<p>Nenhum pedido encontrado.</p>';
        return;
    }

    orders.forEach(o => {
        const div = document.createElement('div');
        div.className = `order-card status-${o.status}`;

        const date = new Date(o.created_at).toLocaleString('pt-BR');

        div.innerHTML = `
            <h3>Pedido #${o.id}</h3>
            <p><strong>Cliente:</strong> ${o.customer_name} (${o.customer_phone})</p>
            <p><strong>Total:</strong> R$ ${o.total_amount.toFixed(2).replace('.',',')}</p>
            <p><strong>Pagamento:</strong> ${o.payment_method.toUpperCase()} - <strong>${o.payment_status}</strong></p>
            <p><small>${date}</small></p>

            <div class="order-actions">
                <select onchange="updateOrderStatus(${o.id}, this.value, 'status')">
                    <option value="NEW" ${o.status === 'NEW' ? 'selected' : ''}>Novo</option>
                    <option value="PREPARING" ${o.status === 'PREPARING' ? 'selected' : ''}>Em preparo</option>
                    <option value="READY" ${o.status === 'READY' ? 'selected' : ''}>Pronto</option>
                    <option value="DELIVERED" ${o.status === 'DELIVERED' ? 'selected' : ''}>Entregue</option>
                </select>

                <select onchange="updateOrderStatus(${o.id}, this.value, 'payment_status')">
                    <option value="PENDING" ${o.payment_status === 'PENDING' ? 'selected' : ''}>Pagamento Pendente</option>
                    <option value="PAID" ${o.payment_status === 'PAID' ? 'selected' : ''}>Pago</option>
                </select>
            </div>
        `;
        container.appendChild(div);
    });
}

async function updateOrderStatus(orderId, newValue, field) {
    const payload = {};
    payload[field] = newValue;

    try {
        const response = await fetch(`${API_URL}/orders/${orderId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            // Recarregar pra garantir a cor
            loadOrders();
        } else {
            alert('Erro ao atualizar!');
        }
    } catch(e) {
        alert('Erro ao atualizar pedido');
    }
}

async function loadInventory() {
    try {
        const response = await fetch(`${API_URL}/products`);
        const products = await response.json();
        renderInventory(products);
    } catch (e) {
        console.error("Erro ao carregar estoque", e);
    }
}

function renderInventory(products) {
    const container = document.getElementById('inventory-container');
    container.innerHTML = '';

    products.forEach(p => {
        const div = document.createElement('div');
        div.className = 'inventory-item card';
        div.innerHTML = `
            <h4>${p.name} ${p.is_gourmet ? '🌟' : ''}</h4>
            <div class="stock-controls" style="display: flex; flex-direction: column; gap: 8px;">
                <label>
                    Descrição:
                    <input type="text" id="desc-${p.id}" value="${p.description}" />
                </label>
                <label>
                    Preço (R$):
                    <input type="number" step="0.01" id="price-${p.id}" value="${p.price}" />
                </label>
                <label>
                    Estoque:
                    <input type="number" id="stock-${p.id}" value="${p.stock}" />
                </label>
                <button onclick="updateProduct(${p.id})">Salvar Alterações</button>
            </div>
        `;
        container.appendChild(div);
    });
}

async function updateProduct(productId) {
    const newStock = document.getElementById(`stock-${productId}`).value;
    const newPrice = document.getElementById(`price-${productId}`).value;
    const newDesc = document.getElementById(`desc-${productId}`).value;

    try {
        const response = await fetch(`${API_URL}/products/${productId}`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                stock: parseInt(newStock),
                price: parseFloat(newPrice),
                description: newDesc
            })
        });
        if (response.ok) {
            alert('Produto atualizado!');
            loadInventory();
        } else {
            alert('Erro ao atualizar produto!');
        }
    } catch (e) {
        console.error(e);
        alert('Erro ao atualizar produto!');
    }
}

function normalizeName(name) {
    return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-');
}

async function addProduct(e) {
    e.preventDefault();
    const name = document.getElementById('new-name').value;
    const description = document.getElementById('new-desc').value;
    const price = parseFloat(document.getElementById('new-price').value);
    const stock = parseInt(document.getElementById('new-stock').value);
    const isGourmet = document.getElementById('new-gourmet').checked;

    let baseFilename = normalizeName(name);
    let imageUrl = `/assets/trufa-${baseFilename}${isGourmet ? '-g' : ''}.png`;

    try {
        const response = await fetch(`${API_URL}/products`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                name,
                description,
                price,
                stock,
                image_url: imageUrl,
                is_gourmet: isGourmet
            })
        });

        if (response.ok) {
            alert('Trufa cadastrada com sucesso!');
            document.getElementById('add-product-form').reset();
            loadInventory();
        } else {
            alert('Erro ao cadastrar trufa!');
        }
    } catch (e) {
        console.error(e);
        alert('Erro ao cadastrar trufa!');
    }
}

async function loadReports() {
    try {
        const response = await fetch(`${API_URL}/orders`, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });

        if (!response.ok) return;

        const orders = await response.json();

        const pendingPayment = orders.filter(o => o.payment_status === 'PENDING');
        const pendingDelivery = orders.filter(o => ['NEW', 'PREPARING', 'READY'].includes(o.status));

        document.getElementById('report-pending-payment').innerHTML = pendingPayment.length > 0
            ? pendingPayment.map(o => `<p>Pedido #${o.id} - ${o.customer_name} - R$ ${o.total_amount.toFixed(2)}</p>`).join('')
            : '<p>Nenhum pagamento pendente.</p>';

        document.getElementById('report-pending-delivery').innerHTML = pendingDelivery.length > 0
            ? pendingDelivery.map(o => `<p>Pedido #${o.id} - ${o.customer_name} - Status: ${o.status}</p>`).join('')
            : '<p>Nenhuma entrega pendente.</p>';

    } catch (error) {
        console.error("Erro ao carregar relatórios", error);
    }
}

// Push para Admin
async function subscribeAdminPush() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/sw.js');
            const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuB23zS2e5TdbR9U8y_A4lB780';
            const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: convertedVapidKey
            });

            await fetch(`${API_URL}/push/subscribe`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    endpoint: subscription.endpoint,
                    keys: {
                        p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
                        auth: arrayBufferToBase64(subscription.getKey('auth'))
                    },
                    userType: 'admin'
                })
            });

            alert("Notificações de admin ativadas! 🔔");
        } catch (error) {
            console.error("Erro admin push", error);
        }
    }
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
    return outputArray;
}
function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) { binary += String.fromCharCode(bytes[i]); }
    return window.btoa(binary);
}

```

### `frontend/js/app.js`
```javascript
// Configurações
// const API_URL = "[https://trufas-da-malu-api.alan-ricardo.workers.dev/api/]'; // Será relativo se hospedado junto, ou precisa alterar p/ URL do worker
const API_URL = "https://trufas-da-malu-api.alan-ricardo.workers.dev/api";


let products = [];
let cart = [];
let customerId = null;

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    loadCartFromStorage();
    renderCart();
    registerServiceWorker();
});

// Carregar Produtos
async function loadProducts() {
    try {
        const response = await fetch(`${API_URL}/products`);
        if (!response.ok) throw new Error('Erro na rede');
        products = await response.json();
        renderProducts();
    } catch (error) {
        console.error("Erro ao carregar produtos:", error);
        document.getElementById('products-grid').innerHTML = '<p class="error">Oops! Não foi possível carregar as trufas. Tente novamente.</p>';
    }
}

// Renderizar Produtos
function renderProducts() {
    const grid = document.getElementById('products-grid');
    grid.innerHTML = '';

    products.forEach(p => {
        // Usando um emoji placeholder caso não tenha imagem gerada
        const img = p.image_url || '🍫';

        const card = document.createElement('div');
        card.className = `product-card ${p.is_gourmet ? 'gourmet' : ''}`;
        card.innerHTML = `
            ${p.image_url ? `<img src="${p.image_url}" alt="${p.name}">` : `<div style="font-size:3rem; margin-bottom:10px">${img}</div>`}
            <h3>${p.name} ${p.is_gourmet ? '🌟' : ''}</h3>
            <p>${p.description}</p>
            <button class="add-to-cart-btn" onclick="addToCart(${p.id})">Adicionar</button>
        `;
        grid.appendChild(card);
    });
}

// Lógica de Carrinho e Promoção
function addToCart(productId) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    const cartItem = cart.find(item => item.product_id === productId);
    if (cartItem) {
        cartItem.quantity++;
    } else {
        cart.push({ product_id: productId, name: product.name, price: product.price, quantity: 1 });
    }

    saveCart();
    renderCart();
}

function removeFromCart(productId) {
    const itemIndex = cart.findIndex(item => item.product_id === productId);
    if (itemIndex > -1) {
        if (cart[itemIndex].quantity > 1) {
            cart[itemIndex].quantity--;
        } else {
            cart.splice(itemIndex, 1);
        }
    }
    saveCart();
    renderCart();
}

function calculateTotal() {
    // Regra da promoção: 1 por 4, 2 por 7, 3 por 10
    // Isso significa que a cada 3 trufas, pagamos R$ 10.
    // O resto que não completar 3: se sobrar 2 = R$ 7, se sobrar 1 = R$ 4

    let totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
    let total = 0;

    const combosDeTres = Math.floor(totalItems / 3);
    const sobra = totalItems % 3;

    total += combosDeTres * 10;

    if (sobra === 2) total += 7;
    if (sobra === 1) total += 4;

    return total;
}

function renderCart() {
    const cartItemsEl = document.getElementById('cart-items');
    const cartCountEl = document.getElementById('cart-count');
    const cartTotalEl = document.getElementById('cart-total-value');

    cartItemsEl.innerHTML = '';
    let totalItems = 0;

    cart.forEach(item => {
        totalItems += item.quantity;
        const div = document.createElement('div');
        div.className = 'cart-item';
        div.innerHTML = `
            <div class="cart-item-info">
                <h4>${item.name}</h4>
                <span>Qtd: ${item.quantity}</span>
            </div>
            <div class="cart-item-controls">
                <button onclick="removeFromCart(${item.product_id})">-</button>
                <span>${item.quantity}</span>
                <button onclick="addToCart(${item.product_id})">+</button>
            </div>
        `;
        cartItemsEl.appendChild(div);
    });

    cartCountEl.innerText = totalItems;
    const totalAmount = calculateTotal();
    cartTotalEl.innerText = `R$ ${totalAmount.toFixed(2).replace('.', ',')}`;
}

function saveCart() {
    localStorage.setItem('malu_cart', JSON.stringify(cart));
}

function loadCartFromStorage() {
    const saved = localStorage.getItem('malu_cart');
    if (saved) cart = JSON.parse(saved);
}

// UI Controls
function toggleCart() {
    document.getElementById('cart-sidebar').classList.toggle('open');
}

function openCheckout() {
    if (cart.length === 0) {
        alert("Seu carrinho está vazio!");
        return;
    }
    toggleCart();
    document.getElementById('checkout-modal').classList.add('active');

    // Tentar carregar dados do usuário
    const savedPhone = localStorage.getItem('malu_user_phone');
    const savedName = localStorage.getItem('malu_user_name');
    if(savedPhone) document.getElementById('cust-phone').value = savedPhone;
    if(savedName) document.getElementById('cust-name').value = savedName;
}

function closeCheckout() {
    document.getElementById('checkout-modal').classList.remove('active');
}

// Finalizar Pedido
async function submitOrder(e) {
    e.preventDefault();
    const btn = document.getElementById('submit-btn');
    btn.disabled = true;
    btn.innerText = "Enviando...";

    const name = document.getElementById('cust-name').value;
    const phone = document.getElementById('cust-phone').value.replace(/\D/g, ''); // Apenas números
    const payment_method = document.getElementById('payment-method').value;
    const total_amount = calculateTotal();

    const orderData = {
        customer: { name, phone },
        items: cart,
        total_amount,
        payment_method
    };

    try {
        const response = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        if (!response.ok) throw new Error('Falha ao enviar pedido');

        // Salvar dados do usuário para as próximas compras e pra push
        localStorage.setItem('malu_user_phone', phone);
        localStorage.setItem('malu_user_name', name);

        alert("Pedido enviado com sucesso! A Malu já recebeu seu pedido. 💕");

        // Limpar
        cart = [];
        saveCart();
        renderCart();
        closeCheckout();

        // Mostrar prompt de push notification
        setTimeout(() => {
            document.getElementById('push-prompt').classList.remove('hidden');
        }, 1500);

    } catch (error) {
        console.error(error);
        alert("Ocorreu um erro ao enviar o pedido. Tente novamente!");
    } finally {
        btn.disabled = false;
        btn.innerText = "Enviar Pedido para a Malu!";
    }
}

// Push Notifications
function closePushPrompt() {
    document.getElementById('push-prompt').classList.add('hidden');
}

async function subscribeToPush() {
    try {
        const registration = await navigator.serviceWorker.ready;

        // Nota: Substituir public VAPID key pela chave gerada no Cloudflare
        // Esta é uma chave de testes genérica (dummy) pra não quebrar a compilação
        const VAPID_PUBLIC_KEY = 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuB23zS2e5TdbR9U8y_A4lB780';
        const convertedVapidKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);

        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: convertedVapidKey
        });

        const phone = localStorage.getItem('malu_user_phone');

        // Enviar para o backend
        await fetch(`${API_URL}/push/subscribe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                endpoint: subscription.endpoint,
                keys: {
                    p256dh: arrayBufferToBase64(subscription.getKey('p256dh')),
                    auth: arrayBufferToBase64(subscription.getKey('auth'))
                },
                userType: 'customer',
                customerPhone: phone
            })
        });

        alert("Notificações ativadas! Avisaremos quando estiver pronto. 🔔");
        closePushPrompt();

    } catch (error) {
        console.error("Erro ao assinar push:", error);
        alert("Não foi possível ativar as notificações.");
        closePushPrompt();
    }
}

// Service Worker Setup
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            await navigator.serviceWorker.register('/sw.js');
            console.log('SW registrado com sucesso');
        } catch (e) {
            console.error('Falha no SW', e);
        }
    }
}

// Utilitários de conversão Web Push
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
}

```

### `guia.md`
```markdown
# Guia de Deploy - Trufas da Malu 🚀

Siga este passo a passo didático para publicar o seu E-commerce e API 100% grátis usando a plataforma da Cloudflare e o GitHub.

## Pré-requisitos
1. Uma conta gratuita no [GitHub](https://github.com/).
2. Uma conta gratuita na [Cloudflare](https://dash.cloudflare.com/).
3. O software **Node.js** instalado no seu computador.

---

## Passo 1: Subir o código para o GitHub
1. Crie um novo repositório na sua conta do GitHub chamado `trufas-da-malu`.
2. No terminal (linha de comando) do seu computador, entre na pasta deste projeto e rode os comandos:
   ```bash
   git init
   git add .
   git commit -m "Meu primeiro commit"
   git branch -M main
   git remote add origin https://github.com/SEU_USUARIO/trufas-da-malu.git
   git push -u origin main
   ```

---

## Passo 2: Criar o Banco de Dados (Cloudflare D1)
1. No seu terminal, instale a ferramenta da Cloudflare chamada Wrangler:
   ```bash
   npm install -g wrangler
   ```
2. Faça login na sua conta Cloudflare pelo terminal:
   ```bash
   wrangler login
   ```
   *(Uma janela do navegador vai abrir para você autorizar)*
3. Crie o seu banco de dados:
   ```bash
   wrangler d1 create trufas-malu-db
   ```
4. O comando acima vai cuspir um **ID de Banco de Dados** (algo como `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).
5. Copie esse ID e abra o arquivo `backend/wrangler.toml` e substitua o valor de `database_id` por ele.
6. Crie as tabelas e insira os produtos iniciais (trufas da imagem):
   ```bash
   # Rode esses comandos dentro da pasta do projeto
   wrangler d1 execute trufas-malu-db --file=./database/schema.sql --remote
   wrangler d1 execute trufas-malu-db --file=./database/seed.sql --remote
   ```

---

## Passo 3: Publicar o Backend (API Worker)
1. Acesse a pasta do backend:
   ```bash
   cd backend
   ```
2. Faça o deploy da API:
   ```bash
   wrangler deploy
   ```
3. O terminal mostrará o link da sua API, algo como: `https://trufas-da-malu-api.SEU_USUARIO.workers.dev`.
4. **Anote esse link!** Você precisará colocar ele no Frontend.

---

## Passo 4: Conectar o Frontend com o Backend
1. Abra o arquivo `frontend/js/app.js` e o `frontend/js/admin.js`.
2. Na primeira linha de ambos os arquivos, mude:
   `const API_URL = '/api';`
   Para a URL do seu worker que você acabou de anotar + `/api`, por exemplo:
   `const API_URL = 'https://trufas-da-malu-api.SEU_USUARIO.workers.dev/api';`
3. Faça o commit e envie (push) essa alteração para o GitHub.

---

## Passo 5: Publicar o Frontend (Cloudflare Pages)
1. Acesse o [Dashboard da Cloudflare](https://dash.cloudflare.com).
2. No menu lateral, vá em **Workers & Pages**.
3. Clique em **Create application** e depois escolha a aba **Pages**.
4. Clique em **Connect to Git** e conecte a sua conta do GitHub.
5. Selecione o repositório `trufas-da-malu`.
6. Na configuração de **Build settings**:
   - **Framework preset:** `None`
   - **Build command:** Deixe em branco.
   - **Build output directory:** Digite `frontend` (importante!).
7. Clique em **Save and Deploy**. O seu site estará no ar e disponível num link `.pages.dev`.

---

## Passo 6: Senha do Admin e Push Notifications
A senha administrativa padrão foi configurada como `"senha-super-secreta"` no `wrangler.toml`.
Para mudar isso depois, na Cloudflare:
1. Vá em **Workers & Pages** -> Selecione `trufas-da-malu-api` -> **Settings** -> **Variables**.
2. Adicione a variável `ADMIN_PASSWORD` com a senha que a Malu for usar.

*Nota sobre Push Notifications: As chaves públicas e privadas VAPID precisam ser geradas num ambiente Node (`npx web-push generate-vapid-keys`) para o disparo efetivo. No código frontend foi incluída uma chave pública fictícia para garantir o funcionamento do PWA sem erro, mas a emissão para os celulares exige esse passo extra.*

## Pronto! 🎉
O projeto pode ser acessado pelo link gerado no Pages, instalado no celular pelo botão "Adicionar à Tela Inicial", e gerenciado pela tela em `SEU_LINK/admin.html`.

```

### `test-cors2.js`
```javascript
fetch("https://trufas-da-malu-api.alan-ricardo.workers.dev/api/products", {
    method: "OPTIONS",
    headers: {
        "Origin": "http://localhost:3000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "Content-Type, Authorization"
    }
}).then(res => {
    console.log("Status:", res.status);
    console.log("Headers:", Object.fromEntries(res.headers.entries()));
});

```

### `wrangler.jsonc`
```jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "trufas-da-malu",
  "compatibility_date": "2026-05-03",
  "observability": {
    "enabled": true
  },
  "assets": {
    "directory": "frontend"
  },
  "compatibility_flags": [
    "nodejs_compat"
  ]
}

```
