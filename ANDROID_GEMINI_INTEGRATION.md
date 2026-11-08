# Voz e integração Android — FinControl Pro

## Etapa 1 — disponível no site
- Abra a aba Gemini, toque no microfone, autorize o microfone e fale.
- Revise o texto reconhecido e toque em **Enviar**.
- O Gemini já usa o Firebase AI Logic configurado no aplicativo e, antes de qualquer mudança financeira, exige confirmação explícita.
- Em dispositivos sem Web Speech API, utilize o ditado do teclado Android.
- O texto pode ser reconhecido por serviços do navegador/sistema. Não informe senhas ou dados sensíveis pelo microfone.

## Etapa 2 — entrada por atalho pronta, integração direta com Gemini do sistema pendente
- O arquivo `manifest.webmanifest` inclui o atalho "Assistente financeiro por voz".
- A URL `./?assistente=1` abre a aba Gemini e permite ditar comandos.
- A URL `./?fincontrol_cmd=<texto codificado>` prepara um **rascunho**; o usuário obrigatoriamente revisa e envia.
- Conteúdo vindo por URL nunca é executado automaticamente e só é exibido após login.
- Você pode adicionar o site à Tela inicial do Android para acesso rápido. A disponibilidade dos atalhos depende do navegador.
- Isso **não constitui integração direta** com o app Gemini ou com "Hey Google". O Android AppFunctions é experimental e a integração com o Gemini do sistema segue acesso restrito; será necessário um aplicativo Android nativo compatível e acesso ao programa de integração antes de prometer comandos diretamente no assistente do sistema.
- Alternativa disponível hoje: abrir o atalho do FinControl Pro ou ditar pelo teclado do Android.

## Segurança
- Não colocar credenciais privadas do Firebase ou Gemini em links ou no repositório.
- Toda mudança financeira deve exigir usuário autenticado, validação e aprovação explícita.
- Nunca aceitar comandos externos via URL como autorização para modificar valores.
