# FinControl Pro — Android (APK de teste)

Este projeto cria um aplicativo Android com WebView que abre o site oficial:
https://mateusjk06.github.io/Fin-control-pro/

## Sincronização
- O site e o aplicativo usam a mesma interface publicada no GitHub Pages e o mesmo projeto Firebase já existente.
- Entre com o **mesmo email e senha** usados no site para acessar seus dados.
- As alterações são gravadas na mesma conta do Firestore e serão vistas ao atualizar a outra versão.
- Você precisa de internet; esta versão não oferece modo offline garantido.

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
- O reconhecimento de voz Web Speech API pode não ser oferecido pelo WebView. Você pode usar o ditado do teclado Android no campo do Gemini.
- Para publicar na Play Store será necessário assinatura release permanente, política de privacidade e verificações adicionais.
- Os links externos abrem o navegador, evitando exibir páginas não confiáveis no WebView.
- Os comandos `fincontrolpro://assistente` abrem o assistente, mas **não** ativam automaticamente o Gemini do sistema / “Hey Google”.
