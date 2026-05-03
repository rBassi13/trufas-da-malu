# Documentação Completa do Sistema - Trufas da Malu

## 1. Visão Geral do Projeto

### 1.1 Para o Project Owner (PO) / Negócio
O sistema "Trufas da Malu" é uma plataforma de E-commerce otimizada (Progressive Web App - PWA) voltada para a venda direta de trufas. Focada na conversão e na usabilidade móvel (mobile-first), a plataforma permite que clientes realizem pedidos de forma rápida sem necessidade de login complexo (apenas nome e WhatsApp).
Possui cálculo dinâmico de promoções (ex: 1 por R$4, 2 por R$7, 3 por R$10) e integrações de notificações push para avisar o cliente quando o pedido está "Pronto" e avisar o lojista (Malu) a cada novo pedido. O checkout informa as opções de pagamento presenciais ou via Pix.
Para a administração, existe um painel protegido por senha onde a Malu pode gerenciar o status de produção e pagamento dos pedidos recebidos em tempo real, além de gerenciar o catálogo de trufas e ver relatórios.

### 1.2 Para o Desenvolvedor (Dev)
A aplicação adota uma arquitetura Serverless e Edge Computing, baseada integralmente no ecossistema da Cloudflare (plano gratuito):
- **Frontend:** Cloudflare Pages hospedando um PWA construído com HTML5, CSS3 e JavaScript (Vanilla JS), totalmente sem frameworks pesados, garantindo carregamento rápido.
- **Backend:** Cloudflare Workers contendo uma API RESTful escrita em JavaScript puro que atua como ponte entre o front-end e o banco de dados, e gerencia as notificações push usando a biblioteca `@pushforge/builder` (que contorna incompatibilidades de módulos Node.js no Worker).
- **Banco de Dados:** Cloudflare D1, um banco de dados relacional distribuído construído sobre SQLite.

---

## 2. Árvore de Arquivos

```text
.
├── backend/                       # API Backend (Cloudflare Workers)
│   ├── src/
│   │   └── index.js               # Código-fonte principal da API (Rotas e regras de negócio)
│   ├── package.json               # Dependências do backend (ex: @pushforge/builder)
│   ├── package-lock.json          # Lockfile de dependências
│   ├── wrangler.toml              # Configurações do ambiente de deploy do Worker (binds, variáveis)
│   └── dist/                      # Arquivos de build gerados (index.js compilado)
├── database/                      # Scripts de Banco de Dados
│   ├── schema.sql                 # Definição do esquema do banco (tabelas e relacionamentos)
│   └── seed.sql                   # Inserção de dados iniciais (produtos, configs)
├── frontend/                      # Aplicação PWA (Interface do Usuário)
│   ├── index.html                 # Página principal da loja (catálogo e carrinho)
│   ├── admin.html                 # Painel de controle de pedidos e produtos (protegido por senha)
│   ├── manifest.json              # Manifesto PWA para instalação
│   ├── sw.js                      # Service Worker para caching offline e Push Notifications
│   ├── css/
│   │   └── style.css              # Estilos visuais de toda a aplicação (mobile-first)
│   ├── js/
│   │   ├── app.js                 # Lógica do catálogo, carrinho, checkout e push cliente
│   │   └── admin.js               # Lógica de login, painel de pedidos, catálogo e push admin
│   └── assets/                    # Ícones e imagens dos produtos (trufas)
├── README.md                      # Informações resumidas do repositório
├── Documento.md                   # Documentação detalhada do sistema (este arquivo)
├── guia.md                        # Tutorial detalhado para deploy no Cloudflare
├── wrangler.jsonc                 # Configuração geral do wrangler para o projeto
└── LICENSE                        # Licença de uso do software
```

---

## 3. Banco de Dados (Cloudflare D1 - SQLite)

### Tabelas e Estruturas

