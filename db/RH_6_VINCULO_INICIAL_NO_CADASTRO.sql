/* ═══════════════════════════════════════════════════════════════════════════
   RH-6 · VÍNCULO INICIAL CRIADO NO CADASTRO (HDEV-RH-001, Fase 5)

   STATUS: aplicada com a autorização permanente do dono para a missão de RH
   (13/10/2026), por ser aditiva e ensaiada.

   Lacuna da RH-4: a carga inicial criou o vínculo de quem já existia, mas
   nenhum caminho cria o vínculo de quem é cadastrado depois (tela do RH, tela
   de extras, importação). Sem vínculo, o cálculo do mês e as transições não
   funcionam. Conferido em 13/10/2026: 23 colaboradores, 23 com vínculo.

   FAZ (uma transação; só cria; não altera nenhuma linha existente):
     gatilho AFTER INSERT em colaboradores → abre 1 vínculo com a MESMA regra
     da carga da RH-4 (Freelancer → eventual/diária; status com "experi" →
     clt_experiencia com os dias do texto; senão clt_indeterminado/mensal).
     Sem data de admissão: início = data do cadastro, marcado como estimado.
     Não faz nada se o colaborador já tiver vínculo.
   ROLLBACK (não rodar sem decisão do dono):
     drop trigger if exists rh_vinculo_inicial on public.colaboradores;
     drop function if exists public.rh_vinculo_inicial();
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

do $$
begin
  if to_regclass('public.rh_vinculos') is null then raise exception 'RH-6: precisa da RH-4. Nada foi alterado.'; end if;
  if exists (select 1 from pg_trigger where tgname = 'rh_vinculo_inicial' and tgrelid = 'public.colaboradores'::regclass) then
    raise exception 'RH-6: gatilho já existe. Nada foi alterado.';
  end if;
end $$;

create function public.rh_vinculo_inicial() returns trigger language plpgsql security definer set search_path = public as $$
declare v_exp boolean := new.tipo_contrato is distinct from 'Freelancer' and coalesce(new.status_contrato, '') ilike '%experi%';
begin
  if exists (select 1 from rh_vinculos where colaborador_id = new.id) then return null; end if;
  insert into rh_vinculos (colaborador_id, unidade_id, categoria, regra_remuneracao, inicio, inicio_estimado, experiencia_dias, salario_base, convencao_id)
  values (new.id, new.unidade_id,
    case when new.tipo_contrato = 'Freelancer' then 'eventual' when v_exp then 'clt_experiencia' else 'clt_indeterminado' end,
    case when new.tipo_contrato = 'Freelancer' then 'diaria' else 'mensal' end,
    coalesce(new.data_admissao, (coalesce(new.created_at, now()))::date),
    new.data_admissao is null,
    case when v_exp then least(90, greatest(1, coalesce(nullif(substring(new.status_contrato from '(\d+)'), '')::int, 45))) end,
    nullif(new.salario, 0),
    (select id from rh_convencoes where status = 'ativa' and unidades @> array[new.unidade_id] limit 1));
  return null;
end $$;
revoke all on function public.rh_vinculo_inicial() from public, anon, authenticated;
create trigger rh_vinculo_inicial after insert on public.colaboradores
  for each row execute function public.rh_vinculo_inicial();

commit;

-- verificação: gatilho criado; ninguém sem vínculo
select (select count(*) from pg_trigger where tgname = 'rh_vinculo_inicial') gatilho,
  (select count(*) from colaboradores c where not exists (select 1 from rh_vinculos v where v.colaborador_id = c.id)) sem_vinculo;
