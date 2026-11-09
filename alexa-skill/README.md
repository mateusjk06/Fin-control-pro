# Alexa + FinControl Pro — integração por etapas

## Situação real
O FinControl Pro atualmente tem um **simulador** na aba Alexa e uma integração de microfone **dentro** do APK para Gemini. Isso **não** significa que a Skill da Alexa esteja publicada ou ligada ao Firebase.

Este diretório inclui o **modelo de interação pt-BR** para uma Skill personalizada chamada **Controle Financeiro**. O nome final de invocação depende da validação da Amazon.

## Etapa A: configurar a Skill (ação manual na Amazon)
1. Criar/entrar em uma conta em https://developer.amazon.com/alexa/console/ask.
2. Criar uma **Custom Skill**, idioma **Português (Brasil)**, nome **FinControl Pro**.
3. Em Build > Interaction Model > JSON Editor, importar `interaction-model-pt-BR.json`.
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
- [x] Modelo inicial de intents em português.
- [ ] Skill criada na conta Amazon Developer.
- [ ] Serviço OAuth implementado, implantado e auditado.
- [ ] Endpoint de Skill implantado com autenticação e proteção contra replay.
- [ ] Primeira consulta real validada no aplicativo Alexa.
- [ ] Ações de escrita com confirmação, auditoria e testes.
- [ ] Publicação da Skill, se desejado.
