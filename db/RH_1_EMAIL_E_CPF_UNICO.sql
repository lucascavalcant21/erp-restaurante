/* ═══════════════════════════════════════════════════════════════════════════
   RH-1 · E-MAIL DO COLABORADOR E CPF ÚNICO POR EMPRESA (HDEV-RH-001, Fase 1)

   STATUS: PROPOSTA. Rodar só com aprovação do dono.

   Problemas vistos no banco real (13/10/2026):
   - O formulário de RH pede e-mail, mas `colaboradores` não tem a coluna
     `email`: o valor era descartado em silêncio (colabRetrySemColuna).
   - Nada no banco impede o mesmo CPF duas vezes. Hoje: 23 colaboradores,
     0 CPF repetido, 6 sem CPF válido. A tela já checa duplicado, mas quem
     não vê CPF (permissão) não consegue checar: a trava tem de ser do banco.

   REGRA (pedido do dono): o cadastro pessoal é UM por pessoa dentro da
   EMPRESA (tenant), valendo para todas as unidades dela. A mesma pessoa terá
   vínculos/contratos diferentes ao longo do tempo (extra → experiência →
   efetivo, desligamento e recontratação) sem criar outro cadastro: o novo
   vínculo vai no cadastro existente (Fase 3). Empresas diferentes continuam
   isoladas: a mesma pessoa em outra empresa é outro cadastro, e uma empresa
   não descobre nada da outra.

   Índice único não enxerga a empresa (ela está em unidades.empresa_id), então
   a trava é um gatilho: antes de gravar CPF ou trocar a unidade, procura o
   mesmo CPF (só dígitos) em qualquer unidade da mesma empresa. Trava de
   transação por (empresa, CPF) evita duas gravações simultâneas passarem.
   SECURITY DEFINER: precisa enxergar as outras unidades da empresa mesmo
   quando quem grava não tem acesso a elas; a mensagem não revela nome nem id.

   FAZ (uma transação; aditiva; não altera nenhuma linha existente):
     0. preflight: aborta se já houver CPF repetido dentro de uma empresa
     1. colaboradores.email text (nula)
     2. função colaboradores_cpf_unico_empresa() + gatilho antes de
        INSERT/UPDATE OF cpf, unidade_id
   VERIFICAÇÃO: o select do fim mostra a coluna, o gatilho e as 23 linhas.
   ROLLBACK (não rodar sem decisão do dono):
     drop trigger if exists colaboradores_cpf_unico_empresa on public.colaboradores;
     drop function if exists public.colaboradores_cpf_unico_empresa();
     alter table public.colaboradores drop column if exists email;
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

do $$
begin
  if exists (
    select 1
      from public.colaboradores c
      left join public.unidades u on u.id = c.unidade_id
     where length(regexp_replace(coalesce(c.cpf, ''), '\D', '', 'g')) = 11
     group by coalesce(u.empresa_id::text, 'unidade:' || c.unidade_id), regexp_replace(c.cpf, '\D', '', 'g')
    having count(*) > 1
  ) then
    raise exception 'RH-1: há CPF repetido dentro de uma empresa. Resolva antes. Nada foi alterado.';
  end if;
end $$;

alter table public.colaboradores add column if not exists email text;
comment on column public.colaboradores.email is 'E-mail de contato do colaborador. RH-1.';

create or replace function public.colaboradores_cpf_unico_empresa()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cpf text := regexp_replace(coalesce(new.cpf, ''), '\D', '', 'g');
  v_empresa text;
begin
  if length(v_cpf) <> 11 then return new; end if;
  select u.empresa_id::text into v_empresa from public.unidades u where u.id = new.unidade_id;
  -- sem empresa cadastrada: a unidade é o limite (nunca mistura tenants)
  v_empresa := coalesce(v_empresa, 'unidade:' || new.unidade_id);
  perform pg_advisory_xact_lock(hashtextextended('colaborador_cpf:' || v_empresa || ':' || v_cpf, 0));
  if exists (
    select 1
      from public.colaboradores c
      left join public.unidades u on u.id = c.unidade_id
     where c.id <> new.id
       and regexp_replace(coalesce(c.cpf, ''), '\D', '', 'g') = v_cpf
       and coalesce(u.empresa_id::text, 'unidade:' || c.unidade_id) = v_empresa
  ) then
    raise exception using
      errcode = '23505',
      message = 'CPF já cadastrado nesta empresa.',
      hint = 'Abra o cadastro existente da pessoa e registre um novo vínculo, em vez de criar outro cadastro.';
  end if;
  return new;
end $$;

revoke all on function public.colaboradores_cpf_unico_empresa() from public, anon, authenticated;

drop trigger if exists colaboradores_cpf_unico_empresa on public.colaboradores;
create trigger colaboradores_cpf_unico_empresa
  before insert or update of cpf, unidade_id on public.colaboradores
  for each row execute function public.colaboradores_cpf_unico_empresa();

commit;

select 'coluna email' k, count(*)::text v from information_schema.columns
 where table_schema = 'public' and table_name = 'colaboradores' and column_name = 'email'
union all
select 'gatilho cpf único', count(*)::text from pg_trigger
 where tgname = 'colaboradores_cpf_unico_empresa' and not tgisinternal
union all
select 'colaboradores', count(*)::text from public.colaboradores;
