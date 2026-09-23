# RUNBOOK DE OPERAÇÃO E RESPOSTA A INCIDENTES EM PRODUÇÃO
## ERP HÉFISTO — MANUAL DE CRISE, DISASTER RECOVERY & RESTAURAÇÃO DE INFRAESTRUTURA

**Versão:** 1.0.0-rc.1  
**Última Atualização:** 22 de Setembro de 2026  
**Ambiente Target:** Staging / Produção SaaS Héfisto  

---

### 1. RESPONSABILIDADES E EQUIPE DE OPERAÇÃO DE CRISE

| Papel | Responsável | Atribuição em Crise |
| :--- | :--- | :--- |
| **Comandante de Incidentes (IC)** | Engenheiro de Infra / DevOps | Tomada de decisão, acionamento de contingência e coordenação de restore. |
| **Líder de Banco de Dados (DBA)** | Supabase / Database Admin | Execução de dumps, validação de PITR e restauração do PostgreSQL. |
| **Líder de Storage & Mídia** | Engenheiro de Software | Sincronização de buckets S3, validação de arquivos e checagem de URLs (Zero 404). |
| **Suporte ao Cliente / Piloto** | Engenheiro de Suporte | Atendimento por `operation_id` sanitizado e comunicação com o restaurante. |

---

### 2. PROTOCOLOS DE EMERGÊNCIA E DISASTER RECOVERY REAL

#### 🚨 INCIDENTE 1: QUEDA OU CORRUPÇÃO DO BANCO DE DADOS (POSTGRESQL)

- **Passo 1: Verificação de Impacto e Isolamento**
  - Checar o status da infraestrutura em `status.supabase.com`.
  - **NUNCA** executar restauração destrutiva sobre a instância de produção ativa.

- **Passo 2: Exportação do Backup / Snapshot**
  ```bash
  # Download do backup lógico atual via CLI Supabase (preserva RLS e DDLs)
  supabase db dump --project-ref <PROJECT_REF> -f backup_hefisto_prod.sql
  ```

- **Passo 3: Restauração em Instância Isolada de Destino**
  ```bash
  # Criar projeto/instância isolada e aplicar o backup
  psql -h <HOST_DESTINO_ISOLADO> -U postgres -d postgres -f backup_hefisto_prod.sql
  ```

- **Passo 4: Smoke Test Integrado na Base Restaurada**
  - Conectar a aplicação à nova instância isolada.
  - Executar a suíte de fumaça: `node scripts/test_jornadas_e2e_hefisto.mjs`.
  - Validar entidades: Empresa, Unidade, Usuário, Ingrediente, Ficha Técnica, Estoque, Produção, Compra, Conta a Pagar, Venda, Recebível e Conciliação.

---

#### 🚨 INCIDENTE 2: RESTAURAÇÃO DE ARQUIVOS E ANEXOS (SUPABASE OBJECT STORAGE)

> [!IMPORTANT]
> **Diferenciação Obrigatória:** O backup de banco de dados (`pg_dump`) restaura apenas a tabela `storage.objects` (metadados). Ele **NÃO RESTAURA OS ARQUIVOS BINÁRIOS NO S3**. O procedimento de Storage deve ser executado separadamente.

- **Passo 1: Mapeamento de Buckets Críticos**
  - Buckets auditados: `anexos`, `rh-docs` (privado), `notas-fiscais` (privado), `evidencias-operacao` (privado), `eventos-banners` (público).

- **Passo 2: Execução de Backup do Storage**
  ```bash
  # Executar o backup de arquivos preservando caminhos [empresa_id]/[unidade_id]/...
  node scripts/test_storage_backup_restore_hefisto.mjs
  ```

- **Passo 3: Restauração dos Objetos do Storage**
  - Fazer upload dos binários salvos para os buckets da nova instância isolada.
  - Validar a integridade referencial entre as colunas de arquivo no banco (`storage_path`) e o Storage.
  - **Critério Rígido:** Nenhum registro no banco pode retornar HTTP 404 no Storage.

---

#### 🚨 INCIDENTE 3: FALHA EM DEPLOY OU REGRESSÃO DE APLICAÇÃO (VERCEL)

- **Passo 1:** Acessar a Vercel -> Projeto Héfisto -> **Deployments**.
- **Passo 2:** Localizar o último deployment verde validado.
- **Passo 3:** Executar **Instant Rollback** (Tempo de recuperação < 15 segundos).

---

### 3. METRICAS OBSERVADAS DE RTO E RPO

- **RPO (Recovery Point Objective):**
  - *PostgreSQL:* 24 horas (Snapshots automáticos diários Supabase) ou 1 minuto (Se Add-on PITR Pro contratado).
  - *Storage:* Sincronização diária (Janela máxima de perda de mídia: 24h).
- **RTO (Recovery Time Objective):**
  - *Restore Lógico de Banco:* < 1 minuto (Script automatizado).
  - *Rollback de Frontend (Vercel):* < 15 segundos.
  - *Restore de Infraestrutura Cloud Completa:* 15 a 45 minutos (Pendente de execução em nova instância gerenciada).

---

### 4. LOGS E SUPORTE POR OPERATION ID

- **Origem dos Erros:** Qualquer exceção runtime gera um `operation_id` rastreável (ex: `op_1672938491_a8f1`).
- **Diagnóstico em `/admin`:** Acessar o Control Plane -> **Modo de Diagnóstico** -> Pesquisar pelo `operation_id`.
- **Privacidade de Dados:** Os logs de suporte registram estritamente endpoint, status code, erro e stack trace sanitizado. **Zero gravação de dados comerciais privados do restaurante**.
