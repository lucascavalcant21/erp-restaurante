/* ═══════════════════════════════════════════════════════════════════════════
   SAAS-PLANOS-1 · ASSINATURA DA EMPRESA (PLANO GRÁTIS E PLANO COMPLETO)

   STATUS: ESCRITA, NÃO APLICADA. Aguarda aprovação do dono (APR-SAAS-1 em
   docs/brain/06_OPERACAO/APROVACOES_PENDENTES.md).

   DECISÕES DO DONO (14/11/2026): plano Grátis e plano Completo ("com tudo")
   por R$ 89,90 por mês; semestral com 20% e anual com 40% de desconto;
   crédito, débito ou Pix. A lista de planos, preços, períodos e descontos
   fica em app/lib/planos.mjs; o banco guarda QUAL plano a empresa tem, o
   período, a forma de pagamento e a situação da cobrança.

   CONFERIDO NO BANCO REAL (14/11/2026, leitura): empresas tem só id (uuid),
   nome, documento, ativo e created_at; 1 empresa, 3 unidades; a empresa do
   usuário sai de usuarios_erp.unidade_principal_id → unidades.empresa_id. A
   migração antiga db/migracao_control_plane_saas.sql (planos BASIC/PRO/
   MULTIUNIT em colunas de empresas) NUNCA foi aplicada e fica substituída
   por esta: não mexemos em empresas, a assinatura vive em tabela própria.

   FAZ (uma transação; só aditiva):
     1. tabela empresa_assinatura (uma linha por empresa): plano
        ('gratis' | 'completo'), situacao ('ativa' | 'em_teste' | 'atrasada' |
        'cancelada' | 'cortesia'), periodicidade ('mensal' | 'semestral' |
        'anual'), forma_pagamento ('credito' | 'debito' | 'pix'),
        valor_mensal_centavos, proximo_vencimento,
        provedor e provedor_ref (para o meio de cobrança, ainda não escolhido),
        criado_em e atualizado_em;
     2. RLS ligado SEM política e sem grant de escrita: o app não lê nem grava
        a tabela direto; só pela função abaixo (leitura) e pelo servidor;
     3. função hefisto_minha_assinatura(): devolve a assinatura da empresa de
        quem está logado (empresa vem do banco, nunca da requisição) ou null;
     4. as empresas que já existem entram como plano 'completo', situação
        'cortesia' (é a casa do dono, que não paga a si mesma), sem valor.
   NÃO FAZ: não altera empresas, unidades, usuários, RLS de outras tabelas
   nem cobra ninguém.

   VERIFICAÇÃO: o select do fim devolve a impressão digital das colunas
   (md5 de nome:tipo, em ordem), que deve ser a327899d3c010f1012d5a0ab051005a5
   (conferida no PGlite por app/lib/saas-planos-banco.test.mjs), e quantas
   empresas ficaram sem assinatura (tem que ser 0).

   ROLLBACK (não rodar sem decisão do dono; apaga as assinaturas gravadas):
     drop function if exists public.hefisto_minha_assinatura();
     drop table if exists public.empresa_assinatura;
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

-- Preflight: aborta sem mudar nada se o banco não é o esperado.
do $$
begin
  if to_regclass('public.empresas') is null or to_regclass('public.unidades') is null
     or to_regclass('public.usuarios_erp') is null then
    raise exception 'SAAS-PLANOS-1: faltam empresas, unidades ou usuarios_erp. Nada foi alterado.';
  end if;
  if (select data_type from information_schema.columns
       where table_schema = 'public' and table_name = 'empresas' and column_name = 'id') <> 'uuid' then
    raise exception 'SAAS-PLANOS-1: empresas.id não é uuid. Nada foi alterado.';
  end if;
  if to_regclass('public.empresa_assinatura') is not null then
    raise exception 'SAAS-PLANOS-1: empresa_assinatura já existe. Nada foi alterado.';
  end if;
end $$;

create table public.empresa_assinatura (
  empresa_id uuid primary key references public.empresas(id) on delete restrict,
  plano text not null default 'gratis' check (plano in ('gratis', 'completo')),
  situacao text not null default 'ativa' check (situacao in ('ativa', 'em_teste', 'atrasada', 'cancelada', 'cortesia')),
  periodicidade text not null default 'mensal' check (periodicidade in ('mensal', 'semestral', 'anual')),
  forma_pagamento text check (forma_pagamento is null or forma_pagamento in ('credito', 'debito', 'pix')),
  valor_mensal_centavos integer check (valor_mensal_centavos is null or valor_mensal_centavos >= 0),
  proximo_vencimento date,
  provedor text,
  provedor_ref text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table public.empresa_assinatura is
  'Plano e situação da cobrança de cada empresa (SAAS-PLANOS-1). Lista de planos e preços: app/lib/planos.mjs.';

-- Fora da API: RLS ligado, nenhuma política, nenhum grant ao app.
alter table public.empresa_assinatura enable row level security;
revoke all on public.empresa_assinatura from anon, authenticated;

create function public.hefisto_minha_assinatura()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
           'plano', a.plano,
           'situacao', a.situacao,
           'periodicidade', a.periodicidade,
           'forma_pagamento', a.forma_pagamento,
           'valor_mensal_centavos', a.valor_mensal_centavos,
           'proximo_vencimento', a.proximo_vencimento
         )
    from public.usuarios_erp u
    join public.unidades casa on casa.id = u.unidade_principal_id
    join public.empresa_assinatura a on a.empresa_id = casa.empresa_id
   where u.auth_user_id = auth.uid()
     and u.status = 'ativo'
   limit 1
$$;

revoke all on function public.hefisto_minha_assinatura() from public, anon;
grant execute on function public.hefisto_minha_assinatura() to authenticated;

-- Empresas que já usam o Héfisto: Completo por cortesia, sem valor.
insert into public.empresa_assinatura (empresa_id, plano, situacao, valor_mensal_centavos)
select e.id, 'completo', 'cortesia', null
  from public.empresas e
on conflict (empresa_id) do nothing;

-- Verificação (impressão digital + empresas sem assinatura).
select md5(string_agg(column_name || ':' || data_type, ',' order by ordinal_position)) as impressao_digital,
       (select count(*) from public.empresas e
         where not exists (select 1 from public.empresa_assinatura a where a.empresa_id = e.id)) as empresas_sem_assinatura
  from information_schema.columns
 where table_schema = 'public' and table_name = 'empresa_assinatura';

commit;
