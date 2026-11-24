/* STATUS: APLICADA no banco do restaurante (sezccspqxgklicfndwxx) em 24/11/2026 com o OK do dono (BLQ-024: um sistema só). No restaurante o admin semeado é o dono de lá (79d15633…), não o do staging.
 PUB-1: pedidos de cadastro da página inicial (21/11/2026, pedido do dono:
   "página inicial do Héfisto ... botões de login e cadastre-se para a área
   escolhida"; decisão do dono: PEDIDO de cadastro, a conta continua sendo
   criada pelo administrador).

   ADITIVA:
   - hefisto_admins_plataforma: quem administra o Héfisto como produto (não o
     administrador de uma empresa cliente). Começa só com o dono.
   - hefisto_eh_admin_plataforma(): a checagem usada nas regras.
   - hefisto_pedidos_cadastro: os pedidos. Ninguém lê nem escreve direto,
     a não ser o administrador da plataforma (ler e mudar o status).
   - hefisto_pedir_cadastro(...): a única porta de entrada, aberta a quem não
     tem login. Confere os campos, exige o aceite e segura repetição (mesmo
     WhatsApp ou e-mail em 24 h) e enxurrada (mais de 60 por hora).

   ROLLBACK: db/publico/PUB_1_ROLLBACK.sql (só com decisão do dono). */

begin;

do $$
begin
  if to_regclass('public.hefisto_pedidos_cadastro') is not null and to_regprocedure('public.hefisto_pedir_cadastro(text,text,text,text,text,text,text,text,boolean)') is not null then
    raise notice 'PUB-1 já aplicada: as definições são repostas sem apagar dados.';
  end if;
end $$;

create table if not exists public.hefisto_admins_plataforma (
  auth_user_id uuid primary key,
  criado_em timestamptz not null default now()
);
alter table public.hefisto_admins_plataforma enable row level security;
revoke all on public.hefisto_admins_plataforma from public, anon, authenticated;
-- Dono do Héfisto (auth do sistema novo), aprovado em 21/11/2026.
insert into public.hefisto_admins_plataforma (auth_user_id) values ('bddf8616-ce7c-4f0d-a48e-f478ec14ddc4') on conflict do nothing;

create or replace function public.hefisto_eh_admin_plataforma()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.hefisto_admins_plataforma a where a.auth_user_id = auth.uid())
$$;
revoke all on function public.hefisto_eh_admin_plataforma() from public;
grant execute on function public.hefisto_eh_admin_plataforma() to authenticated;

