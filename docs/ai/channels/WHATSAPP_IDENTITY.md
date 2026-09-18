# Resolução de Identidade do WhatsApp — Héfisto (Fase 3A)

## 1. Tabela `whatsapp_identities`
A tabela `whatsapp_identities` mapeia números de telefone E.164 autorizados para usuários registrados no ERP.

```sql
CREATE TABLE IF NOT EXISTS whatsapp_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number VARCHAR(30) NOT NULL UNIQUE,
  user_id UUID NOT NULL,
  empresa_id UUID NOT NULL,
  unidade_id UUID NOT NULL,
  role VARCHAR(50) DEFAULT 'admin',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

## 2. Algoritmo de Resolução (`resolveWhatsAppIdentity`)
Quando uma mensagem chega via Webhook:
1. O número E.164 (`wa_id`) é higienizado (ex: `5511999998888`).
2. É realizada uma busca na tabela `whatsapp_identities` filtrando por `phone_number = wa_id` E `is_active = true`.
3. Se encontrado, é retornado a estrutura de identidade:
   ```json
   {
     "id": "uuid...",
     "phone_number": "5511999998888",
     "user_id": "uuid...",
     "empresa_id": "uuid...",
     "unidade_id": "uuid...",
     "role": "admin",
     "is_active": true
   }
   ```
4. Se não encontrado, a mensagem é bloqueada e uma notificação de acesso não autorizado é enviada ao remetente ("Número não vinculado ou sem permissão de acesso").

## 3. Atribuição Inicial na Fase 3A
Na Fase 3A, a autorização de uso do canal WhatsApp é estritamente restrita a **Usuários Internos / Administradores** pré-cadastrados na tabela `whatsapp_identities`.
