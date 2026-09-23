/* HOTFIX DE AUTORIZAÇÃO: auth_papel, auth_unidade_id e pode_ver_todas param de
   confiar no JWT e passam a ler o cadastro do servidor.

   O QUE ESTAVA ERRADO
   As três funções liam auth.jwt() -> 'user_metadata'. No Supabase, user_metadata
   é gravável pelo próprio usuário logado (supabase.auth.updateUser({ data })).
   Qualquer pessoa com login válido podia se declarar papel = 'admin' e passar a
   enxergar e gravar dados de todas as unidades. Além disso pode_ver_todas()
   tratava string vazia como "vê tudo": quem não tivesse unidade no metadata
   (ou tivesse 'todas') recebia acesso total sem pedir nada.

   O QUE ESTA MIGRAÇÃO FAZ
   Reescreve só as três funções, lendo usuarios_erp e usuario_escopos pelo
   auth.uid() (que o usuário não controla). A regra passa a ser fechada por
   padrão: quem não tem cadastro ativo não é de unidade nenhuma e não vê nada
   além do que a policy liberar para linhas sem unidade.

   O QUE ESTA MIGRAÇÃO NÃO FAZ
   Não cria, altera nem remove nenhuma policy, nenhuma tabela e nenhum dado.
   Duas exposições continuam abertas e precisam de etapa própria:
     1) as policies de docs/rls-por-unidade.sql liberam linha com unidade_id
        NULL para todo mundo, inclusive no WITH CHECK (dá para inserir linha
        sem unidade e para zerar a unidade de uma linha existente);
     2) as tabelas que o ERP usa hoje (insumos, produtos, colaboradores,
        registro_ponto, pedidos, contas_pagar e outras) em geral têm policy
        "to authenticated using (true)", ou seja, sem escopo de unidade.

   ANTES DE RODAR
   Rode a PRÉVIA do bloco 1 sozinha. Ela mostra quem fica com acesso a tudo,
   quem fica preso a uma unidade e quem fica sem nenhuma unidade depois da
   troca. Se alguém que precisa enxergar a rede aparecer sem super_admin e sem
   escopo 'todos'/'empresa', ajuste o cadastro ANTES de aplicar — senão a
   pessoa perde a visão consolidada no instante em que isto rodar.

   Idempotente: pode rodar de novo sem efeito colateral.
*/

/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 1 — PRÉVIA (rode sozinha, não altera nada)
   ═══════════════════════════════════════════════════════════════════════════

select
  u.login,
  u.nome,
  u.status,
  u.tipo_acesso,
  u.super_admin,
  u.unidade_principal_id,
  (select count(*) from usuario_escopos e where e.usuario_id = u.id) as escopos,
  case
    when u.status <> 'ativo' then 'SEM ACESSO (usuário não ativo)'
    when u.super_admin
      or exists (select 1 from usuario_escopos e
                  where e.usuario_id = u.id and e.data_scope in ('todos','empresa'))
      then 'VÊ TODAS AS UNIDADES'
    when coalesce(u.unidade_principal_id,
           (select e.unidade_id from usuario_escopos e
             where e.usuario_id = u.id and e.unidade_id is not null
             order by e.unidade_id limit 1)) is not null
      then 'SÓ A UNIDADE ' || coalesce(u.unidade_principal_id,
             (select e.unidade_id from usuario_escopos e
               where e.usuario_id = u.id and e.unidade_id is not null
               order by e.unidade_id limit 1))
    else 'SEM UNIDADE (fecha o acesso por unidade)'
  end as depois_do_hotfix
from usuarios_erp u
order by 1;

   Quem tem login no Auth e NÃO tem cadastro no ERP fica sem unidade nenhuma:

select au.email, au.created_at
from auth.users au
left join usuarios_erp u on u.auth_user_id = au.id
where u.id is null
order by au.created_at;

   ═══════════════════════════════════════════════════════════════════════════ */


/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 2 — PREFLIGHT: o cadastro do servidor precisa existir
   ═══════════════════════════════════════════════════════════════════════════ */
