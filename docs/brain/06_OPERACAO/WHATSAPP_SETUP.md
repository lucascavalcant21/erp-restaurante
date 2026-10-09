# WhatsApp: o que o dono configura na Meta (HDEV-WA-001)

## Estado em produção (09/10/2026)

- App Meta **hefisto** `1410496401040910` (portfólio Hefisto `927661740418759`), **publicado**, política `https://app.hefisto.com.br/privacidade`.
- WABA `2312598276160019`, **assinada ao app** (`POST /{waba}/subscribed_apps`; sem isso a Meta não entrega mensagens).
- Número de teste +1 555 156 6178, Phone Number ID `1346801291845657`; destinatário cadastrado: o celular do dono.
- Webhook `/api/channels/whatsapp/webhook`, campo **messages** assinado (v26.0); envio pela Graph v25.0.
- Usuário do sistema `hefisto-whatsapp` (`61595443611916`): app = Desenvolver; WABA = Mensagens + Números (só visualização).
- Vercel Production: WHATSAPP_APP_SECRET, WHATSAPP_API_TOKEN, WHATSAPP_VERIFY_TOKEN (colados pelo dono), WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_NUMEROS_DONO, WHATSAPP_GRAPH_VERSION, WHATSAPP_DONO_AUTH_USER_ID, WHATSAPP_DONO_UNIDADE, WHATSAPP_PONTE_SEGREDO.
- Próximo passo para sair do número de teste: Etapa 2 → registrar um número próprio.


Caminho mais rápido: o **número de teste gratuito** que a Meta cria junto com o app. Ele manda e recebe mensagens para até 5 números cadastrados (o seu). Depois dá para trocar por um número próprio verificado sem mudar código.

> **Nunca mande no chat:** o token de acesso, o App Secret, o verify token nem o segredo da ponte. Eles vão direto na Vercel (ou no `.env.local`, no caso da ponte).
> **Pode mandar no chat:** o Phone number ID, o WhatsApp Business Account ID, o App ID e o seu número de celular.

## 1. Criar o app e o produto WhatsApp

1. Entre em **developers.facebook.com** → **My Apps** → **Create App**.
2. Caso de uso: **Other** → tipo **Business** → nome `Héfisto` → escolha (ou crie) o seu **Business portfolio**.
3. No painel do app: **Add product** → **WhatsApp** → **Set up**. A Meta cria uma conta WhatsApp Business e um número de teste.

## 2. Cadastrar o seu celular como destinatário

1. **WhatsApp → API Setup**.
2. Em **To**, clique em **Manage phone number list** → adicione o seu celular → confirme com o código que chega no WhatsApp.
3. Anote (pode mandar no chat): **Phone number ID** e **WhatsApp Business Account ID**, que aparecem nessa mesma tela.

## 3. Token permanente (usuário do sistema)

1. **business.facebook.com** → **Settings** (Configurações do negócio) → **Users → System users** → **Add** → nome `hefisto-whatsapp`, função **Admin**.
2. **Assign assets**: o app `Héfisto` (Full control) e a conta do WhatsApp (Full control).
3. **Generate new token** → app `Héfisto` → validade **Never** → permissões:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
4. Copie o token e **cole direto na Vercel** (passo 5). Não mande no chat.

## 4. App Secret

**developers.facebook.com** → seu app → **App settings → Basic** → **App secret → Show**. Cole direto na Vercel (passo 5).

## 5. Variáveis na Vercel (projeto `erp-restaurante`, ambiente **Production**)

Segredos (você cola; no PowerShell, na pasta do projeto, cada comando pede o valor sem mostrar):

```
vercel env add WHATSAPP_API_TOKEN production
vercel env add WHATSAPP_APP_SECRET production
```

Verify token (gera, copia para a área de transferência e grava; você cola na Meta no passo 6):

```
$v=[guid]::NewGuid().ToString('N')+[guid]::NewGuid().ToString('N'); $v | Set-Clipboard; $v | vercel env add WHATSAPP_VERIFY_TOKEN production
```

O agente configura sozinho (não são segredos): `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_NUMEROS_DONO`, `WHATSAPP_DONO_AUTH_USER_ID`, `WHATSAPP_DONO_UNIDADE` e o par `WHATSAPP_PONTE_SEGREDO` (Vercel) / `HEFISTO_PONTE_SEGREDO` (`.env.local`).

## 6. Webhook (só depois do deploy da versão nova em produção)

1. **WhatsApp → Configuration → Webhook → Edit**.
2. **Callback URL:** `https://app.hefisto.com.br/api/channels/whatsapp/webhook`
3. **Verify token:** cole o valor do passo 5 (Ctrl+V).
4. **Verify and save**. Depois, em **Webhook fields**, assine **messages**.

## 7. Como o agente confere que funcionou

1. Sem token certo, o webhook recusa: `GET …/webhook?hub.mode=subscribe&hub.verify_token=errado` → 403.
2. Depois do passo 6: você manda `status` e `como está minha empresa?` do celular.
3. O agente lê os logs da Vercel (`[whatsapp]`): `comando` → `respondido`, sem `envio falhou`.
4. Você recebe as duas respostas. Aí a missão vira TESTADO EM PRODUÇÃO.

## Ponte do agente (comandos de desenvolvimento)

No PC: `npm run hefisto:ponte` (deixe a janela aberta). Sem a ponte, o WhatsApp avisa que o computador está offline e o comando espera na fila.