*   **`products` (Produtos):** Armazena os itens disponíveis.
    *   `id` (INTEGER PRIMARY KEY)
    *   `name` (TEXT NOT NULL)
    *   `description` (TEXT)
    *   `price` (REAL NOT NULL)
    *   `stock` (INTEGER NOT NULL DEFAULT 0)
    *   `image_url` (TEXT)
    *   `is_gourmet` (BOOLEAN NOT NULL DEFAULT 0) - Flag que indica se a trufa é gourmet.
*   **`customers` (Clientes):** Cadastro simples de clientes baseados em telefone.
    *   `id` (INTEGER PRIMARY KEY)
    *   `phone` (TEXT NOT NULL UNIQUE)
    *   `name` (TEXT NOT NULL)
*   **`orders` (Pedidos):** Registro das compras realizadas.
    *   `id` (INTEGER PRIMARY KEY)
    *   `customer_id` (INTEGER NOT NULL) - *Foreign Key -> customers(id)*
    *   `total_amount` (REAL NOT NULL)
    *   `payment_method` (TEXT NOT NULL)
    *   `payment_status` (TEXT NOT NULL DEFAULT 'PENDING')
    *   `status` (TEXT NOT NULL DEFAULT 'NEW')
    *   `created_at` (DATETIME DEFAULT CURRENT_TIMESTAMP)
*   **`order_items` (Itens do Pedido):** Relação N:N de produtos comprados em um pedido específico.
    *   `id` (INTEGER PRIMARY KEY)
    *   `order_id` (INTEGER NOT NULL) - *Foreign Key -> orders(id)*
    *   `product_id` (INTEGER NOT NULL) - *Foreign Key -> products(id)*
    *   `quantity` (INTEGER NOT NULL)
    *   `price` (REAL NOT NULL) - Preço unitário no momento da compra
*   **`push_subscriptions` (Inscrições Push):** Armazena endpoints dos navegadores para envio de notificações web push.
    *   `id` (INTEGER PRIMARY KEY)
    *   `endpoint` (TEXT NOT NULL)
    *   `p256dh` (TEXT NOT NULL)
    *   `auth` (TEXT NOT NULL)
    *   `user_type` (TEXT NOT NULL) - 'admin' ou 'customer'
    *   `customer_id` (INTEGER) - *Foreign Key -> customers(id) (opcional, aplicável se user_type = 'customer')*

---

## 4. API Backend (`backend/src/index.js`)

A API atende as chamadas HTTP do Frontend. Segue o padrão de roteamento nativo do Fetch API dos Cloudflare Workers.

### Principais Rotas e Funções
*   **`GET /api/products`**
    *   Retorna todos os produtos do banco de dados (catálogo) ordenados alfabeticamente.
*   **`POST /api/products` (Requer Autenticação)**
    *   *Ações:* Cria um novo produto no banco.
    *   *Inputs:* `name`, `description`, `price`, `stock`, `image_url`, `is_gourmet` (boolean).
    *   *Detalhe:* Retorna o ID gerado acessando `info.meta.last_row_id`.
*   **`PATCH /api/products/:id` (Requer Autenticação)**
    *   *Ações:* Atualiza os dados de um produto existente (stock, price, description).
*   **`POST /api/orders`**
    *   *Função Envolvida:* `handleCreateOrder(request, env, headers)`
    *   *Ações:*
        1. Calcula o total do pedido com base nos preços reais do DB e aplica a lógica de promoções.
        2. Verifica se o cliente existe pelo telefone ou o cria.
        3. Cria o pedido (`orders`) e insere os itens correspondentes (`order_items`), descontando do estoque (usando transação batch).
        4. Dispara a notificação de Web Push para a Administradora informando do novo pedido, através da função `notifyAdmin()`.
*   **`GET /api/orders` (Requer Autenticação)**
    *   *Ações:* Checa autenticação (via header `Authorization: Bearer <SENHA>`). Retorna todos os pedidos mais recentes formatados com nome e telefone do cliente, unindo as tabelas `orders` e `customers`.
