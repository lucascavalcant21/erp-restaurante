---
id: HDEV-RH-001
titulo: Reestruturação do RH, contratos e ciclo de vida do colaborador
fase: RH
status: IN_PROGRESS
prioridade: 1
dependencias: []
bloqueadores: []
tentativas: 0
sem_progresso: 0
mesma_falha: 0
ultima_falha: ""
atualizado_em: 2026-10-13
---

# HDEV-RH-001 — Reestruturação do RH

## Objetivo

Levar o módulo de funcionários do Héfisto do primeiro serviço prestado até a efetivação ou o desligamento: cadastro, vínculos, direitos, extras, desligamento e integrações. O texto da missão (11 fases) foi colado pelo dono em 13/10/2026.

Autorização do dono (13/10): publicar as fases com checks verdes e migrações aditivas ensaiadas sem pedir PR a PR. Continua exigindo aprovação o que for destrutivo, envolver pagamento real, desligamento real ou regra jurídica pendente do contador.

## Critério de pronto

- [x] Fase 1: Editar do perfil abre o colaborador certo, sem duplicar (#154, #156). TESTADO EM PRODUÇÃO
- [x] CCT Foz 2026/2027 cadastrada e ativa a partir de 2026-10, sem recalcular meses anteriores (#155, #157). TESTADO NO SUPABASE REAL
- [x] Fase 2: prontuário com 10 abas (#158). TESTADO EM PRODUÇÃO
- [x] Fase 3: vínculos e transições (RH-4, RH-4b, #159), 23 vínculos carregados. TESTADO EM PRODUÇÃO (aba conferida em 13/10)
- [x] Fase 4a: motor de direitos e tabelas oficiais datadas; simulação do mês no prontuário (#160). TESTADO EM PRODUÇÃO (Eduarda, 10/2026: INSS 188,74 sobre 2.367,33, conferido à mão)
- [ ] Fase 4b: guardar o cálculo do mês com situação (simulação → validado → pago → obrigação cumprida) e aprovação do contador. Exige migração aditiva.
- [ ] Fase 5: cadastro em etapas
- [ ] Fase 6: controle de extras (habitualidade, intermitente)
- [ ] Fase 7: desligamento completo
- [ ] Fase 8: integrações (folha → financeiro/DRE/CMO, escala, portal)
- [ ] Fase 11: central de contratos e pendências

## Pendências com o contador (não bloqueiam o código, bloqueiam o efeito)

- Tabelas de 2026 (INSS, IRRF) conferidas em fontes secundárias. Divergem em centavos no teto. Conferir contra a Portaria MPS/MF 13/2026.
- Encargos patronais (INSS empresa, RAT, terceiros): dependem do regime tributário.
- Vale-alimentação: PAT/cartão ou dinheiro (em dinheiro, integra o salário).
- Diária dos extras "desmembrada" em INSS 5% + FGTS 8% + taxa 10% (`app/dashboard/rh/page.js`, recibo de extra): base legal não identificada. Não foi alterada. Decidir na Fase 6.
- 21 cláusulas da CCT marcadas para revisão; regime de feriados e banco de horas; hora noturna reduzida entre 5h e 7h.
- Cabeçalho do prontuário mostra a modalidade do cadastro antigo ("Contrato Definitivo") enquanto o vínculo diz "experiência" (ex.: Eduarda). Corrigir na Fase 5 para ler de `rh_vinculos`.
