# Alex (ChatGPT) no FinControl Pro

Esta ramificação prepara a substituição da IA Gemini pela Alex usando a API OpenAI através de uma função Firebase autenticada. A versão publicada ainda não foi alterada.

## Para ativar

1. Verifique custos da API OpenAI e disponibilidade do Firebase Functions no projeto correto.
2. Em terminal seguro, execute `firebase functions:secrets:set OPENAI_API_KEY --project fincontrol-pro-6cc5d` e informe a chave **somente no prompt do terminal**. Não salve a chave em código, no GitHub ou no chat.
3. Implante **somente** a nova função: `firebase deploy --only functions:alexFinancialAssistant --project fincontrol-pro-6cc5d`.
4. Publique a interface desta ramificação após o backend estar ativo; teste com usuário de teste antes de publicar para todos.
5. Confirme login, análises mensais, sugestões de edição com confirmação, diagnóstico automático e funcionamento das funções WhatsApp/Alexa existentes.

## Limites de uso (configurados nesta versão)

- Cada conta autenticada tem **10 consultas à Alex por dia**, incluindo diagnóstico automático, se estiver ativado.
- A cota é compartilhada entre todos os dispositivos da mesma conta e renovada à meia-noite no fuso **America/Sao_Paulo**.
- O servidor grava somente os contadores em `alexDailyUsage/{dia}/users/{uid}`, usando transações Firestore para impedir que vários dispositivos ultrapassem o limite.
- Um teto geral de **300 tentativas/dia em todo o app** protege os custos; o valor pode ser ajustado em `functions/alex-assistant.js`.
- Cada tentativa válida é contabilizada, mesmo se a OpenAI falhar. Consultar o saldo de mensagens não consome cota.
- Para limitar custos, cada prompt aceita até 16.000 caracteres e cada resposta tem teto de 1.000 tokens. O modelo escolhido é `gpt-5-mini`.
- Não foi ativada cobrança por usuário, nem criado painel de administrador. A API é cobrada do proprietário da chave; confira os limites de gastos também na plataforma OpenAI.

## Segurança e operação

- A chamada requer Firebase Auth; a chave OpenAI é armazenada como secret de Firebase Functions.
- O aplicativo apresenta confirmação antes de registrar despesas simples ou aplicar propostas da Alex.
- O backend não grava dados financeiros; ações passam pela validação do aplicativo antes do salvamento.
- Financeiro enviado em prompts é processado pela OpenAI. A requisição define `store: false`.
- Antes de produção configure limites por usuário, App Check, monitoramento de custos e revisão das regras do Firestore.
- A assinatura do ChatGPT não inclui automaticamente créditos da API OpenAI.

**Estado:** código preparado em ramificação, sem deploy e sem teste no dispositivo. Não alterar a versão estável até concluir instalação e testes.
