-- AUDITORIA DE RLS (HDEV-SEC-001) · só leitura, roda pela guarda do agente da noite.
-- Lista toda tabela do schema public com RLS desligado ou policy aberta
-- (true, auth.role() = 'authenticated', ou … OR unidade_id IS NULL) e diz se é:
--   "aguarda SEC-RLS-1"  → corrigida pela migração da fase 1 quando o dono aprovar;
--   "aguarda SEC-RLS-2"  → corrigida pela migração da fase 2 quando o dono aprovar;
--   "GLOBAL só leitura"  → catálogo do sistema, sem escrita pelo navegador (aceito);
--   "NOVO: REGRESSÃO"    → tabela/policy insegura que não existia em 08/10/2026. Corrigir.
-- Resultado esperado depois da SEC-RLS-2: só as 3 linhas GLOBAL; nenhuma "aguarda" e nenhuma "NOVO".
-- Ao corrigir um item da fase 2, tire a tabela da lista "conhecidas".
with conhecidas (tabela, situacao) as (
  values
    ('acessos_modulo', 'aguarda SEC-RLS-1'), ('caixas', 'aguarda SEC-RLS-1'), ('candidatos', 'aguarda SEC-RLS-1'),
    ('cervejas', 'aguarda SEC-RLS-1'), ('checklists_execucoes', 'aguarda SEC-RLS-1'), ('checklists_templates', 'aguarda SEC-RLS-1'),
    ('colaboradores', 'aguarda SEC-RLS-1'), ('comandas', 'aguarda SEC-RLS-1'), ('config_impressoes', 'aguarda SEC-RLS-1'),
    ('config_pins', 'aguarda SEC-RLS-1'), ('config_sistema', 'aguarda SEC-RLS-1'), ('controle_gas', 'aguarda SEC-RLS-1'),
    ('controle_oleo', 'aguarda SEC-RLS-1'), ('drinks', 'aguarda SEC-RLS-1'), ('empresa_documentos', 'aguarda SEC-RLS-1'),
    ('escalas_dia', 'aguarda SEC-RLS-1'), ('estoque_atual', 'aguarda SEC-RLS-1'), ('estoques', 'aguarda SEC-RLS-1'),
    ('etiquetas', 'aguarda SEC-RLS-1'), ('extras_cadastros', 'aguarda SEC-RLS-1'), ('fichas_alergenicos', 'aguarda SEC-RLS-1'),
    ('fichas_armazenamento', 'aguarda SEC-RLS-1'), ('fichas_custo_historico', 'aguarda SEC-RLS-1'), ('fichas_equipamentos', 'aguarda SEC-RLS-1'),
    ('fichas_etapas', 'aguarda SEC-RLS-1'), ('fichas_montagem_passos', 'aguarda SEC-RLS-1'), ('fichas_tecnicas', 'aguarda SEC-RLS-1'),
    ('fichas_versoes', 'aguarda SEC-RLS-1'), ('gastos_administrativos', 'aguarda SEC-RLS-1'), ('guias_operacionais', 'aguarda SEC-RLS-1'),
    ('hefisto_auditoria', 'aguarda SEC-RLS-1'), ('insumos', 'aguarda SEC-RLS-1'), ('insumos_fornecedores', 'aguarda SEC-RLS-1'),
    ('insumos_precos_historico', 'aguarda SEC-RLS-1'), ('inventario_itens', 'aguarda SEC-RLS-1'), ('inventario_movimentos', 'aguarda SEC-RLS-1'),
    ('listas_etiquetas', 'aguarda SEC-RLS-1'), ('manutencao_servicos', 'aguarda SEC-RLS-1'), ('memorandos_operacao', 'aguarda SEC-RLS-1'),
    ('mesas', 'aguarda SEC-RLS-1'), ('op_agendas', 'aguarda SEC-RLS-1'), ('op_alertas', 'aguarda SEC-RLS-1'),
    ('op_auditoria', 'aguarda SEC-RLS-1'), ('op_evidencias', 'aguarda SEC-RLS-1'), ('op_execucoes', 'aguarda SEC-RLS-1'),
    ('op_nao_conformidades', 'aguarda SEC-RLS-1'), ('op_processos', 'aguarda SEC-RLS-1'), ('operacao_embalagens', 'aguarda SEC-RLS-1'),
    ('operacao_embalagens_consumo', 'aguarda SEC-RLS-1'), ('pdv_caixas', 'aguarda SEC-RLS-1'), ('pdv_movimentacoes', 'aguarda SEC-RLS-1'),
    ('pedidos', 'aguarda SEC-RLS-1'), ('ponto_marcacao', 'aguarda SEC-RLS-1'), ('producao_diaria', 'aguarda SEC-RLS-1'),
    ('producoes', 'aguarda SEC-RLS-1'), ('produtos', 'aguarda SEC-RLS-1'), ('registro_ponto', 'aguarda SEC-RLS-1'),
    ('reservas', 'aguarda SEC-RLS-1'), ('rh_advertencias_colab', 'aguarda SEC-RLS-1'), ('rh_atas', 'aguarda SEC-RLS-1'),
    ('rh_atas_reuniao', 'aguarda SEC-RLS-1'), ('rh_atestados', 'aguarda SEC-RLS-1'), ('rh_banco_horas', 'aguarda SEC-RLS-1'),
    ('rh_bonificacoes', 'aguarda SEC-RLS-1'), ('rh_cargos', 'aguarda SEC-RLS-1'), ('rh_consumo_funcionarios', 'aguarda SEC-RLS-1'),
    ('rh_espelho_fechado', 'aguarda SEC-RLS-1'), ('rh_feriados', 'aguarda SEC-RLS-1'), ('rh_folgas_esporadicas', 'aguarda SEC-RLS-1'),
    ('rh_historico', 'aguarda SEC-RLS-1'), ('rh_recibos_prestacao', 'aguarda SEC-RLS-1'), ('rh_regulamentos', 'aguarda SEC-RLS-1'),
    ('rh_tipos_bonificacao', 'aguarda SEC-RLS-1'), ('rh_turnos', 'aguarda SEC-RLS-1'), ('tarefas_instancias', 'aguarda SEC-RLS-1'),
    ('treinamentos', 'aguarda SEC-RLS-1'), ('venda_itens', 'aguarda SEC-RLS-1'), ('vendas', 'aguarda SEC-RLS-1'),
    ('advertencias', 'aguarda SEC-RLS-1'), ('avaliacoes_nps', 'aguarda SEC-RLS-1'), ('avisos', 'aguarda SEC-RLS-1'), ('campanhas', 'aguarda SEC-RLS-1'), ('cardapio', 'aguarda SEC-RLS-1'), ('clientes', 'aguarda SEC-RLS-1'), ('cupons', 'aguarda SEC-RLS-1'), ('cursos', 'aguarda SEC-RLS-1'), ('func_documentos', 'aguarda SEC-RLS-1'), ('observacoes_padrao', 'aguarda SEC-RLS-1'),
    -- fase 2 (SEC_RLS_2_FASE2.sql, aguarda aprovação): unidade com dados legados, tabelas-filhas, cadastro e acesso
    ('controle_limpeza', 'aguarda SEC-RLS-2'), ('controle_manutencoes', 'aguarda SEC-RLS-2'), ('suprimentos_historico', 'aguarda SEC-RLS-2'),
    ('suprimentos_unidades', 'aguarda SEC-RLS-2'), ('montagem', 'aguarda SEC-RLS-2'), ('eventos', 'aguarda SEC-RLS-2'),
    ('notas_fiscais', 'aguarda SEC-RLS-2'), ('fichas_ingredientes', 'aguarda SEC-RLS-2'), ('ficha_itens', 'aguarda SEC-RLS-2'),
    ('pedidos_itens', 'aguarda SEC-RLS-2'), ('evento_compras', 'aguarda SEC-RLS-2'), ('evento_custos_fixos', 'aguarda SEC-RLS-2'),
    ('evento_drinks', 'aguarda SEC-RLS-2'), ('evento_ingredientes', 'aguarda SEC-RLS-2'), ('evento_pratos', 'aguarda SEC-RLS-2'),
    ('evento_preparos', 'aguarda SEC-RLS-2'), ('evento_reservas', 'aguarda SEC-RLS-2'), ('op_acoes_corretivas', 'aguarda SEC-RLS-2'),
    ('op_itens', 'aguarda SEC-RLS-2'), ('op_respostas', 'aguarda SEC-RLS-2'), ('op_secoes', 'aguarda SEC-RLS-2'),
    ('documentos_rh', 'aguarda SEC-RLS-2'), ('tarefas_templates', 'aguarda SEC-RLS-2'), ('suprimentos_catalogo', 'aguarda SEC-RLS-2'),
    ('ponto', 'aguarda SEC-RLS-2'), ('usuarios_erp', 'aguarda SEC-RLS-2'), ('usuario_escopos', 'aguarda SEC-RLS-2'),
    ('unidades', 'aguarda SEC-RLS-2'), ('perfis_acesso', 'aguarda SEC-RLS-2'), ('permissoes_auditoria', 'aguarda SEC-RLS-2'),
    -- catálogos globais do sistema: só leitura para logados, sem policy de escrita (aceito)
    ('fin_categorias', 'GLOBAL só leitura (aceito)'), ('fin_categorias_legado', 'GLOBAL só leitura (aceito)'), ('fin_centros_custo', 'GLOBAL só leitura (aceito)')
),
problemas as (
  select c.relname::text as tabela, 'RLS desligado' as problema
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity
  union all
  select p.tablename::text, 'policy aberta "' || p.policyname || '" (' || p.cmd || ')'
    from pg_policies p
   where p.schemaname = 'public'
     and (coalesce(p.qual, '') ~* '^\(?\s*true\s*\)?$' or coalesce(p.with_check, '') ~* '^\(?\s*true\s*\)?$'
          or coalesce(p.qual, '') ~* 'auth\.role\(\)\s*=\s*''authenticated''' or coalesce(p.qual, '') ~* 'unidade_id\s+is\s+null')
)
select p.tabela,
       string_agg(distinct p.problema, '; ') as problemas,
       coalesce(min(k.situacao), 'NOVO: REGRESSÃO') as situacao
  from problemas p left join conhecidas k on k.tabela = p.tabela
 group by p.tabela
 order by (min(k.situacao) is null) desc, min(k.situacao), p.tabela;
