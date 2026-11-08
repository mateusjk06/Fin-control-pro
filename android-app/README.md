# FinControl Pro — Android (APK de teste)

Este projeto cria um aplicativo Android com WebView que abre o site oficial:
https://mateusjk06.github.io/Fin-control-pro/

## Sincronização
- O site e o aplicativo usam a mesma interface publicada no GitHub Pages e o mesmo projeto Firebase já existente.
- Entre com o **mesmo email e senha** usados no site para acessar seus dados.
- As alterações são gravadas na mesma conta do Firestore e o site observa atualizações de outros aparelhos em tempo real, desde que estejam conectados. Edições simultâneas da mesma conta ainda podem sobrescrever dados; evite alterar os mesmos registros em dois aparelhos ao mesmo tempo.
- Você precisa de internet; esta versão não oferece modo offline garantido.

## Notificações nativas no Android (versão 1.4)
- O APK pede a permissão **Notificações** no Android 13 ou superior.
- Depois do login, o app copia os próximos vencimentos cadastrados para um agendamento local do próprio Android.
- Há lembretes **na véspera e no dia** para contas pendentes e parcelas de dívidas com data registrada.
- A verificação é feita quando o app está aberto e diariamente em segundo plano, aproximadamente às 9h. O Android pode atrasar o alarme por economia de bateria; não é garantia de horário exato.
- Abra o aplicativo conectado à internet periodicamente para sincronizar novos lançamentos e alterações. Quando estiver fechado, os avisos usam apenas o último cronograma sincronizado no aparelho, sem consultar o Firestore em segundo plano.
- Esta funcionalidade é **local**, não utiliza FCM Push e não depende de deixar o Chrome aberto. Com o logout ou lembretes desativados, o cronograma local é limpo quando o app sincronizar essa condição.
- Após a instalação, em Configurações do aparelho > Aplicativos > FinControl Pro > Notificações, confirme que os avisos estão permitidos.

## Gerar APK no GitHub Actions
1. Abra o repositório GitHub e a aba **Actions**.
2. Selecione **FinControl Pro - gerar APK Android** e clique em **Run workflow**.
3. Quando a execução ficar verde, abra-a e faça download do artefato **FinControl-Pro-Android-APK**.
4. Extraia o ZIP e instale **app-debug.apk** no Android. Talvez seja necessário autorizar instalação de apps desta fonte.

Também há compilação automática quando arquivos da pasta `android-app/` forem modificados.

## Android Studio
Abra **somente a pasta android-app** no Android Studio. Use JDK 17 e Gradle 8.13 com Android Gradle Plugin 8.13.2. O arquivo `gradle-wrapper.properties` existe, mas o JAR e o script do Gradle Wrapper não fazem parte deste repositório; o GitHub Actions instala o Gradle diretamente. No Android Studio, configure uma instalação local compatível ou gere um wrapper com `gradle wrapper`.

## Segurança e limitações
- O APK compilado no Actions é uma **versão debug assinada para testes**. Não é uma versão da Google Play; a assinatura debug pode mudar entre execuções e exigir desinstalar a anterior antes de instalar uma nova.
- O login por email e senha deve funcionar dentro do WebView. Login por provedores externos que dependem de OAuth (por exemplo Google) pode não funcionar em navegadores incorporados.
- **FCM Web Push cadastrado no Chrome não é FCM nativo do APK.** Continue com as notificações do Chrome por enquanto. Notificações nativas exigirāo integrar Firebase Messaging ao Android, configurar as credenciais móveis e testar separadamente.
- O reconhecimento Web Speech API pode não ser oferecido pelo WebView. O APK inclui um botão **🎙 Falar com assistente** que usa o reconhecimento nativo do Android para preencher o campo Gemini. Confira o texto e toque em Enviar.
- Para publicar na Play Store será necessário assinatura release permanente, política de privacidade e verificações adicionais.
- Os links externos abrem o navegador, evitando exibir páginas não confiáveis no WebView.
- Os comandos `fincontrolpro://assistente` abrem o assistente, mas **não** ativam automaticamente o Gemini do sistema / “Hey Google”.
