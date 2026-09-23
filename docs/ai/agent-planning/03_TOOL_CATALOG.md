# 03 — Tool Catalog

> **Status:** Catálogo Técnico de Ferramentas Reais e Candidatas  
> **Sistema:** Cerebro ERP (FoodERP) / Hefisto AI Core  
> **Catálogo de Permissões Vinculado:** pp/lib/permissions-catalog.mjs  
> **Regra de Ouro:** Nenhuma função foi inventada. Cada tool aponta para uma função real existente ou declara expressamente NÃO EXISTE.

---

## 1. Módulo: Estoque

### estoque.consultar_saldo
- **DESCRIPTION:** Consulta o saldo atual de um ou todos os produtos/insumos da unidade.
- **INPUT:** { unidadeId?: string, produtoId?: string, departamento?: cozinha | bar }
- **OUTPUT:** { produtos: Array<{ id: string, nome: string, departamento: string, quantidade_atual: number, unidade_medida: string, estoque_minimo: number | null }> }
- **TIPO:** READ
- **RISCO:** LOW
- **CONFIRMAÇÃO:** SEM_CONFIRMACAO
- **PERMISSÃO:** estoque.overview.view
- **HANDLER FUTURO:** etchEstoque(unidadeId, deptUrl)
- **ARQUIVO:** pp/lib/estoque.js (linha 8)
- **TABELAS UTILIZADAS:** insumos, estoque_atual
- **VALIDAÇÃO EXISTENTE:** Sim (isSupabaseReady(), escopo de unidade).
- **CONTROLE DE PERMISSÃO:** Sim (via RLS e guard de rota).

---

### estoque.listar_estoque_minimo
- **DESCRIPTION:** Lista todos os insumos que estão com saldo atual igual ou abaixo do estoque mínimo configurado.
- **INPUT:** { unidadeId?: string, departamento?: string }
- **OUTPUT:** { itensAbaixoMinimo: Array<{ id: string, nome: string, quantidade_atual: number, estoque_minimo: number, unidade_medida: string, diferenca: number }> }
- **TIPO:** READ
- **RISCO:** LOW
- **CONFIRMAÇÃO:** SEM_CONFIRMACAO
- **PERMISSÃO:** estoque.overview.view
- **HANDLER FUTURO:** Filtro sobre etchEstoque(unidadeId, deptUrl)
- **ARQUIVO:** pp/lib/estoque.js (linha 8)
- **TABELAS UTILIZADAS:** insumos, estoque_atual
- **VALIDAÇÃO EXISTENTE:** Sim.
- **CONTROLE DE PERMISSÃO:** Sim.

---

### estoque.listar_movimentacoes
- **DESCRIPTION:** Consulta o histórico cronológico de movimentações físicas de estoque (entradas, saídas, perdas).
- **INPUT:** { unidadeId: string, departamento?: string, limite?: number }
- **OUTPUT:** { movimentacoes: Array<{ id: string, data: string, tipo: string, insumo: string, quantidade: number, saldo_anterior: number, saldo_posterior: number, responsavel: string, motivo: string }> }
- **TIPO:** READ
- **RISCO:** LOW
- **CONFIRMAÇÃO:** SEM_CONFIRMACAO
- **PERMISSÃO:** estoque.overview.view_history
- **HANDLER FUTURO:** etchMovimentosEstoque(unidadeId, departamento, limite)
- **ARQUIVO:** pp/lib/estoque.js (linha 343)
- **TABELAS UTILIZADAS:** estoque_movimentos, insumos
- **VALIDAÇÃO EXISTENTE:** Sim.
- **CONTROLE DE PERMISSÃO:** Sim.

---

### estoque.registrar_entrada
- **DESCRIPTION:** Registra a entrada física de mercadoria no estoque da unidade, atualizando o saldo e o histórico.
- **INPUT:** { unidadeId: string, insumoId: string, departamento?: string, quantidadeUnidades: number, responsavel: string, motivo?: string, dataMovimento?: string }
- **OUTPUT:** { success: boolean, novoSaldo: number, idMovimento?: string }
- **TIPO:** WRITE
- **RISCO:** MEDIUM
- **CONFIRMAÇÃO:** CONFIRMACAO_RECOMENDADA
- **PERMISSÃO:** estoque.entries.create
- **HANDLER FUTURO:** egistrarMovimentoEstoque({ ..., tipo: entrada })
- **ARQUIVO:** pp/lib/estoque.js (linha 358)
- **TABELAS UTILIZADAS:** estoque_atual, estoque_movimentos, insumos, RPC egistrar_movimento_estoque
- **VALIDAÇÃO EXISTENTE:** Sim (quantidade > 0, checagem de tipos, fallback seguro se RPC ausente).
- **CONTROLE DE PERMISSÃO:** Sim.

---

### estoque.registrar_saida
- **DESCRIPTION:** Registra a baixa/saída física de insumos do estoque por consumo operacional, quebra ou perda.
- **INPUT:** { unidadeId: string, insumoId: string, departamento?: string, quantidadeUnidades: number, responsavel: string, motivo: string }
- **OUTPUT:** { success: boolean, novoSaldo: number }
- **TIPO:** WRITE
- **RISCO:** MEDIUM
- **CONFIRMAÇÃO:** CONFIRMACAO_RECOMENDADA
- **PERMISSÃO:** estoque.outputs.create
- **HANDLER FUTURO:** egistrarMovimentoEstoque({ ..., tipo: saida })
- **ARQUIVO:** pp/lib/estoque.js (linha 358)
- **TABELAS UTILIZADAS:** estoque_atual, estoque_movimentos, insumos
- **VALIDAÇÃO EXISTENTE:** Sim (impede saldo negativo em JS/fallback).
- **CONTROLE DE PERMISSÃO:** Sim.

---

### estoque.ajustar_saldo
- **DESCRIPTION:** Força o saldo físico de um item no estoque (balanço de inventário / contagem física).
- **INPUT:** { unidadeId: string, insumoId: string, novaQuantidade: number, motivo: string, responsavel: string }
- **OUTPUT:** { success: boolean, quantidadeAtualizada: number }
- **TIPO:** WRITE
- **RISCO:** HIGH
- **CONFIRMAÇÃO:** CONFIRMACAO_OBRIGATORIA
- **PERMISSÃO:** estoque.overview.adjust_stock
- **HANDLER FUTURO:** justarEstoque(unidadeId, insumoId, novaQuantidade)
- **ARQUIVO:** pp/lib/estoque.js (linha 68)
- **TABELAS UTILIZADAS:** estoque_atual
- **VALIDAÇÃO EXISTENTE:** Simples (Upsert).
- **CONTROLE DE PERMISSÃO:** Sim.

---

## 2. Módulo: Compras & Fornecedores

### compras.listar_fornecedores
- **DESCRIPTION:** Lista os fornecedores cadastrados na unidade ou rede.
- **INPUT:** { unidadeId?: string }
- **OUTPUT:** { fornecedores: Array<{ id: string, nome: string, segmento: string, contato: string, telefone: string, email: string, forma_pagamento: string, pedido_minimo: number }> }
- **TIPO:** READ
- **RISCO:** LOW
- **CONFIRMAÇÃO:** SEM_CONFIRMACAO
- **PERMISSÃO:** compras.suppliers.view
- **HANDLER FUTURO:** etchFornecedores(unidadeId)
- **ARQUIVO:** pp/lib/fornecedores.js (linha 4)
- **TABELAS UTILIZADAS:** ornecedores
- **VALIDAÇÃO EXISTENTE:** Sim.
- **CONTROLE DE PERMISSÃO:** Sim.

---

### compras.consultar_precos_fornecedor
- **DESCRIPTION:** Consulta a tabela de preços cadastrada por fornecedor para um determinado ingrediente.
- **INPUT:** { insumoId: string }
- **OUTPUT:** { precos: Array<{ fornecedorId: string, fornecedorNome: string, preco: number, tamanho_embalagem: number, unidade_embalagem: string, preco_normalizado: number, atualizado_em: string }> }
- **TIPO:** READ
- **RISCO:** LOW
- **CONFIRMAÇÃO:** SEM_CONFIRMACAO
- **PERMISSÃO:** compras.orders.view_costs
- **HANDLER FUTURO:** etchPrecosDoInsumo(insumoId)
- **ARQUIVO:** pp/lib/insumo-fornecedores.js (linha 18)
- **TABELAS UTILIZADAS:** insumos_fornecedores, ornecedores
- **VALIDAÇÃO EXISTENTE:** Sim.
- **CONTROLE DE PERMISSÃO:** Sim.

---

### compras.historico_precos
- **DESCRIPTION:** Consulta o histórico de alterações de preços praticados pelos fornecedores.
- **INPUT:** { insumoId?: string, fornecedorId?: string }
- **OUTPUT:** { historico: Array<{ data: string, insumo: string, fornecedor: string, valor_anterior: number, valor_novo: number, diferenca_percentual: number }> }
- **TIPO:** READ
- **RISCO:** LOW
- **CONFIRMAÇÃO:** SEM_CONFIRMACAO
- **PERMISSÃO:** compras.orders.view_costs
- **HANDLER FUTURO:** Leitura da tabela insumos_precos_historico
- **ARQUIVO:** pp/lib/insumo-fornecedores.js (linha 64)
- **TABELAS UTILIZADAS:** insumos_precos_historico
- **VALIDAÇÃO EXISTENTE:** Sim.
- **CONTROLE DE PERMISSÃO:** Sim.

---

### compras.registrar_compra
- **DESCRIPTION:** Registra a compra de mercadoria, alimentando simultaneamente o saldo de estoque e criando o lançamento no Contas a Pagar (categoria CMV).
- **INPUT:** { unidadeId: string, insumoId: string, nomeInsumo: string, departamento: string, quantidadeComprada: number, valorPago: number, fornecedorNome?: string }
- **OUTPUT:** { success: boolean }
- **TIPO:** WRITE
- **RISCO:** HIGH
- **CONFIRMAÇÃO:** CONFIRMACAO_OBRIGATORIA
- **PERMISSÃO:** compras.orders.create
- **HANDLER FUTURO:** egistrarCompra(unidadeId, insumoId, nomeInsumo, departamento, quantidadeComprada, valorPago, fornecedorNome)
- **ARQUIVO:** pp/lib/estoque.js (linha 297)
- **TABELAS UTILIZADAS:** estoque_atual, contas_pagar
- **VALIDAÇÃO EXISTENTE:** Sim.
- **CONTROLE DE PERMISSÃO:** Sim.

---

## 3. Módulo: Ficha Técnica

### ichas.consultar_ficha
- **DESCRIPTION:** Consulta a ficha técnica completa de uma receita ou prato (ingredientes, custos, rendimento, preparo, alérgenos).
- **INPUT:** { fichaId: string }
- **OUTPUT:** { ficha: { id: string, nome_receita: string, rendimento_porcoes: number, custo_total: number, custo_porcao: number, ingredientes: Array<any>, etapas: Array<any>, alergenicos: Array<any> } }
- **TIPO:** READ
- **RISCO:** LOW
- **CONFIRMAÇÃO:** SEM_CONFIRMACAO
- **PERMISSÃO:** ichas.recipes.view
- **HANDLER FUTURO:** etchFichaCompleta(fichaId)
- **ARQUIVO:** pp/lib/ficha-tecnica.js (linha 71)
- **TABELAS UTILIZADAS:** ichas_tecnicas, ichas_ingredientes, insumos, icha_etapas, icha_alergenicos
- **VALIDAÇÃO EXISTENTE:** Sim.
- **CONTROLE DE PERMISSÃO:** Sim.

---