*   **`PATCH /api/orders/:id` (Requer Autenticação)**
    *   *Ações:* Atualiza os campos `status` ou `payment_status` de um pedido específico. Se o `status` for atualizado para `READY` (Pronto), aciona a função `notifyCustomer(orderId, env)` para enviar uma notificação web push ao cliente usando `ctx.waitUntil`.
*   **`POST /api/push/subscribe`**
    *   *Ações:* Recebe e armazena chaves (endpoint, auth, p256dh) fornecidas pelo frontend em `push_subscriptions`. Diferencia os inscritos via `userType` ('admin' ou 'customer'). Associa ao cliente se `customerPhone` for fornecido.
*   **`POST /api/admin/login`**
    *   *Ações:* Valida a senha fornecida com a variável de ambiente `ADMIN_PASSWORD`.

### Subsistema de Push Notifications
*   `notifyAdmin(customerName, totalAmount, env)`: Busca assinaturas do admin e monta payload "Novo pedido recebido".
*   `notifyCustomer(orderId, env)`: Busca assinaturas vinculadas ao `customer_id` do pedido e monta payload "Seu pedido está pronto!".
*   `sendPushNotifications(subscriptions, payload, env)`: Utiliza `@pushforge/builder` com VAPID keys injetadas via variáveis de ambiente (`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`) para forjar requisições Web Push diretamente da Edge, sem precisar da biblioteca pesada padrão do node `web-push`. Trata erros de status 410 ou 404 para deletar assinaturas inválidas.

---

## 5. Frontend (`frontend/js/`)

### Lógica da Loja (`app.js`)
*   **Carregamento e Exibição:** `loadProducts()`, `renderProducts()` - Buscam os produtos da `/api/products` e os montam no HTML dinamicamente. Os produtos gourmet têm destaque visual (estrela e classe `.gourmet`).
*   **Carrinho e Cálculo de Promoção:** `addToCart()`, `removeFromCart()`, `calculateTotal()`. A função `calculateTotal()` contém as regras de negócio de descontos locais (calcula blocos de 3 trufas e aplica desconto conforme sobra).
*   **Finalização de Pedido:** `submitOrder()` - Captura dados do modal de Checkout, faz postagem de payload JSON para `/api/orders`. Salva dados do cliente no `localStorage` (`malu_user_phone`, `malu_user_name`).
*   **Push Notification Cliente:** Após a compra, exibe prompt (`subscribeToPush()`). Ao autorizar, inscreve o ServiceWorker com uma VAPID pública e envia as chaves de assinatura para `/api/push/subscribe` definindo `userType` como `customer` junto com o telefone.

### Painel Administrativo (`admin.js`)
*   **Autenticação Simples:** `login()` checa contra `/api/admin/login` e, em caso de sucesso, armazena a senha bruta no `localStorage` sob a chave `malu_admin_token`, que é injetada em um `Bearer token` nas chamadas.
*   **Gerenciamento de Pedidos:** `loadOrders()` e `renderOrders()` - Populam a interface exibindo selects iterativos para alterar estado (`status` e `payment_status`).
*   **Atualização de Status:** `updateOrderStatus(orderId, newValue, field)` - Realiza `PATCH` para a API. Alterar para 'Pronto' ativará notificações do lado do backend para o cliente.
*   **Gerenciamento de Produtos:** `loadInventory()` e `renderInventory()` listam os produtos permitindo alterar estoque, preço e descrição (`updateProduct(productId)`). Há também uma função `addProduct(e)` que chama a rota `POST /api/products` formatando automaticamente a URL da imagem baseada no nome da trufa (`trufa-[nome]-g.png` para gourmet).
*   **Push Notification Admin:** `subscribeAdminPush()` - Inscreve a administradora (Malu) no sistema de notificação, enviando as chaves para `/api/push/subscribe` com `userType` de `admin`.
