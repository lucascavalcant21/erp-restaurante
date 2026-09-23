# 05 — Visual Audit Architecture

> **Status:** Especificação Técnica Conceitual (Arquitetura)  
> **Sistema:** Cerebro ERP (FoodERP) / Hefisto AI Core  
> **Arquivos Reais Vinculados:** pp/lib/operacao-evidencias.js, pp/lib/checklists.js, pp/lib/auditoria.js  
> **Bucket Canônico:** Supabase Storage nexos (pasta operacao/)

---

## 1. Princípio Fundamental de Governança

> [!CAUTION]
> **REGRA DE OURO INVIOLÁVEL:**  
> **NUNCA permitir punição automática, advertência, corte de pontuação ou sanção disciplinar baseada exclusivamente em análise visual de IA.**  
> A IA multimodal atua estritamente como **assistente de triagem operacional e suporte à inspeção**. Qualquer apontamento de não-conformidade grave requer validação e confirmação humana mandatória por parte da liderança ou gestor de turno.

---

## 2. Fluxo Ponta a Ponta da Auditoria Visual

`
┌────────────────────────────────────────────────────────┐
│ 1. Captura da Foto no Aparelho (Cozinha/Salão/Bar)     │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 2. Pré-processamento & Prova Criptográfica no Client   │
│  - Compressão de Imagem (comprimirFoto -> max 1600px)  │
│  - Leitura de GPS de Alta Precisão (capturarLocalizacao│
│  - Geração de Hash SHA-256 (hashDoArquivo)             │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 3. Upload Seguro no Storage & Registro da Evidência    │
│  - Supabase Storage: anexos/operacao/{unidade}/{exec}  │
│  - Tabela: op_evidencias (vinculada ao item do check)  │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 4. Análise Visual Multimodal por IA (/api/ia-evidencia)│
│  - Inspeção dos critérios configurados no template     │
│  - Classificação: CONFORME / REVISAR / NÃO CONFORME    │
│  - Cálculo de Score de Confiança (0.0 a 1.0)           │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ├──► [Conforme (Score >= 0.85)] ──► Conclui item da rotina
                           │
                           ▼ [Não Conforme ou Dúvida (Score < 0.85)]
┌────────────────────────────────────────────────────────┐
│ 5. Geração de Pendência no Painel de Gestão            │
│  - Fica marcada para conferência na Central Operacional│
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 6. Revisão Humana Obrigatória (Gestor / Líder)         │
│  - Gestor visualiza foto original, hash e parecer da IA│
│  - Ações: [Aprovar Exceção] ou [Solicitar Nova Foto]   │
└──────────────────────────┬─────────────────────────────┘
                           │
                           ▼
┌────────────────────────────────────────────────────────┐
│ 7. Encerramento do Ciclo                               │
│  - Registro inalterável de quem revisou em op_evidencias│
└────────────────────────────────────────────────────────┘
`

---

## 3. Modelo de Dados da Evidência (op_evidencias)

A estrutura real implementada em pp/lib/operacao-evidencias.js preserva a rastreabilidade completa:

| Campo | Tipo | Propósito |
| :--- | :--- | :--- |
| id | uuid | Chave primária da evidência |
| execucao_id | uuid | Chave estrangeira para checklists_execucoes |
| item_id | 	ext | ID do item específico no template de checklist |
| unidade_id | 	ext | Escopo de isolamento multi-tenant |
| rquivo_caminho| 	ext | Caminho relativo dentro do bucket nexos |
| rquivo_url | 	ext | URL pública de visualização |
| hash_arquivo | 	ext | Hash SHA-256 do binário original para evitar adulterações |
| latitude | 
umeric | Coordenada GPS capturada no momento da foto |
| longitude | 
umeric | Coordenada GPS capturada |
| precisao_gps | 
umeric | Precisão em metros |
| dispositivo | 	ext | User-agent do smartphone/tablet |
| ia_status | 	ext | 'conforme', 'revisar', 'nao_conforme' |
| ia_confianca | 
umeric | Grau de certeza da IA (0 a 100%) |
| ia_motivo | 	ext | Justificativa técnica em texto do modelo |
| status | 	ext | 'valida', 'descartada' (evidências nunca são deletadas fisicamente) |
| evisado_por | 	ext | Nome do gestor humano que deu o veredito final |
| evisado_em | 	imestamptz| Data e hora da auditoria humana |

---

## 4. Integração com o Agent Core

O Agent Core pode interagir com o fluxo de auditoria visual através de 2 Tools específicas:

1. **uditoria.consultar_pendencias_visuais (READ):**
   Permite ao agente responder à liderança via chat/WhatsApp:  
   *Existem 3 fotos de fechamento da cozinha hoje com pendência de validação (fogão e câmara fria). Deseja revisá-las agora?*
2. **uditoria.aprovar_evidencia_humana (WRITE / HIGH RISK / CONFIRMAÇÃO OBRIGATÓRIA):**
   Permite que o gestor, após receber a foto pelo WhatsApp do ERP, aprove ou reprove a evidência respondendo diretamente pelo canal.