### ichas.calcular_rendimento_escalonamento
- **DESCRIPTION:** Calcula a explosão de insumos e custo estimado para produzir N porções de uma receita, resolvendo sub-receitas recursivamente.
- **INPUT:** { fichaId: string, porcoesDesejadas: number }
- **OUTPUT:** { porcoes: number, custoTotalEstimado: number, insumosNecessarios: Array<{ insumoId: string, nome: string, quantidade: number, unidade: string, custo: number }> }
- **TIPO:** READ
- **RISCO:** LOW
- **CONFIRMAÇÃO:** SEM_CONFIRMACAO
- **PERMISSÃO:** ichas.recipes.view
- **HANDLER FUTURO:** calcularConsumoProducao(ficha, qtdProduzida, todasFichas)
- **ARQUIVO:** pp/lib/estoque.js (linha 130) + pp/lib/ficha-calculos.mjs
- **TABELAS UTILIZADAS:** Função pura sobre objetos carregados.
- **VALIDAÇÃO EXISTENTE:** Sim (detector de referências circulares).
- **CONTROLE DE PERMISSÃO:** Sim.

---

## 4. Módulo: Vendas & PDV

> **NOTA CRÍTICA:** A integração com provedores externos (iFood / Saipos) encontra-se em análise de fonte da verdade pela arquitetura. Nenhuma Tool de sincronização externa nova foi inventada. As Tools abaixo operam sobre o PDV interno e KDS existentes.

### endas.consultar_resumo_periodo
- **DESCRIPTION:** Consulta o resumo de faturamento, total de vendas, ticket médio e distribuição por forma de pagamento no período.
- **INPUT:** { unidadeId: string, inicioIso: string, fimIso: string }
- **OUTPUT:** { totalFaturado: number, totalPedidos: number, ticketMedio: number, porFormaPagamento: Record<string, number>, porCanal: Record<string, number> }
- **TIPO:** READ
- **RISCO:** LOW
- **CONFIRMAÇÃO:** SEM_CONFIRMACAO
- **PERMISSÃO:** endas.pdv.view_values
- **HANDLER FUTURO:** etchPainelCaixa(unidadeId, inicioIso, fimIso)
- **ARQUIVO:** pp/lib/financeiro.js (linha 100)
- **TABELAS UTILIZADAS:** endas, enda_itens, pedidos
- **VALIDAÇÃO EXISTENTE:** Sim.
- **CONTROLE DE PERMISSÃO:** Sim.

---

### endas.listar_pedidos_abertos
- **DESCRIPTION:** Lista comandas e pedidos atualmente em aberto no salão, balcão ou delivery.
- **INPUT:** { unidadeId: string }
- **OUTPUT:** { pedidos: Array<{ id: string, mesa: string, cliente: string, valor_total: number, itens: Array<any>, status: string, created_at: string }> }
- **TIPO:** READ
- **RISCO:** LOW
- **CONFIRMAÇÃO:** SEM_CONFIRMACAO
- **PERMISSÃO:** endas.pdv.view
- **HANDLER FUTURO:** etchPedidosOnlinePendentes(unidadeId) / etchMesasEComandas(unidadeId)
- **ARQUIVO:** pp/lib/vendas.js (linha 647) / pp/lib/mesas.js (linha 6)
- **TABELAS UTILIZADAS:** pedidos, pedidos_itens, mesas, comandas
- **VALIDAÇÃO EXISTENTE:** Sim.
- **CONTROLE DE PERMISSÃO:** Sim.

---

### endas.consultar_kds
- **DESCRIPTION:** Consulta a fila de produção da cozinha e do bar (Kitchen Display System).
- **INPUT:** { unidadeId: string, departamento?: cozinha | bar | todos }
- **OUTPUT:** { fila: Array<{ id: string, item: string, quantidade: number, observacao: string, mesa: string, tempoEsperaMinutos: number, status_kds: string }> }
- **TIPO:** READ
- **RISCO:** LOW
- **CONFIRMAÇÃO:** SEM_CONFIRMACAO
- **PERMISSÃO:** cozinha.kds.view
- **HANDLER FUTURO:** etchItensKDS(unidadeId, dept)
- **ARQUIVO:** pp/lib/vendas.js (linha 552)
- **TABELAS UTILIZADAS:** pedidos_itens, produtos, pedidos, mesas
- **VALIDAÇÃO EXISTENTE:** Sim.
- **CONTROLE DE PERMISSÃO:** Sim.

