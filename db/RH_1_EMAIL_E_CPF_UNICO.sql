/* ═══════════════════════════════════════════════════════════════════════════
   RH-1 · E-MAIL DO COLABORADOR E CPF ÚNICO POR UNIDADE (HDEV-RH-001, Fase 1)

   STATUS: PROPOSTA. Rodar só com aprovação do dono.

   Problemas vistos no banco real (13/10/2026):
   - O formulário de RH pede e-mail, mas `colaboradores` não tem a coluna
     `email`: o valor era descartado em silêncio (colabRetrySemColuna).
   - Nada no banco impede o mesmo CPF duas vezes. Hoje: 23 colaboradores,
     0 CPF repetido, 6 sem CPF válido. A tela já checa duplicado, mas quem
     não vê CPF (permissão) não consegue checar: a trava tem de ser do banco.

   FAZ (uma transação; aditiva; não altera nenhuma linha existente):
     0. preflight: aborta se já houver CPF repetido na mesma unidade
     1. colaboradores.email text (nula)
     2. índice único parcial (unidade_id, CPF só com dígitos) quando o CPF tem
        11 dígitos — cadastros sem CPF continuam permitidos
   VERIFICAÇÃO: o select do fim mostra a coluna e o índice.
   ROLLBACK (não rodar sem decisão do dono):
     drop index if exists public.colaboradores_cpf_unico_por_unidade;
     alter table public.colaboradores drop column if exists email;
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

do $$
begin
  if exists (
    select 1 from public.colaboradores
     where length(regexp_replace(coalesce(cpf, ''), '\D', '', 'g')) = 11
     group by unidade_id, regexp_replace(cpf, '\D', '', 'g') having count(*) > 1
  ) then
    raise exception 'RH-1: há CPF repetido na mesma unidade. Resolva antes. Nada foi alterado.';
  end if;
end $$;

alter table public.colaboradores add column if not exists email text;
comment on column public.colaboradores.email is 'E-mail de contato do colaborador. RH-1.';

create unique index if not exists colaboradores_cpf_unico_por_unidade
  on public.colaboradores (unidade_id, (regexp_replace(cpf, '\D', '', 'g')))
  where length(regexp_replace(coalesce(cpf, ''), '\D', '', 'g')) = 11;

commit;

select 'coluna email' k, count(*)::text v from information_schema.columns
 where table_schema = 'public' and table_name = 'colaboradores' and column_name = 'email'
union all
select 'índice cpf único', count(*)::text from pg_indexes
 where schemaname = 'public' and indexname = 'colaboradores_cpf_unico_por_unidade';
