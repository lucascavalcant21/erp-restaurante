-- =========================================================================
-- MIGRAÇÃO PARA CUSTOS COMPLEXOS, EQUIPE E PRECIFICAÇÃO DE EVENTOS
-- =========================================================================

-- 1. ADICIONANDO COLUNAS FINANCEIRAS NO EVENTO
alter table eventos
  add column if not exists taxa_imposto_pct numeric default 0,      -- Ex: 6% de Simples Nacional
  add column if not exists taxa_maquininha_pct numeric default 0,   -- Ex: 2.5% de crédito
  add column if not exists custo_aluguel_espaco numeric default 0,  -- Ex: R$ 1500 (se locado)
  add column if not exists margem_lucro_desejada numeric default 20,-- Margem de lucro esperada (%)
  add column if not exists desconto_concedido numeric default 0,
  
  -- Totais cacheados para performance (atualizados via triggers/código)
  add column if not exists total_custo_insumos numeric default 0,
  add column if not exists total_custo_equipe numeric default 0;

-- 2. TABELA DE EQUIPE E FREELANCERS DO EVENTO
create table if not exists evento_equipe (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid references eventos(id) on delete cascade not null,
  
  -- Pode ser um funcionário já registrado na base (RH)
  funcionario_id uuid references funcionarios(id),
  
  -- Ou pode ser um freelancer externo cadastrado apenas para o evento
  nome_freelancer text,
  telefone_freelancer text,
  
  -- Dados da operação
  funcao text not null,          -- Ex: Garçom, Cozinheiro, Segurança, Bartender
  setor text not null,           -- Ex: Salão, Cozinha, Bar, Limpeza, Apoio
  custo_diaria numeric not null default 0,
  pago boolean default false,    -- Controle se a pessoa já recebeu
  
  created_at timestamptz default now()
);

create index if not exists idx_evento_equipe_evento on evento_equipe(evento_id);
create index if not exists idx_evento_equipe_func on evento_equipe(funcionario_id);

alter table evento_equipe enable row level security;
drop policy if exists "auth_all" on evento_equipe;
create policy "auth_all" on evento_equipe for all to authenticated using (true) with check (true);
alter table eventos add column if not exists cardapio_itens jsonb default '[]'::jsonb; 
alter table eventos add column if not exists checklist jsonb default '{\" "cardapio\:false, \sinal\:false, \equipe\:false, \compras\:false}'::jsonb; 