---

## 5. Módulo: Reservas & Eventos

### eventos.listar_eventos
- **DESCRIPTION:** Lista eventos gastronômicos cadastrados na unidade (menus fechados, datas comemorativas).
- **INPUT:** { unidadeId: string }
- **OUTPUT:** { eventos: Array<{ id: string, nome: string, data_evento: string, status: string, preco_unit: number, capacidade: number }> }
- **TIPO:** READ
- **RISCO:** LOW
- **CONFIRMAÇÃO:** SEM_CONFIRMACAO
- **PERMISSÃO:** eventos.events.view
- **HANDLER FUTURO:** etchEventos(unidadeId)
- **ARQUIVO:** pp/lib/eventos.js (linha 128)
- **TABELAS UTILIZADAS:** eventos
- **VALIDAÇÃO EXISTENTE:** Sim.
- **CONTROLE DE PERMISSÃO:** Sim.

---

### eservas.consultar_reservas
- **DESCRIPTION:** Consulta as reservas cadastradas para um evento específico.
- **INPUT:** { eventoId: string }
- **OUTPUT:** { reservas: Array<{ id: string, nome: string, mesa: number, horario: string, sinal: number, status: string, payment_method: string, menu_choices: any, drink_choices: any }> }
- **TIPO:** READ
- **RISCO:** LOW
- **CONFIRMAÇÃO:** SEM_CONFIRMACAO
- **PERMISSÃO:** eventos.events.view
- **HANDLER FUTURO:** Reservas.list(eventoId)
- **ARQUIVO:** pp/lib/eventos.js (linha 246)
- **TABELAS UTILIZADAS:** evento_reservas
- **VALIDAÇÃO EXISTENTE:** Sim.
- **CONTROLE DE PERMISSÃO:** Sim.

---

### eservas.criar_reserva
- **DESCRIPTION:** Cria uma nova reserva de mesa/lugar para um evento.
- **INPUT:** { eventoId: string, nome: string, mesa?: number, horario: string, sinal: number, status?: pending | paid, payment_method?: credit | debit | pix, menu_choices?: string[], drink_choices?: string[], observacao?: string }
- **OUTPUT:** { reserva: { id: string, nome: string, status: string } }
- **TIPO:** WRITE
- **RISCO:** MEDIUM
- **CONFIRMAÇÃO:** CONFIRMACAO_RECOMENDADA
- **PERMISSÃO:** eventos.events.create
- **HANDLER FUTURO:** Reservas.add(eventoId, obj)
- **ARQUIVO:** pp/lib/eventos.js (linha 248)
- **TABELAS UTILIZADAS:** evento_reservas
- **VALIDAÇÃO EXISTENTE:** Sim.
- **CONTROLE DE PERMISSÃO:** Sim.

---

### eservas.cancelar_reserva
- **DESCRIPTION:** Cancela/remove uma reserva existente em um evento.
- **INPUT:** { reservaId: string }
- **OUTPUT:** { success: boolean }
- **TIPO:** WRITE
- **RISCO:** HIGH
- **CONFIRMAÇÃO:** CONFIRMACAO_OBRIGATORIA
- **PERMISSÃO:** eventos.events.cancel
- **HANDLER FUTURO:** Reservas.remove(reservaId)
- **ARQUIVO:** pp/lib/eventos.js (linha 250)
- **TABELAS UTILIZADAS:** evento_reservas
- **VALIDAÇÃO EXISTENTE:** Sim.
- **CONTROLE DE PERMISSÃO:** Sim.

---

