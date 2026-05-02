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
