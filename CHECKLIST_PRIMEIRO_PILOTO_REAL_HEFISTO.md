# CHECKLIST DE PREPARAÇÃO DO PRIMEIRO PILOTO REAL — ERP HÉFISTO
## REQUISITOS OBRIGATÓRIOS ANTES DE RECEBER UM RESTAURANTE EXTERNO

**Versão do Sistema:** 1.0.0-rc.1  
**Data de Emissão:** 22 de Setembro de 2026  
**Status Geral de Prontidão:** `READY TO PREPARE REAL PILOT` — `PENDENTE DE RESTORE REAL DE INFRAESTRUTURA E CLIENTE`  

---

### 📌 LEGENDA DE ESTADOS DE VERIFICAÇÃO
- `CONCLUÍDO`: Requisito técnico pronto e verificado na aplicação.
- `CONFIGURADO (NÃO VALIDADO)`: Recurso ativado na plataforma, mas pendente de teste de infraestrutura real.
- `PENDENTE`: Aguardando definição de ambiente ou envio de dados reais pelo cliente/operação.
- `BLOQUEADO`: Impedimento técnico ou contratual ativo.

---

### 📋 MATRIZ DE VERIFICAÇÃO DE PRÉ-PILOTO REAL

| Requisito de Infraestrutura e Operação | Estado Atual | Responsável | Observação Técnico-Operacional |
| :--- | :--- | :--- | :--- |
| **1. Ambiente oficial do piloto definido** | `CONCLUÍDO` | Infra / DevOps | Definido ambiente `STAGING_PILOT` isolado de desenvolvimento. |
| **2. URL definida** | `CONCLUÍDO` | Infra / Vercel | Vercel Deployment sob URL oficial de staging do Héfisto. |
| **3. Banco de dados definido** | `CONCLUÍDO` | Supabase Admin | PostgreSQL isolado com RLS ativado em 100% das tabelas. |
| **4. Backup confirmado** | `CONFIGURADO (NÃO VALIDADO)` | Supabase Admin | Backups automáticos diários gerenciados ativados (Retenção 7 dias). PITR é Add-on Pro pago. |
| **5. Restore de infraestrutura testado** | `PENDENTE` | Supabase / DevOps | `RESTORE LÓGICO AUTOMATIZADO` aprovado. Restore de instância física Cloud pendente. |
| **6. Cobertura de Backup no Storage** | `PENDENTE` | DevOps / Infra | Dumps de PostgreSQL não cobrem arquivos binários do S3. Requer sincronização separada do Storage. |
| **7. Responsável técnico definido** | `CONCLUÍDO` | Equipe Héfisto | Engenheiro de suporte nomeado para atendimento do piloto. |
| **8. Restaurante piloto confirmado** | `PENDENTE` | Comercial / Ops | Aguardando confirmação contratual e aceite do restaurante cliente real. |
| **9. Administrador do restaurante identificado** | `PENDENTE` | Cliente Piloto | Nome e e-mail do admin serão inseridos no momento do onboarding. |
| **10. Plano piloto definido** | `CONCLUÍDO` | Comercial / SaaS | Plano `PILOT_PRO` (Ingredientes, Fichas, Produção, Estoque, Vendas, DRE). |
| **11. Contrato/Termo de Uso tratado fora do código** | `CONCLUÍDO` | Jurídico | Termo de adesão e SLA de suporte formalizados em documento legal externo. |
| **12. Usuários credenciados** | `PENDENTE` | Cliente Piloto | Usuários operacionais serão vinculados via Control Plane `/admin`. |
| **13. Hardware operacional verificado** | `PENDENTE` | Suporte Piloto | Dispositivos e impressoras locais serão checados no dia do onboarding. |
| **14. Conexão de internet validada** | `PENDENTE` | Cliente Piloto | Requerida conexão estável mínima de 10 Mbps na operação do cliente. |
| **15. Estoque inicial (Opening Balance)** | `PENDENTE` | Cliente / Consultoria | Saldo físico inicial será inserido via engine oficial de inventário (origem `INVENTARIO_INICIAL`). |
| **16. Cadastros de Fichas Técnicas** | `PENDENTE` | Cliente / Chef | Fichas reais serão cadastradas pelo cliente ou importadas de planilha real. |
| **17. Cadastro de Fornecedores** | `PENDENTE` | Cliente / Compras | Dados de fornecedores reais serão inseridos pelo cliente. |
| **18. Parâmetros Financeiros de Abertura** | `PENDENTE` | Cliente / Financeiro | Saldos bancários e taxas de cartões/iFood serão inseridos via onboarding. |
| **19. Treinamento da equipe** | `PENDENTE` | Suporte Héfisto | Sessão de onboarding e treinamento guiado para a equipe do restaurante. |
| **20. Canal de Suporte por Operation ID** | `CONCLUÍDO` | Suporte Héfisto | Ferramenta em `/admin` e helper `app/lib/telemetria.js` prontos para rastreabilidade. |

---

### 🚨 REGRA RÍGIDA DE PROVISIONAMENTO
Quando o primeiro restaurante cliente real for confirmado:
1. **PROIBIDO** realizar qualquer `INSERT` manual em tabelas via SQL direto.
2. O cadastro DEVE ser feito exclusivamente pelo Control Plane (`/admin`) usando a RPC `provisionar_novo_tenant`.
3. Nenhum dado sintético ou fictício deve ser carregado para a conta do cliente.