create table if not exists public.hefisto_pedidos_cadastro (
  id uuid primary key default gen_random_uuid(),
  area text not null check (area in ('restaurante', 'delivery', 'eventos', 'consultorio', 'pessoal')),
  plano text not null default 'gratis' check (plano in ('gratis', 'completo')),
  nome text not null check (length(btrim(nome)) between 2 and 120),
  whatsapp text not null check (whatsapp ~ '^[0-9]{10,13}$'),
  email text not null check (length(email) <= 160 and email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),
  negocio text check (negocio is null or length(negocio) <= 120),
  cidade text check (cidade is null or length(cidade) <= 80),
  mensagem text check (mensagem is null or length(mensagem) <= 1000),
  consentimento text not null,
  status text not null default 'novo' check (status in ('novo', 'em_contato', 'conta_criada', 'descartado')),
  observacao text check (observacao is null or length(observacao) <= 1000),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
create index if not exists hefisto_pedidos_cadastro_criado on public.hefisto_pedidos_cadastro (criado_em desc);
alter table public.hefisto_pedidos_cadastro enable row level security;
revoke all on public.hefisto_pedidos_cadastro from public, anon, authenticated;
grant select on public.hefisto_pedidos_cadastro to authenticated;
grant update (status, observacao) on public.hefisto_pedidos_cadastro to authenticated;

drop policy if exists hefisto_pedidos_ler on public.hefisto_pedidos_cadastro;
create policy hefisto_pedidos_ler on public.hefisto_pedidos_cadastro for select to authenticated
  using (public.hefisto_eh_admin_plataforma());
drop policy if exists hefisto_pedidos_mudar on public.hefisto_pedidos_cadastro;
create policy hefisto_pedidos_mudar on public.hefisto_pedidos_cadastro for update to authenticated
  using (public.hefisto_eh_admin_plataforma()) with check (public.hefisto_eh_admin_plataforma());

create or replace function public.hefisto_pedidos_tocar() returns trigger language plpgsql as $$
begin new.atualizado_em := now(); new.atualizado_por := auth.uid(); return new; end $$;
drop trigger if exists hefisto_pedidos_tocar on public.hefisto_pedidos_cadastro;
create trigger hefisto_pedidos_tocar before update on public.hefisto_pedidos_cadastro
  for each row execute function public.hefisto_pedidos_tocar();

create or replace function public.hefisto_pedir_cadastro(
  p_area text, p_plano text, p_nome text, p_whatsapp text, p_email text,
  p_negocio text, p_cidade text, p_mensagem text, p_aceite boolean)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_whats text := regexp_replace(coalesce(p_whatsapp, ''), '[^0-9]', '', 'g');
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_nome text := btrim(coalesce(p_nome, ''));
  v_area text := lower(btrim(coalesce(p_area, '')));
  v_plano text := lower(btrim(coalesce(nullif(p_plano, ''), 'gratis')));
begin
  if not coalesce(p_aceite, false) then return jsonb_build_object('ok', false, 'erro', 'aceite'); end if;
  if v_area not in ('restaurante', 'delivery', 'eventos', 'consultorio', 'pessoal') then return jsonb_build_object('ok', false, 'erro', 'area'); end if;
  if v_plano not in ('gratis', 'completo') then return jsonb_build_object('ok', false, 'erro', 'plano'); end if;
  if length(v_nome) not between 2 and 120 then return jsonb_build_object('ok', false, 'erro', 'nome'); end if;
  if v_whats !~ '^[0-9]{10,13}$' then return jsonb_build_object('ok', false, 'erro', 'whatsapp'); end if;
  if length(v_email) > 160 or v_email !~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then return jsonb_build_object('ok', false, 'erro', 'email'); end if;
  if (select count(*) from public.hefisto_pedidos_cadastro where criado_em > now() - interval '1 hour') >= 60 then
    return jsonb_build_object('ok', false, 'erro', 'ocupado');
  end if;
  -- Repetido em 24 h: responde como recebido, sem gravar de novo (não revela quem já pediu).
  if exists (select 1 from public.hefisto_pedidos_cadastro where criado_em > now() - interval '24 hours' and (whatsapp = v_whats or email = v_email)) then
    return jsonb_build_object('ok', true);
  end if;
  insert into public.hefisto_pedidos_cadastro (area, plano, nome, whatsapp, email, negocio, cidade, mensagem, consentimento)
  values (v_area, v_plano, v_nome, v_whats, v_email,
          nullif(left(btrim(coalesce(p_negocio, '')), 120), ''), nullif(left(btrim(coalesce(p_cidade, '')), 80), ''),
          nullif(left(btrim(coalesce(p_mensagem, '')), 1000), ''),
          'Aceito que o Héfisto use meu nome, WhatsApp e e-mail para entrar em contato sobre este cadastro (versão 1, 21/11/2026).');
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.hefisto_pedir_cadastro(text,text,text,text,text,text,text,text,boolean) from public;
grant execute on function public.hefisto_pedir_cadastro(text,text,text,text,text,text,text,text,boolean) to anon, authenticated;

do $$
begin
  if to_regprocedure('public.hefisto_pedir_cadastro(text,text,text,text,text,text,text,text,boolean)') is null
     or (select count(*) from pg_policies where tablename = 'hefisto_pedidos_cadastro') <> 2
     or not (select relrowsecurity from pg_class where oid = 'public.hefisto_admins_plataforma'::regclass)
     or not (select relrowsecurity from pg_class where oid = 'public.hefisto_pedidos_cadastro'::regclass) then
    raise exception 'PUB-1: conferência falhou. Nada foi alterado.';
  end if;
end $$;

commit;