### Ações de Reservas Não Existentes / Status de Análise:
- **eservas.check_in (Salão Regular):** NÃO EXISTE (o salão opera por abertura de comanda em mesa física ocupada via brirMesaEPedido).
- **eservas.no_show:** NÃO EXISTE coluna explícita 
o_show no schema de evento_reservas (valores existentes no campo status: 'pending', 'paid').

---

## 6. Módulo: Clientes / CRM

### crm.buscar_cliente
- **DESCRIPTION:** Busca dados de cadastro, telefone, total gasto e volume de pedidos de um cliente.
- **INPUT:** { unidadeId?: string, termo?: string }
- **OUTPUT:** { clientes: Array<{ id: string, nome: string, telefone: string, total_gasto: number, total_pedidos: number, ultima_compra: string, status: Vip | Frequente | Risco | Novo }> }
- **TIPO:** READ
- **RISCO:** LOW
- **CONFIRMAÇÃO:** SEM_CONFIRMACAO
- **PERMISSÃO:** clientes.overview.view
- **HANDLER FUTURO:** etchClientes(unidadeId)
- **ARQUIVO:** pp/lib/clientes.js (linha 30)
- **TABELAS UTILIZADAS:** clientes
- **VALIDAÇÃO EXISTENTE:** Sim.
- **CONTROLE DE PERMISSÃO:** Sim.

---

### crm.criar_cliente
- **DESCRIPTION:** Cadastra um novo cliente no CRM do restaurante.
- **INPUT:** { unidadeId: string, nome: string, telefone: string }
- **OUTPUT:** { cliente: { id: string, nome: string, telefone: string } }
- **TIPO:** WRITE
- **RISCO:** MEDIUM
- **CONFIRMAÇÃO:** CONFIRMACAO_RECOMENDADA
- **PERMISSÃO:** clientes.overview.create
- **HANDLER FUTURO:** inserirCliente(cliente, unidadeId)
- **ARQUIVO:** pp/lib/clientes.js (linha 54)
- **TABELAS UTILIZADAS:** clientes
- **VALIDAÇÃO EXISTENTE:** Sim.
- **CONTROLE DE PERMISSÃO:** Sim.

---

### crm.lead_capturar
- **STATUS:** NÃO EXISTE como pipeline de CRM estruturado em tabela própria. O ERP absorve novos contatos diretamente como registros na tabela clientes com status 'Novo'.

---

## 7. Módulo: Recursos Humanos (RH) & Ponto

### h.consultar_equipe
- **DESCRIPTION:** Consulta os membros ativos da equipe da unidade (nomes, cargos, escalas) de forma segura (sem expor CPF, salário ou dados bancários).
- **INPUT:** { unidadeId: string }
- **OUTPUT:** { equipe: Array<{ id: string, nome: string, cargo: string, status: string, departamento: string }> }
- **TIPO:** READ
- **RISCO:** LOW
- **CONFIRMAÇÃO:** SEM_CONFIRMACAO
- **PERMISSÃO:** h.employees.view
- **HANDLER FUTURO:** etchEquipe(unidadeId)
- **ARQUIVO:** pp/lib/rh.js (linha 10)
- **TABELAS UTILIZADAS:** Visão equipe_unidade / colaboradores
- **VALIDAÇÃO EXISTENTE:** Sim (sanitização nativa de campos sigilosos).
- **CONTROLE DE PERMISSÃO:** Sim.

---

### h.consultar_escala_dia
- **DESCRIPTION:** Consulta a escala de trabalho salva para a equipe em uma determinada data.
- **INPUT:** { unidadeId: string, limite?: number }
- **OUTPUT:** { escalas: Array<{ id: string, data_escala: string, areas: any, total_colaboradores: number }> }
- **TIPO:** READ
- **RISCO:** LOW
- **CONFIRMAÇÃO:** SEM_CONFIRMACAO
- **PERMISSÃO:** h.overview.view
- **HANDLER FUTURO:** etchEscalasDia(unidadeId, limite)
- **ARQUIVO:** pp/lib/rh.js (linha 236)
- **TABELAS UTILIZADAS:** escalas_dia
- **VALIDAÇÃO EXISTENTE:** Sim.
- **CONTROLE DE PERMISSÃO:** Sim.

