-- =========================================================================
-- MIGRAÇÃO PARA FUNIL DE EVENTOS / BUFFET (FASE 3)
-- =========================================================================

-- Adicionando colunas na tabela 'eventos' para suportar o novo formato CRM
alter table eventos
  add column if not exists tipo_evento text default 'especial', -- 'especial' (legado), 'buffet', 'corporativo', etc
  add column if not exists funil_status text default 'NOVO CONTATO',
  add column if not exists cliente_nome text,
  add column if not exists cliente_telefone text,
  add column if not exists valor_contratado numeric default 0,
  add column if not exists valor_pago numeric default 0,
  add column if not exists local_evento text,
  add column if not exists responsavel_id uuid;

create index if not exists idx_evt_tipo on eventos(tipo_evento);
create index if not exists idx_evt_funil on eventos(funil_status);

-- Os status do funil serão (conforme solicitado):
-- 'NOVO CONTATO'
-- 'INFORMACOES RECEBIDAS'
-- 'MONTANDO PROPOSTA'
-- 'PROPOSTA ENVIADA'
-- 'NEGOCIACAO'
-- 'APROVADO'
-- 'AGUARDANDO SINAL'
-- 'SINAL PAGO'
-- 'CONFIRMADO'
-- 'PREPARACAO'
-- 'EM PRODUCAO'
-- 'EVENTO'
-- 'FINALIZADO'
