# Integração automática WhatsApp — FinControl Pro

**Status: código preparado, ainda não implantado.** Não existem credenciais da Meta configuradas nesta etapa.

## Requisitos

1. Ativar o plano Blaze no projeto Firebase `fincontrol-pro-6cc5d` e habilitar APIs necessárias ao Cloud Scheduler / Cloud Functions.
2. Configurar Meta WhatsApp Cloud API com número de envio, ID do número e token de acesso de longa duração.
3. Criar e aprovar o template Utility `fincontrol_vencimento_hoje` em `pt_BR`, com uma variável de texto no corpo `{{1}}`. Sugestão: "FinControl Pro: seus vencimentos de hoje são: {{1}}. Confira seu aplicativo. Para cancelar os avisos, desative-os em Configurações."
4. No aplicativo, cadastrar número com DDI, ativar consentimento explícito para mensagens automáticas e salvar.

## Configuração local

```bash
npm install -g firebase-tools
firebase login
firebase functions:secrets:set WHATSAPP_ACCESS_TOKEN --project fincontrol-pro-6cc5d
firebase functions:secrets:set WHATSAPP_PHONE_NUMBER_ID --project fincontrol-pro-6cc5d
cd functions
npm install
npm run check
cd ..
firebase deploy --only functions:sendDueWhatsAppReminders --project fincontrol-pro-6cc5d
```

Os segredos nunca devem ir para o código HTML/GitHub. Revise a versão Graph API utilizada em `functions/index.js` antes de implantar.

A função roda às 09:00 no fuso America/Sao_Paulo. Lê contas e parcelas com vencimento no dia e pendentes; envia até uma mensagem por usuário/dia e guarda o identificador aceito pela Meta em `users/{uid}/notificationLogs`. A aceitação da API **não comprova entrega**: webhooks são necessários para isso. A API e os serviços Firebase podem ter cobranças. O envio não acontece enquanto faltar deploy, template aprovado, consentimento ou segredos.

Política da Meta: https://business.whatsapp.com/policy/
Documentação do Firebase: https://firebase.google.com/docs/functions/schedule-functions
