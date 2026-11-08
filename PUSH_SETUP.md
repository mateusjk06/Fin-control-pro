# FinControl Pro: notificações push sem Firebase Blaze

## O que foi preparado

- Site: **Configurações → Ativar notificações gratuitas no celular**.
- Service worker `firebase-messaging-sw.js` para receber os avisos em segundo plano.
- GitHub Actions `.github/workflows/push-reminders.yml` agenda a execução diária às **09:13 no horário de São Paulo**.
- Script `functions/reminders-push.js` lê contas/dívidas em aberto e envia uma notificação por conta e por dia aos aparelhos registrados.
- O agendamento de WhatsApp foi desativado.
- **Ainda não há envios automáticos até configurar as credenciais, ativar push no celular e executar um teste.**

## Passo 1 — Chave pública VAPID

No console Firebase:
1. Abra o projeto `fincontrol-pro-6cc5d`.
2. Engrenagem → **Configurações do projeto** → **Cloud Messaging**.
3. Na seção de certificados **Web Push**, gere uma chave VAPID se ainda não houver.
4. Copie somente a **chave pública**. Nunca publique a chave privada.
5. No FinControl Pro, abra **Configurações**, cole essa chave em **Chave pública Web Push (VAPID)** e clique em **Ativar notificações gratuitas no celular**.
6. Permita notificações. O dispositivo deve ficar cadastrado no banco.

Para iPhone/iPad, abra o aplicativo no Safari, adicione-o à **Tela de Início** e abra-o por esse ícone para solicitar notificações; o recurso depende da versão do iOS e do suporte a web push. No Android, use Chrome recente e abra o site em HTTPS.

## Passo 2 — GitHub Actions secret do Firebase

Este passo dá acesso de leitura aos dados financeiros e envio de notificações: **proteja a conta do GitHub e use uma conta de serviço com permissões mínimas possíveis**.

1. No Google Cloud Console, projeto `fincontrol-pro-6cc5d`, acesse **IAM e administrador → Contas de serviço**.
2. Crie uma conta de serviço dedicada para o agendador, com acesso necessário ao Firestore e ao Cloud Messaging (não use uma chave geral se puder restringir permissões).
3. Em **Chaves**, crie uma chave JSON para a conta de serviço, caso a política da organização permita. Esse JSON é **secreto**.
4. Abra o repositório GitHub `mateusjk06/Fin-control-pro` → **Settings → Secrets and variables → Actions → New repository secret**.
5. Nomeie o segredo como `FIREBASE_SERVICE_ACCOUNT_JSON` e cole todo o conteúdo JSON da chave. **Nunca cole esse JSON no chat nem o envie como arquivo do projeto.**
6. Apague com segurança cópias desnecessárias da chave.

Projetos Spark têm limites gratuitos para serviços Firebase; o FCM em si está listado como gratuito. Google Cloud e GitHub podem alterar políticas de cotas. Em repositório público, use permissões restritas para alterações dos workflows.

## Passo 3 — Testar

1. Entre no FinControl Pro no celular, abra **Configurações**, informe a chave pública VAPID e permita as notificações.
2. Cadastre uma conta de teste com vencimento no dia corrente e deixe-a pendente.
3. No GitHub, abra **Actions → FinControl - notificacoes push gratuitas → Run workflow**.
4. Primeiro execute com **dry_run = true**. Nos logs, verifique `eligible` maior que zero.
5. Depois, só se tudo estiver correto, execute **dry_run = false**. O celular deverá receber uma notificação se browser/SO/FCM permitirem.
6. Veja o status do envio no Firestore: `users/{uid}/notificationLogs/push_YYYY-MM-DD`. `sent` indica aceite do FCM, não garantia de exibição ao usuário.

## Observações

- O agendamento pode atrasar e não é uma garantia de entrega em horário exato.
- A rotina usa o horário de São Paulo e um único disparo por dia.
- O aplicativo não realiza pagamentos nem altera saldos ao notificar.
- Não é WhatsApp: o alerta aparece nas notificações do sistema operacional.
- O registro de push deve ser refeito se o usuário trocar de navegador/dispositivo ou limpar dados do site.
- Certifique-se de que suas regras do Firestore permitam ao usuário autenticado atualizar **somente seus próprios dados**. A conta de serviço do Actions usa acesso administrativo e deve ser cuidadosamente protegida.

Referências: https://firebase.google.com/docs/cloud-messaging/web/get-started e https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax
