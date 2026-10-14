# Marmitaria V2 — reformulação (14/10/2026, PR #168)

## Erros corrigidos
- B-016: código duplicado `MARM-001` (lista falhava calada) + ingredientes, custo e preço que nunca eram gravados. Gravação agora é uma transação no banco (`marmitaria_salvar_ficha`).
- Navegação duplicada (submenu de 14 itens no menu de cima + barra de 19 abas): agora 6 áreas, sem rolagem lateral.
- RH: link `/dashboard/rh/colaborador` quebrado; teste de folgas de domingo desatualizado.

## Decisões
- Marmita = `fichas_tecnicas` com `departamento = 'marmitaria'`. Pré-preparo criado pela marmitaria vai para a base da cozinha (eh_base), compartilhado e espelhado no estoque de pré-preparos.
- Receita do DRE vem de `marmitaria_vendas` (lançamento manual até haver iFood). Vendas da marmitaria NÃO entram no faturamento diário do restaurante.
- Consolidado = DRE gerencial da unidade + só vendas/tributos/taxas da marmitaria (o resto já está na unidade).
- CMV real só dos locais `marmitaria` e `embalagens-marmitaria`; sem contagem nas duas pontas, usa CMV previsto pela ficha marcado ESTIMATIVA.
- CMO: fração alocada do custo do RH (FGTS 8%, provisões 13º 8,33% e férias 11,11%; INSS patronal do anexo do RH). O resto fica no restaurante.
- Taxas de canal: nenhuma vem preenchida; o dono informa as do contrato.

## Validação
TESTADO LOCAL: 445/445 em app/lib com PGlite; build. TESTADO NO SUPABASE REAL: ensaio em transação desfeita. NÃO VALIDADO: telas no navegador (aguardam APR-005), iFood (tabela integration_events ausente, unidade sem merchant).

## Depende de fora
- APR-005 (aplicar a migração).
- iFood: credenciais/merchant, tabela de eventos, homologação. Até lá, vendas manuais.
