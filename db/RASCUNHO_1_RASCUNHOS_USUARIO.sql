-- STATUS: APLICADA no banco do restaurante (sezccspqxgklicfndwxx) em 24/11/2026 com o OK do dono (BLQ-024: um sistema só).
-- RASCUNHO-1 — rascunho de formulário no banco, por usuário (dono, 17/11/2026:
-- "o sistema atualiza e some a ficha que eu estava criando… salve tudo no banco").
-- Guarda o que está sendo montado e ainda não foi salvo (ficha da marmita,
-- pré-preparo), para voltar mesmo se a tela recarregar ou trocar de aparelho.
-- Só ADITIVA: uma tabela nova. Cada usuário só vê e mexe nos próprios rascunhos
-- (RLS por auth.uid()); anon não tem acesso. O rascunho some quando a ficha é
-- salva ou cancelada (apagar o PRÓPRIO rascunho é o fim normal dele).
--
-- ROLLBACK (só com decisão do dono): drop table public.rascunhos_usuario;

-- preflight: aborta sem mudar nada se já existe
do $$ begin
  if to_regclass('public.rascunhos_usuario') is not null then raise exception 'RASCUNHO-1: a tabela rascunhos_usuario já existe; nada foi alterado'; end if;
end $$;

begin;

create table public.rascunhos_usuario (
  auth_user_id uuid not null default auth.uid(),
  chave text not null check (char_length(chave) between 1 and 120),
  unidade_id text,
  dados jsonb not null,
  atualizado_em timestamptz not null default now(),
  primary key (auth_user_id, chave),
  constraint rascunhos_usuario_tamanho check (pg_column_size(dados) < 300000)
);
comment on table public.rascunhos_usuario is 'hefisto:rascunho-1 — formulários em montagem (ficha técnica, pré-preparo) de cada usuário';

alter table public.rascunhos_usuario enable row level security;
create policy rascunhos_usuario_ler on public.rascunhos_usuario for select to authenticated using (auth_user_id = auth.uid());
create policy rascunhos_usuario_criar on public.rascunhos_usuario for insert to authenticated with check (auth_user_id = auth.uid());
create policy rascunhos_usuario_alterar on public.rascunhos_usuario for update to authenticated using (auth_user_id = auth.uid()) with check (auth_user_id = auth.uid());
create policy rascunhos_usuario_apagar on public.rascunhos_usuario for delete to authenticated using (auth_user_id = auth.uid());

revoke all on public.rascunhos_usuario from public, anon;
grant select, insert, update, delete on public.rascunhos_usuario to authenticated;

commit;

-- verificação pós-aplicação (impressão digital)
select md5(string_agg(x, '|' order by x)) as impressao_digital from (
  select 'col:' || column_name || ':' || data_type as x from information_schema.columns where table_schema = 'public' and table_name = 'rascunhos_usuario'
  union all select 'pol:' || policyname || ':' || cmd from pg_policies where tablename = 'rascunhos_usuario'
  union all select 'rls:' || relrowsecurity::text from pg_class where oid = 'public.rascunhos_usuario'::regclass
) t;
