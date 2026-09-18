# 04 — Channel Architecture (Omnichannel Ingestion)

> **Status:** Especificação Técnica Conceitual (Arquitetura)  
> **Sistema:** Cerebro ERP (FoodERP) / Hefisto AI Core  
> **Princípio Central:** **Zero Fragmentação de Bots.** Todos os canais (Chat Interno, WhatsApp, Instagram Direct, Voz e Webhooks) alimentam o **MESMO** Agent Core através de adaptadores normalizados.

---

## 1. Topologia da Arquitetura Omnichannel

`
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   WhatsApp API  │  │ Instagram Direct│  │ Chat Interno ERP│  │  Kiosk / App RH │  │  Voz / Telefonia│
│ (Evolution/Meta)│  │   (Graph API)   │  │   (UI Hefisto)  │  │ (Tablet Salão)  │  │   (Whisper/STT) │
└────────┬────────┘  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘
         │                    │                    │                    │                    │
         ▼                    ▼                    ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   CHANNEL ADAPTER LAYER                                         │
│         Converte payloads específicos de cada provedor no contrato canônico NormalizedMessage   │
└────────────────────────────────────────────────┬────────────────────────────────────────────────┘
                                                 │
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                       NORMALIZED MESSAGE                                        │
└────────────────────────────────────────────────┬────────────────────────────────────────────────┘
                                                 │
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                           AGENT CORE                                            │
│            (RequestContext -> Tool Registry -> Permission Engine -> Domain Actions)             │
└────────────────────────────────────────────────┬────────────────────────────────────────────────┘
                                                 │
                                                 ▼
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   OUTBOUND RESPONSE FORMATTER                                   │
│            (Renderiza texto rico, botões interativos WhatsApp, cards de confirmação, etc.)      │
└─────────────────────────────────────────────────────────────────────────────────────────────────┘
`

---

## 2. Contrato Canônico: NormalizedMessage

O contrato TypeScript conceitual abaixo padroniza todas as entradas:

`	ypescript
export type ChannelType = 
  | 'whatsapp'
  | 'instagram'
  | 'chat_erp'
  | 'app_kiosk'
  | 'voice'
  | 'automation';

export type AttachmentType = 
  | 'image' 
  | 'audio' 
  | 'document' 
  | 'video' 
  | 'location';

export interface MessageAttachment {
  type: AttachmentType;
  url?: string;
  mimeType: string;
  base64?: string;
  sizeBytes?: number;
  metadata?: {
    width?: number;
    height?: number;
    durationSeconds?: number;
    latitude?: number;
    longitude?: number;
    fileName?: string;
  };
}

export interface NormalizedMessage {
  /** Canal de origem da mensagem */
  channel: ChannelType;
  
  /** Identificador externo do emissor (ex: número telefone no WhatsApp, IG handle, ou UUID no ERP) */
  externalUserId: string;
  
  /** ID único da mensagem gerado pelo provedor de origem (evita duplicações) */
  messageId: string;
  
  /** ID da sessão/thread de conversa persistida no ERP */
  conversationId: string;
  
  /** Texto puro da mensagem transcrito ou enviado pelo usuário */
  text: string;
  
  /** Anexos enviados (fotos de checklist, áudios de voz, comprovantes PDF) */
  attachments: MessageAttachment[];
  
  /** Timestamp ISO 8601 do momento do envio */
  timestamp: string;
  
  /** Metadados contextuais adicionais */
  metadata: {
    senderName?: string;
    isStaffMember?: boolean;
    colaboradorId?: string;
    unidadeId?: string;
    deviceInfo?: string;
    rawPayload?: Record<string, any>;
  };
}
`

---

## 3. Especificação dos Channel Adapters

### A. WhatsApp Adapter (Meta Cloud API / Baileys / Evolution API)
- **Entrada:** Webhook POST /api/webhooks/whatsapp.
- **Tratamento de Áudio (Voz):**
  1. Baixa o buffer .ogg/.opus.
  2. Transcreve via STT (Whisper / Gemini multimodal).
  3. Preenche NormalizedMessage.text com a transcrição e anexa o áudio em ttachments.
- **Tratamento de Imagem (Evidências de Checklist):**
  1. Salva a foto no bucket nexos/operacao do Supabase.
  2. Encaminha a URL pública e hash no payload da NormalizedMessage.

### B. Instagram Adapter (Meta Graph API)
- **Entrada:** Webhook POST /api/webhooks/instagram.
- **Casos de Uso:**
  - Atendimento ao cliente externo (cardápio, reservas de eventos, horário de funcionamento).
  - Escopo restrito a Tools de leitura pública (cardapio.consultar, eventos.consultar, eservas.criar_reserva).

### C. Chat Interno ERP (Assistente Heitor)
- **Entrada:** Rota autenticada do Next.js via Session Token.
- **Contexto Nativo:** Já recebe o RequestContext completo (unidadeId, usuarioId, permissions).

---

## 4. Prevenção de Conflitos e Bloqueio de Concorrência

1. **Session Lock:** Quando uma mensagem de um determinado externalUserId estiver sendo processada no Agent Core, novas mensagens da mesma pessoa são enfileiradas com debounce de 1.500 ms.
2. **Mensagens Fora de Ordem:** O adapter rejeita mensagens cujo 	imestamp seja anterior ao último processado na conversa.
