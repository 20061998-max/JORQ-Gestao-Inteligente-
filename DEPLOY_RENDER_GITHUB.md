# Guia de Auto-Deploy — GitHub + Render (JORQ Gestão Inteligente)

Este repositório já está configurado para **deploy automático contínuo** toda vez que você enviar atualizações para a branch `main` no GitHub.

## 1. Subir o código para o GitHub
1. Crie um repositório no GitHub (público ou privado).
2. Envie todos os arquivos do projeto para a branch `main`.
   - O arquivo `.gitignore` já protege `.env*` e `.data/` contra envio acidental.

## 2. Criar e conectar o serviço no Render (Auto-Deploy automático)
Você tem **duas formas** simples no painel do Render (`https://dashboard.render.com`):

### Opção A — Usando o arquivo `render.yaml` (Recomendado)
1. No Render, clique em **New + > Blueprint**.
2. Conecte sua conta do GitHub e selecione o repositório do **JORQ Gestão Inteligente**.
3. O Render lerá o arquivo `render.yaml` automaticamente com:
   - **Auto-Deploy**: `Ativado` (qualquer `push` na branch `main` publica nova versão)
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start` (`node server.ts` em Node 22)
   - **Health Check**: `/api/health`
4. Preencha as variáveis secretas solicitadas pelo Render e clique em **Apply**.

### Opção B — Web Service manual + GitHub Actions Hook
1. No Render, clique em **New + > Web Service** e conecte seu repositório GitHub (`main`).
2. Configure:
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/api/health`
   - **Auto-Deploy**: `Yes` (ou `On Commit`)
3. (Opcional — CI antes do deploy) Se preferir que o Render só publique após o GitHub Actions validar TypeScript, regras do Firestore e Build (`.github/workflows/deploy.yml`):
   - Desative o Auto-Deploy nativo no Render;
   - Copie a **Deploy Hook URL** nas configurações do serviço no Render;
   - No GitHub, vá em **Settings > Secrets and variables > Actions > New repository secret** e crie `RENDER_DEPLOY_HOOK_URL` com essa URL.

## 3. Variáveis de Ambiente obrigatórias no Render
Configure em **Environment > Environment Variables**:
- `NODE_ENV` = `production`
- `NODE_VERSION` = `22.20.0`
- `GEMINI_API_KEY` = sua chave da API Gemini (IA Financeira)
- `MP_ACCESS_TOKEN` = token do Mercado Pago (Teste ou Produção)
- `MP_WEBHOOK_SECRET` = segredo de assinatura de webhooks do Mercado Pago
- `MP_ENVIRONMENT` = `sandbox` (ou `production` após os testes)
- `APP_URL` = URL do seu site no Render (ex.: `https://jorq-gestao-inteligente.onrender.com`) — o servidor também detecta `RENDER_EXTERNAL_URL` automaticamente.
- `VITE_FIREBASE_APP_CHECK_SITE_KEY` = (opcional, gratuita) chave reCAPTCHA v3 para Firebase App Check

## 4. Passos finais obrigatórios após subir no Render
1. **Firebase Authentication (Domínio Autorizado)**:
   - Acesse o **Firebase Console > Authentication > Settings > Authorized domains**.
   - Clique em **Add domain** e adicione o domínio do Render (ex.: `jorq-gestao-inteligente.onrender.com`) e seu domínio próprio, se houver, para o login com Google funcionar em produção.
2. **Webhook do Mercado Pago**:
   - No painel de desenvolvedor do Mercado Pago, aponte a URL de notificações (Webhooks) para:
     `https://SUA-URL-DO-RENDER.onrender.com/api/mercadopago/webhook`
