# Alexa + FinControl Pro — integração por etapas

## Situação real
O FinControl Pro atualmente tem um **simulador** na aba Alexa e uma integração de microfone **dentro** do APK para Gemini. Isso **não** significa que a Skill da Alexa esteja publicada ou ligada ao Firebase.

Este diretório inclui o **modelo de interação pt-BR** para uma Skill personalizada chamada **Controle Financeiro**. O nome final de invocação depende da validação da Amazon.

## Suporte multilíngue planejado

A mesma Skill personalizada poderá conter quatro modelos por localidade:

| Localidade Alexa | Arquivo de modelo | Idioma FinControl | Moeda não presumida |
|---|---|---|---|
| pt-BR | `interaction-model-pt-BR.json` | pt | Preferência da conta (ex.: BRL) |
| en-US | `interaction-model-en-US.json` | en | Preferência da conta (ex.: USD) |
| it-IT | `interaction-model-it-IT.json` | it | Preferência da conta (ex.: EUR) |
| es-ES | `interaction-model-es-ES.json` | es | Preferência da conta (ex.: EUR) |

As respostas protótipo estão em `responses.json`, com as mesmas chaves para os quatro idiomas.
O backend deverá escolher as respostas por `request.locale`. A **moeda** deve ser obtida
dos dados do usuário autenticado no Firestore, nunca inferida apenas do idioma ou país.
Pedidos com moeda explícita diferente da configuração deverão confirmar conversão ou
registrar na moeda correta, sem inventar câmbio.

Cada idioma precisa ser adicionado e compilado no Alexa Developer Console separadamente,
sob a **mesma Skill ID**. A associação do OAuth usa o mesmo UID Firebase independentemente
do idioma da fala, evitando contas e saldos duplicados.
Uma Skill só é chamada no idioma e localidade habilitados para a conta/dispositivo,
conforme as regras de disponibilidade da Amazon. Mudança de idioma do app FinControl
não altera automaticamente o idioma de voz configurado na Alexa.

Os modelos usam `AMAZON.SearchQuery` com **um único slot** `{details}` por amostra
de comando de alteração: o servidor deve analisar valor, data, moeda e descrição e
pedir detalhes quando a fala for incompleta. Isso evita confundir o modelo de
reconhecimento com a autorização para executar a alteração.

**Etapa concluída:** modelos de reconhecimento e traduções foram adicionados ao
GitHub; não foram importados/compilados pela Amazon e ainda não existe endpoint
com OAuth publicado para a Skill. Nenhuma Alexa está autorizada a ler ou escrever
dados financeiros até as próximas etapas.

## Código OAuth preparado para Firebase Blaze (ainda não implantado)

Arquivos adicionados:
- functions/alexa-oauth.js: autorização OAuth2, PKCE S256 opcional, tokens temporários e rotativos, rota de consulta autenticada por UID Firebase.
- alexa-skill/link.html: consentimento e login Firebase em página HTTPS do GitHub Pages.
- alexa-skill/lambda-index.js: código da Skill Amazon para consultar contas e dívidas; demais comandos não realizam modificações.
- functions/index.js: exporta a função alexaOAuth.

**Situação:** arquivos salvos no GitHub, mas NÃO implantados na AWS/Amazon nem no Firebase. A conexão da Alexa ainda não funciona.

### Implantar com segurança no notebook

1. Verifique que a página https://mateusjk06.github.io/Fin-control-pro/alexa-skill/link.html está publicada.
2. Na tela Account Linking da Amazon, copie as três Redirect URLs COMPLETAS. Nunca substitua por endereços inventados.
3. No notebook, instale Node.js e firebase-tools. Faça login com `firebase login` e clone https://github.com/mateusjk06/Fin-control-pro.git.
4. Na pasta functions, execute `npm install`. Não publique credenciais no repositório.
5. Configure em terminal os três secrets, todos no projeto fincontrol-pro-6cc5d:
   - `firebase functions:secrets:set ALEXA_CLIENT_ID --project fincontrol-pro-6cc5d`: escolha um ID público como fincontrol-alexa-v1.
   - `firebase functions:secrets:set ALEXA_CLIENT_SECRET --project fincontrol-pro-6cc5d`: gere um segredo aleatório no notebook (openssl rand -hex 32). Mantenha privado.
   - `firebase functions:secrets:set ALEXA_REDIRECT_URIS --project fincontrol-pro-6cc5d`: cole as URLs Amazon exatas separadas por vírgula.
6. Na raiz do repositório: `firebase deploy --only functions:alexaOAuth --project fincontrol-pro-6cc5d`.
7. Depois do deploy, preencha no console Alexa:
   - Authorization URI: https://southamerica-east1-fincontrol-pro-6cc5d.cloudfunctions.net/alexaOAuth?action=authorize
   - Access Token URI: https://southamerica-east1-fincontrol-pro-6cc5d.cloudfunctions.net/alexaOAuth?action=token
   - Client ID e Client Secret: os mesmos configurados nos secrets.
   - Grant: Authorization Code; PKCE S256 quando suportado; skill sem vinculação de conta DESABILITADA.
