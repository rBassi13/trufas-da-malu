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
