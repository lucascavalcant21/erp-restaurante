# CHECKLIST DE IMPLANTAÇÃO DO PILOTO SAAS — ERP HÉFISTO
## GUIA DE OPERAÇÃO E ONBOARDING PARA CLIENTES PILOTO EXTERNOS

**Versão da Plataforma:** 1.0.0-rc.1  
**Objetivo:** Orientar o onboarding de restaurantes piloto em ambiente real, mantendo rigor na verificação técnica e segurança de dados.

---

### 📋 FASE 1: PRÉ-ONBOARDING & ALINHAMENTO TÉCNICO

- [ ] **Alinhamento de Expectativas:** Confirmar plano `PILOT_PRO` (Ingredientes, Fichas, Produção, Estoque, Vendas, Recebíveis, Financeiro/DRE).
- [ ] **Levantamento Operacional:** Mapear tipo de culinária, horário de funcionamento e unidades físicas.
- [ ] **Verificação de Hardware:** Validar navegadores nos computadores/tablets e conexões com impressoras locais.
- [ ] **Coleta de Metadados:** Razão Social, Nome Fantasia, CNPJ e e-mail do Administrador.

---

### 🚀 FASE 2: PROVISIONAMENTO NO CONTROL PLANE SAAS (`/admin`)

- [ ] **Provisionamento do Tenant:** Executar a criação via interface `/admin` (RPC `provisionar_novo_tenant`).
- [ ] **Validação Atômica:** Confirmar geração de IDs da Empresa (`emp-xxxx`), da Unidade (`unid-xxxx`) e do usuário Administrador.
- [ ] **Verificação de Isolamento:** Confirmar que o novo tenant nasce com **0 registros** das demais empresas.

---

### 🥩 FASE 3: CARGA INICIAL DE DADOS & CUTOVER

- [ ] **Insumos:** Cadastrar lista de ingredientes com preços reais de compra e unidades.
- [ ] **Fichas Técnicas:** Cadastrar receitas com modo de preparo e rendimento por porção.
- [ ] **Corte de Estoque (Opening Balance):** Inserir a contagem física do primeiro dia de operação.
- [ ] **Meios de Pagamento:** Configurar taxas de cartões e prazos de recebimento.

---

### ⚙️ FASE 4: OPERAÇÃO REAL & TELEMETRIA

- [ ] **Rotina Diária:** Operar Produção do Dia, Vendas no PDV, Baixa de Estoque e Lançamento de Contas a Pagar.
- [ ] **Observabilidade no Control Plane:** Monitorar latência de RPCs (meta &lt; 50ms), erros de aplicação e status de saúde (`GREEN`).
- [ ] **Privacidade de Dados:** Garantir que o Control Plane exiba exclusivamente dados técnicos (latência, status code, logs de erro sanitizados), sem expor faturamento ou dados comerciais.

---

### 🛟 FASE 5: SUPORTE TÉCNICO POR OPERATION ID

- [ ] **Atendimento via Correlation ID:** Em caso de erro técnico, solicitar ao usuário o `operation_id` exibido na tela.
- [ ] **Diagnóstico Sanitizado:** Consultar o log técnico em `/admin` para visualizar endpoint e stack trace sanitizado.
- [ ] **Categorização por Severidade:** Registrar incidentes nas categorias `SEV1` (Crítico), `SEV2` (Alto), `SEV3` (Médio) e `SEV4` (Dúvida/UX).

---

### 📦 FASE 6: EXPORTAÇÃO DE DADOS VALIDADA

- [ ] **Validação de Saída:** Executar o teste de extração dos dados do tenant via `/api/saas/export` ou botão em `/admin`.
- [ ] **Verificação de Portabilidade:** Validar geração do pacote JSON contendo Unidades, Ingredientes, Fichas Técnicas, Movimentações de Estoque, Vendas, Recebíveis e Contas Financeiras.