---

### h.consultar_ponto_hoje
- **DESCRIPTION:** Consulta o status dos registros de ponto da equipe no dia atual (entradas, saídas, jornadas em aberto).
- **INPUT:** { unidadeId: string }
- **OUTPUT:** { registros: Array<{ colaborador_id: string, data_referencia: string, entrada_1: string, saida_1: string, entrada_2: string, saida_2: string, status: string }> }
- **TIPO:** READ
- **RISCO:** LOW
- **CONFIRMAÇÃO:** SEM_CONFIRMACAO
- **PERMISSÃO:** ponto.clock.view
- **HANDLER FUTURO:** etchPontoHoje(unidadeId)
- **ARQUIVO:** pp/lib/ponto.js (linha 10)
- **TABELAS UTILIZADAS:** egistro_ponto
- **VALIDAÇÃO EXISTENTE:** Sim (cálculo robusto de virada de meia-noite via ponto-datas.mjs).
- **CONTROLE DE PERMISSÃO:** Sim.

---

## 8. Módulo: Checklists & Rotinas

### checklists.listar_templates
- **DESCRIPTION:** Lista os modelos/templates de checklists operacionais ativos na unidade (abertura, fechamento, limpeza).
- **INPUT:** { unidadeId?: string, departamento?: string, tipo?: string }
- **OUTPUT:** { templates: Array<{ id: string, titulo: string, departamento: string, tipo: string, itens: Array<any> }> }
- **TIPO:** READ
- **RISCO:** LOW
- **CONFIRMAÇÃO:** SEM_CONFIRMACAO
- **PERMISSÃO:** checklist.templates.view
- **HANDLER FUTURO:** etchTemplates(unidadeId, dept, tipo)
- **ARQUIVO:** pp/lib/checklists.js (linha 5)
- **TABELAS UTILIZADAS:** checklists_templates
- **VALIDAÇÃO EXISTENTE:** Sim.
- **CONTROLE DE PERMISSÃO:** Sim.

---

### checklists.salvar_execucao
- **DESCRIPTION:** Grava o preenchimento de uma rotina/checklist operacional com suas respostas e status de conformidade.
- **INPUT:** { execucao: { template_id: string, unidade_id: string, colaborador_id: string, data_referencia: string, respostas: any, status: string } }
- **OUTPUT:** { success: boolean }
- **TIPO:** WRITE
- **RISCO:** MEDIUM
- **CONFIRMAÇÃO:** CONFIRMACAO_RECOMENDADA
- **PERMISSÃO:** checklist.execution.create
- **HANDLER FUTURO:** salvarExecucao(execucao)
- **ARQUIVO:** pp/lib/checklists.js (linha 41)
- **TABELAS UTILIZADAS:** checklists_execucoes
- **VALIDAÇÃO EXISTENTE:** Sim.
- **CONTROLE DE PERMISSÃO:** Sim.

---

## 9. Módulo: Auditoria & Evidências

### uditoria.consultar_perdas
- **DESCRIPTION:** Gera relatório consolidado de perdas e quebras de estoque por período, calculando valor financeiro e taxa de perda %.
- **INPUT:** { unidadeId?: string, dias?: number }
- **OUTPUT:** { relatorio: Array<{ estoque_id: string, nome: string, categoria: string, custo_unitario: number, perda_manual: number, prejuizo: number, taxa_perda: number, status: ok | alerta | critico }> }
- **TIPO:** READ
- **RISCO:** LOW
- **CONFIRMAÇÃO:** SEM_CONFIRMACAO
- **PERMISSÃO:** elatorios.audit.view
- **HANDLER FUTURO:** etchRelatorioPerdas(unidadeId, dias)
- **ARQUIVO:** pp/lib/auditoria.js (linha 4)
- **TABELAS UTILIZADAS:** estoque_movimentacoes, insumos
- **VALIDAÇÃO EXISTENTE:** Sim.
- **CONTROLE DE PERMISSÃO:** Sim.

