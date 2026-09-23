# CHECKLIST DE GO-LIVE E IMPLANTAÇÃO CONTROLADA
## ERP HÉFISTO 1.0 RC — OPERAÇÃO REAL DO PRIMEIRO RESTAURANTE

**Versão Target:** 1.0.0-rc.1  
**Data da Implantação:** 22 de Setembro de 2026  

---

### 📋 FASE A: VALIDAÇÕES DE SEGURANÇA E AMBIENTE
- [x] **Restore Drill Real:** Executado `node scripts/test_restore_drill_hefisto.mjs` com sucesso (< 500ms).
- [x] **Varredura de Segredos & Bundle:** Executado `node scripts/test_env_bundle_security.mjs` (0 vazamentos de `service_role`).
- [x] **Lockdown de `search_path`:** 100% das 20 RPCs com `SET search_path = public, pg_temp`.
- [x] **Navegação Unificada:** 7 domínios operacionais configurados e testados.

---

### 📋 FASE B: REQUISITOS FÍSICOS E HARDWARE
- [x] **Impressão TSPL de Etiquetas:** Executado `node scripts/test_hardware_tspl_validation.mjs`. Mídia 60x40mm com GAP, QR Code e validade validada.
- [x] **Rede Wi-Fi Operacional:** Cozinha, Bar, Estoque e Caixa com sinal verificado.
- [x] **Tablets Operacionais:** Interface touch testada no navegador dos tablets.

---

### 📋 FASE C: CARGA INICIAL DE DADOS & DATA DE CORTE
- [x] **Data de Corte Definida:** Data oficial estabelecida para migração de fonte da verdade.
- [x] **Inventário Físico Inicial:** Executado `node scripts/test_inventario_inicial_hefisto.mjs`. Lançamentos de estoque realizados via `SALDO_INICIAL`.
- [x] **Saldos Bancários e Caixa:** Saldos de abertura inseridos com data de corte.
- [x] **Usuários & Credenciais:** Credenciais individuais atribuídas por funcionário.

---

### 📋 FASE D: CHECKLIST DIÁRIO DA PRIMEIRA SEMANA DE OPERAÇÃO
- [ ] **Dia 1:** Abertura do ERP na Central de Comando -> Verificar se há erros no console.
- [ ] **Dia 2:** Conferência de Produção do Dia vs Consumo Teórico de Estoque.
- [ ] **Dia 3:** Registro de Pedido de Compra e Entrada de Nota Fiscal via Recebimento.
- [ ] **Dia 4:** Fechamento de Vendas do Dia e Conferência de Cartões/PIX.
- [ ] **Dia 5:** Baixa de Contas a Pagar e Conciliação Bancária.
- [ ] **Dia 6:** Emissão e Impressão de Etiquetas TSPL na Cozinha.
- [ ] **Dia 7:** Conferência da DRE Econômica do Restaurante.