8. No editor de código da Skill Amazon, substitua o arquivo lambda/index.js pelo conteúdo de alexa-skill/lambda-index.js, confirme dependência ask-sdk-core e execute Deploy.
9. Teste primeiro consultas com a Skill em modo Development, depois a vinculação. Somente após testes considere habilitar ações de escrita com confirmação.

**Limitações e segurança:** o fluxo inicial é somente leitura e precisa ser auditado, ter proteção contra abuso, revogação de TODOS os tokens por usuário e testes de integração antes de produção. Desvincular no aplicativo Alexa não garante revogação imediata dos tokens emitidos no servidor. O GitHub Pages precisa estar publicado. O Blaze poderá gerar custos e orçamentos não são travas de cobrança.

## Etapa A: configurar a Skill (ação manual na Amazon)
1. Criar/entrar em uma conta em https://developer.amazon.com/alexa/console/ask.
2. Criar uma **Custom Skill**, idioma **Português (Brasil)**, nome **FinControl Pro**.
3. Em Build > Interaction Model > JSON Editor, importar `interaction-model-pt-BR.json` para pt-BR; depois adicionar en-US, it-IT e es-ES à mesma Skill, importando o JSON correspondente em cada localidade.
4. Clicar **Save Model** e **Build Model**. Ajustar expressões/slots se o console rejeitar a gramática.
5. Configurar o endpoint da Skill (AWS Lambda ou HTTPS com verificação de assinaturas Alexa). **Não** usar um endpoint aberto que aceite comandos sem validação.
6. Em Account Linking, selecionar o grant **OAuth 2.0 authorization code** (recomendado com PKCE S256).
7. Vincular a conta do FinControl Pro usando um serviço OAuth 2.0 configurado para a Skill. **Firebase Authentication sozinho não disponibiliza automaticamente os endpoints OAuth de autorização e troca de tokens que a Alexa exige.**
8. Testar em Development no app Alexa do mesmo cadastro de desenvolvedor; não é necessário ter Echo agora. A disponibilidade no app pode variar com a região e a conta.
9. Depois, testar num Echo (mesma Skill/conta), sem reimplementar os comandos.

## Etapa B: implementar o servidor autenticado (ainda pendente)
A Skill deve possuir um endpoint próprio autenticado e não deverá enviar senha ou dados financeiros em URL ou no repositório. O serviço de autorização OAuth deve:
- Exibir uma tela de consentimento com login Firebase válido.
- Emitir código temporário de autorização, com state validado, redirect URI numa lista explícita e PKCE.
- Trocar o código por access token + refresh token, armazenados com hash/rotação, validade e revogação.
- Associar o token exclusivamente ao UID Firebase que concedeu a autorização.
- Recusar solicitações sem token, e verificar a origem do request da Skill ou usar AWS Lambda de confiança.
- Usar Firebase Admin apenas no backend, com mínimo privilégio.
- Permitir desvincular Alexa em configurações do app (revogação).

## Etapa C: consultar e alterar dados
Leituras iniciais: saldo estimado, receitas, despesas, contas a vencer, dívidas, investimentos, análise e plano de quitação.
Ações candidatas: cadastrar conta/receita/dívida/aporte, marcar como paga, alterar valor, alterar vencimento e excluir. **Não estão operacionais na Alexa até haver autenticação, processamento, validações e testes**.

Para qualquer alteração:
1. Interpretar os slots e validar valores, datas, moedas e nomes.
2. Pesquisar o registro certo no UID vinculado (caso haja ambiguidade, pedir detalhes).
3. Ler em voz alta um resumo e solicitar confirmação explícita antes de escrever.
4. Usar transação ou verificação de versão no Firestore para não sobrescrever modificações paralelas.
5. Registrar auditoria do comando, evitar repetição por requestId e permitir desfazer quando viável.
6. Para excluir, usar confirmação reforçada; para transferência, pagamento real e compra, **não executar** pela Skill.

## Privacidade e segurança
Uma Echo ou um celular com Alexa pode ouvir outras pessoas próximas. Consultas sensíveis (saldos, dívidas, investimentos) devem ter opção de bloqueio ou detalhamento restrito; recomenda-se confirmação adicional para edições. Não há garantia de reconhecimento perfeito da voz ou do número ditado.

## Documentação Amazon
- https://developer.amazon.com/docs/alexa/account-linking/standard-account-linking.html
- https://developer.amazon.com/docs/alexaplus/account-linking/requirements-account-linking
- https://developer.amazon.com/docs/alexaplus/account-linking/configure-authorization-code-grant

## Progresso
- [x] Modelos de reconhecimento equivalentes em pt-BR, en-US, it-IT e es-ES.
- [x] Respostas-base traduzidas para as quatro localidades.
- [ ] Compilar e validar os quatro modelos no console Amazon.
- [ ] Skill criada na conta Amazon Developer.
- [ ] Serviço OAuth implementado, implantado e auditado.
- [ ] Endpoint de Skill implantado com autenticação e proteção contra replay.
- [ ] Primeira consulta real validada no aplicativo Alexa.
- [ ] Ações de escrita com confirmação, auditoria e testes.
- [ ] Publicação da Skill, se desejado.