---

### uditoria.consultar_logs_hefisto
- **DESCRIPTION:** Consulta os logs de auditoria de comandos e ações executadas por IA e usuários.
- **INPUT:** { unidadeId?: string, limite?: number }
- **OUTPUT:** { logs: Array<{ id: string, usuario_nome: string, comando: string, acao: string, modulo: string, resultado: string, erro: string, created_at: string }> }
- **TIPO:** READ
- **RISCO:** LOW
- **CONFIRMAÇÃO:** SEM_CONFIRMACAO
- **PERMISSÃO:** elatorios.audit.view_history
- **HANDLER FUTURO:** etchAuditoriaHefisto(unidadeId, limite)
- **ARQUIVO:** pp/lib/hefisto-acoes.js (linha 129)
- **TABELAS UTILIZADAS:** hefisto_auditoria
- **VALIDAÇÃO EXISTENTE:** Sim.
- **CONTROLE DE PERMISSÃO:** Sim.

---

## 10. Módulo: Financeiro

### inanceiro.consultar_dre
- **DESCRIPTION:** Consulta o Demonstrativo de Resultados do Exercício (DRE), calculando faturamento, custos por categoria, lucro líquido e margem %.
- **INPUT:** { unidadeId: string }
- **OUTPUT:** { faturamentoTotal: number, totalCustos: number, lucroLiquido: number, margem: string, custosPorCategoria: Record<string, number>, fatPorCanal: Record<string, number> }
- **TIPO:** READ
- **RISCO:** LOW
- **CONFIRMAÇÃO:** SEM_CONFIRMACAO
- **PERMISSÃO:** inanceiro.dre.view_values
- **HANDLER FUTURO:** etchDRE(unidadeId)
- **ARQUIVO:** pp/lib/financeiro.js (linha 197)
- **TABELAS UTILIZADAS:** pedidos, contas_pagar
- **VALIDAÇÃO EXISTENTE:** Sim.
- **CONTROLE DE PERMISSÃO:** Sim.

---

### inanceiro.consultar_cmo
- **DESCRIPTION:** Calcula o Custo de Mão de Obra (CMO) consolidando folha salarial ativa + diárias de extras no período.
- **INPUT:** { colaboradores: Array<any>, recibos: Array<any>, modo?: mes | dia | semana }
- **OUTPUT:** { totalCMO: number, folha: number, extras: number, extrasEmAberto: number }
- **TIPO:** READ
- **RISCO:** LOW
- **CONFIRMAÇÃO:** SEM_CONFIRMACAO
- **PERMISSÃO:** inanceiro.cmv.view_costs
- **HANDLER FUTURO:** calcularCMO({ colaboradores, recibos, modo })
- **ARQUIVO:** pp/lib/cmo.mjs (linha 36)
- **TABELAS UTILIZADAS:** Função pura sobre dados de RH/recibos.
- **VALIDAÇÃO EXISTENTE:** Sim.
- **CONTROLE DE PERMISSÃO:** Sim.

---

### inanceiro.consultar_custo_diario
- **DESCRIPTION:** Calcula o custo diário fixo e de equipe da loja para análise de ponto de equilíbrio operacional.
- **INPUT:** { params: Record<string, any>, dias: number }
- **OUTPUT:** { totalMes: number, totalDia: number, itens: Array<{ chave: string, rotulo: string, mes: number, dia: number }> }
- **TIPO:** READ
- **RISCO:** LOW
- **CONFIRMAÇÃO:** SEM_CONFIRMACAO
- **PERMISSÃO:** inanceiro.dre.view_values
- **HANDLER FUTURO:** contasPorDia(params, dias)
- **ARQUIVO:** pp/lib/custo-diario.mjs (linha 45)
- **TABELAS UTILIZADAS:** Função pura.
- **VALIDAÇÃO EXISTENTE:** Sim.
- **CONTROLE DE PERMISSÃO:** Sim.