do $$
begin
  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'usuarios_erp'
  ) then
    raise exception 'PREFLIGHT: public.usuarios_erp não existe. Rode docs/controle-acesso-rbac.sql antes deste hotfix.';
  end if;

  if not exists (
    select 1 from information_schema.tables
    where table_schema = 'public' and table_name = 'usuario_escopos'
  ) then
    raise exception 'PREFLIGHT: public.usuario_escopos não existe. Rode docs/controle-acesso-rbac.sql antes deste hotfix.';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'usuarios_erp'
      and column_name = 'unidade_principal_id' and data_type = 'text'
  ) then
    raise exception 'PREFLIGHT: usuarios_erp.unidade_principal_id não é text. unidade_id é text em todo o banco; verifique o cadastro antes de continuar.';
  end if;
end $$;


/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 3 — AS TRÊS FUNÇÕES, AGORA LENDO O SERVIDOR
   ═══════════════════════════════════════════════════════════════════════════ */

/* Papel do usuário logado, no vocabulário antigo ('admin', 'gerente', ...),
   para não quebrar nenhuma policy que compare com esses valores.
   Sem cadastro ativo devolve string vazia, que não casa com papel nenhum. */
create or replace function public.auth_papel()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select case
             when u.super_admin then 'admin'
             when u.tipo_acesso = 'administrador' then 'admin'
             else u.tipo_acesso
           end
    from usuarios_erp u
    where u.auth_user_id = auth.uid()
      and u.status = 'ativo'
    limit 1
  ), '');
$$;

/* Unidade do usuário logado. Vem da unidade principal do cadastro e, na falta
   dela, do primeiro escopo de unidade — sempre o mesmo, para a consulta ser
   determinística. Sem cadastro ativo devolve string vazia.

   ATENÇÃO: esta função devolve UMA unidade. Quem tem escopo em mais de uma só
   enxerga a primeira enquanto as policies compararem igualdade simples; o
   suporte a várias unidades entra junto com a reescrita das policies, usando
   hefisto_user_in_unit(auth.uid(), unidade_id). */
create or replace function public.auth_unidade_id()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (
      select u.unidade_principal_id
      from usuarios_erp u
      where u.auth_user_id = auth.uid()
        and u.status = 'ativo'
        and u.unidade_principal_id is not null
      limit 1
    ),
    (
      select e.unidade_id
      from usuario_escopos e
      join usuarios_erp u on u.id = e.usuario_id
      where u.auth_user_id = auth.uid()
        and u.status = 'ativo'
        and e.unidade_id is not null
      order by e.unidade_id
      limit 1
    ),
    ''
  );
$$;

/* Ver todas as unidades passa a ser uma concessão explícita do cadastro:
   super_admin, ou escopo com abrangência 'todos'/'empresa'. String vazia
   deixou de valer como "vê tudo" — era por ali que entrava quem não tinha
   unidade nenhuma. Sem cadastro ativo devolve false. */
create or replace function public.pode_ver_todas()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from usuarios_erp u
    where u.auth_user_id = auth.uid()
      and u.status = 'ativo'
      and (
        u.super_admin
        or exists (
          select 1 from usuario_escopos e
          where e.usuario_id = u.id
            and e.data_scope in ('todos','empresa')
        )
      )
  );
$$;


/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 4 — QUEM PODE EXECUTAR
   As policies chamam estas funções como o usuário logado, então authenticated
   precisa do execute. anon não precisa e não recebe.
   ═══════════════════════════════════════════════════════════════════════════ */
revoke all on function public.auth_papel() from public;
revoke all on function public.auth_unidade_id() from public;
revoke all on function public.pode_ver_todas() from public;

grant execute on function public.auth_papel() to authenticated, service_role;
grant execute on function public.auth_unidade_id() to authenticated, service_role;
grant execute on function public.pode_ver_todas() to authenticated, service_role;


/* ═══════════════════════════════════════════════════════════════════════════
   BLOCO 5 — CONFERÊNCIA (rode depois, separadamente)
   ═══════════════════════════════════════════════════════════════════════════

   1) As três funções não podem mais citar user_metadata:

select p.proname, p.prosrc ilike '%user_metadata%' as ainda_le_o_jwt
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('auth_papel','auth_unidade_id','pode_ver_todas')
order by 1;

   Esperado: ainda_le_o_jwt = false nas três.

   2) Logado como um usuário comum no app, estas três devem bater com o
      cadastro dele (e pode_ver_todas só pode ser true para quem você marcou):

select auth_papel(), auth_unidade_id(), pode_ver_todas();

   ═══════════════════════════════════════════════════════════════════════════ */
