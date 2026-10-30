/* ═══════════════════════════════════════════════════════════════════════════
   FIDELIDADE-3 · ENTRAR E CADASTRAR PELO CPF (tablet da mesa e QR)

   STATUS: APLICADA em 30/10/2026 com liberação do dono; impressão digital no
   banco 7ee2ccbcce7f0416ce291460409eb76e (igual ao PGlite). Telas TabletEntrar,
   TabletCadastro e QREntrar). Testada no PGlite
   (app/lib/fidelidade-cpf-banco.test.mjs) por cima da FIDELIDADE-1 e 2.

   DECISÃO DO DONO (Etapa 0): o CPF ACHA o cliente; o livro de pontos e selos
   continua pelo telefone. No tablet o cliente digita o CPF e ganha o
   DESCONTO de cadastro; o telefone nunca vai para a tela (o servidor resolve
   CPF → telefone e usa no pedido).

   FAZ (uma transação; só aditiva):
     1. clientes: colunas cpf (11 dígitos, único por unidade), uf, cidade,
        bairro. Nenhuma linha existente muda.
     2. fidelidade_cadastrar_cpf (servidor): cadastro com CPF, nascimento,
        estado, município, bairro e WhatsApp, com o aceite LGPD. Se o
        telefone já existir sem CPF, completa aquela ficha.
     3. fidelidade_cliente_do_cpf (servidor): devolve nome e telefone do
        cliente cadastrado com aquele CPF (o servidor só manda o primeiro
        nome para a tela).

   NÃO FAZ: não apaga nem altera linha existente; não expõe CPF a anon nem a
   authenticated (as funções são só do service_role).
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

do $$
begin
  if to_regprocedure('public.fidelidade_cadastrar(text,text,text,text,date,boolean)') is null then
    raise exception 'FIDELIDADE-3: a FIDELIDADE-1 não está aplicada. Nada foi alterado.';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'clientes' and column_name in ('cpf', 'uf', 'cidade', 'bairro')) then
    raise exception 'FIDELIDADE-3: clientes já tem cpf/uf/cidade/bairro (já aplicada?). Nada foi alterado.';
  end if;
end $$;

alter table public.clientes add column cpf text check (cpf is null or cpf ~ '^[0-9]{11}$');
alter table public.clientes add column uf text check (uf is null or uf ~ '^[A-Z]{2}$');
alter table public.clientes add column cidade text check (cidade is null or length(cidade) <= 80);
alter table public.clientes add column bairro text check (bairro is null or length(bairro) <= 80);
create unique index clientes_unidade_cpf on public.clientes (unidade_id, cpf) where cpf is not null;
comment on column public.clientes.cpf is 'CPF (só dígitos) informado pelo próprio cliente no cadastro do cardápio, com aceite LGPD. FIDELIDADE-3.';

-- CPF válido (dígitos verificadores), só dígitos.
create or replace function public._fidelidade_cpf(p text)
returns text language plpgsql immutable set search_path = public as $$
declare
  d text := regexp_replace(coalesce(p, ''), '[^0-9]', '', 'g');
  s integer;
  r integer;
begin
  if length(d) <> 11 or d ~ '^(.)\1{10}$' then return null; end if;
  s := 0;
  for i in 1..9 loop s := s + substr(d, i, 1)::integer * (11 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  if r <> substr(d, 10, 1)::integer then return null; end if;
  s := 0;
  for i in 1..10 loop s := s + substr(d, i, 1)::integer * (12 - i); end loop;
  r := (s * 10) % 11; if r = 10 then r := 0; end if;
  if r <> substr(d, 11, 1)::integer then return null; end if;
  return d;
end $$;

create or replace function public.fidelidade_cadastrar_cpf(p_unidade text, p_nome text, p_cpf text, p_telefone text, p_aniversario date,
  p_uf text, p_cidade text, p_bairro text, p_novidades boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_cpf text := public._fidelidade_cpf(p_cpf);
  v_tel text := public._fidelidade_tel(p_telefone);
  v_nome text := left(nullif(btrim(p_nome), ''), 80);
  v_uf text := upper(left(nullif(btrim(p_uf), ''), 2));
  v_cli record;
begin
  if v_cpf is null then raise exception 'CPF inválido.'; end if;
  if v_tel is null or v_nome is null then raise exception 'Cadastro inválido.'; end if;
  if v_uf is not null and v_uf !~ '^[A-Z]{2}$' then v_uf := null; end if;
  if not exists (select 1 from public.unidades where id = p_unidade) then raise exception 'Unidade inválida.'; end if;
  perform pg_advisory_xact_lock(hashtext('fidelidade-cpf:' || p_unidade || ':' || v_cpf));
  perform pg_advisory_xact_lock(hashtext('fidelidade:' || p_unidade || ':' || v_tel));
  -- Já existe ficha com este CPF: o cadastro está feito (não troca nome nem telefone de ninguém).
  if exists (select 1 from public.clientes where unidade_id = p_unidade and cpf = v_cpf) then
    return jsonb_build_object('ok', true, 'novo', false);
  end if;
  -- Ficha antiga do mesmo WhatsApp sem CPF: completa.
  select id, cadastro_em into v_cli from public.clientes
   where unidade_id = p_unidade and cpf is null and public._fidelidade_tel(tel) = v_tel
   order by cadastro_em nulls last, created_at limit 1;
  if v_cli.id is not null then
    update public.clientes
       set cpf = v_cpf, uf = coalesce(uf, v_uf), cidade = coalesce(cidade, left(nullif(btrim(p_cidade), ''), 80)),
           bairro = coalesce(bairro, left(nullif(btrim(p_bairro), ''), 80)), aniversario = coalesce(aniversario, p_aniversario),
           cadastro_em = coalesce(cadastro_em, now()), aceite_lgpd_em = now(), aceita_novidades = coalesce(p_novidades, false),
           origem = coalesce(origem, 'tablet')
     where id = v_cli.id;
    return jsonb_build_object('ok', true, 'novo', false);
  end if;
  insert into public.clientes (nome, tel, unidade_id, cpf, aniversario, uf, cidade, bairro, cadastro_em, aceite_lgpd_em, aceita_novidades, origem)
  values (v_nome, v_tel, p_unidade, v_cpf, p_aniversario, v_uf, left(nullif(btrim(p_cidade), ''), 80), left(nullif(btrim(p_bairro), ''), 80),
          now(), now(), coalesce(p_novidades, false), 'tablet');
  return jsonb_build_object('ok', true, 'novo', true);
end $$;

create or replace function public.fidelidade_cliente_do_cpf(p_unidade text, p_cpf text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  v_cpf text := public._fidelidade_cpf(p_cpf);
  v_cli record;
begin
  if v_cpf is null then return jsonb_build_object('ok', false, 'motivo', 'cpf_invalido'); end if;
  select nome, tel into v_cli from public.clientes where unidade_id = p_unidade and cpf = v_cpf limit 1;
  if v_cli.nome is null then return jsonb_build_object('ok', false, 'motivo', 'nao_cadastrado'); end if;
  return jsonb_build_object('ok', true, 'nome', v_cli.nome, 'tel', public._fidelidade_tel(v_cli.tel));
end $$;

revoke all on function public._fidelidade_cpf(text),
  public.fidelidade_cadastrar_cpf(text, text, text, text, date, text, text, text, boolean),
  public.fidelidade_cliente_do_cpf(text, text) from public, anon, authenticated;
grant execute on function public.fidelidade_cadastrar_cpf(text, text, text, text, date, text, text, text, boolean),
  public.fidelidade_cliente_do_cpf(text, text) to service_role;

commit;

-- Verificação (só leitura)
select md5(
  (select string_agg(column_name || ':' || data_type, '|' order by column_name) from information_schema.columns
    where table_schema = 'public' and table_name = 'clientes' and column_name in ('cpf', 'uf', 'cidade', 'bairro'))
  || '#' || (select string_agg(p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' || case when p.prosecdef then 'D' else 'I' end, '|' order by p.proname)
               from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname = 'public' and p.proname in ('_fidelidade_cpf', 'fidelidade_cadastrar_cpf', 'fidelidade_cliente_do_cpf'))
) as impressao_digital;
