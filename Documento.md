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