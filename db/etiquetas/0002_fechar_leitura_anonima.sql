/* FECHA A LEITURA ANÔNIMA DA TABELA etiquetas.

   POR QUE ISTO É UM ARQUIVO SEPARADO
   Hoje o QR funciona porque `etiquetas` tem policy de SELECT para anon
   (docs/rls-por-unidade.sql). Com saldo, custo, produção e linhagem na mesma
   linha, isso virou vazamento: quem escaneia um QR na rua passaria a ler o
   estoque inteiro da empresa.

   O substituto já existe: get_etiqueta_publica(), criada no 0001, que devolve
   só o que está impresso no papel.

   ORDEM OBRIGATÓRIA — não inverta:
   1. rode o 0001;
   2. suba o app com a página /rastreio já usando a função (buscarPorCodigo
      em app/lib/etiquetas.js);
   3. abra um QR real e confirme que a página mostra os dados;
   4. SÓ ENTÃO rode este arquivo.

   Se rodar antes do passo 3, o rastreio público quebra até o deploy sair.

   Reversível: o bloco comentado no fim recria a policy antiga.
*/

do $$
begin
  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'get_etiqueta_publica'
  ) then
    raise exception 'PREFLIGHT: get_etiqueta_publica() não existe. Rode db/etiquetas/0001 antes.';
  end if;
end $$;

/* PRÉVIA (rode sozinha antes): o que anon enxerga hoje em etiquetas.

select policyname, cmd, roles, qual
  from pg_policies
 where schemaname = 'public' and tablename = 'etiquetas'
   and ('anon' = any (roles) or roles = '{public}')
 order by policyname;
*/

do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
     where schemaname = 'public' and tablename = 'etiquetas'
       and ('anon' = any (roles) or roles = '{public}')
  loop
    execute format('drop policy if exists %I on public.etiquetas', pol.policyname);
    raise notice 'policy anônima removida de etiquetas: %', pol.policyname;
  end loop;
end $$;

revoke all on public.etiquetas from anon;

/* A função continua aberta ao anon — é ela, e só ela, que serve o QR. */
grant execute on function public.get_etiqueta_publica(text) to anon;

/* ── CONFERÊNCIA ──────────────────────────────────────────────────────────

   1. anon não lê mais a tabela:

select count(*) from pg_policies
 where schemaname='public' and tablename='etiquetas' and 'anon' = any (roles);
   Esperado: 0.

   2. o QR continua funcionando:

select * from public.get_etiqueta_publica('<código de uma etiqueta real>');

   3. abra /rastreio/<código> numa janela anônima.

   ── REVERTER (emergência) ────────────────────────────────────────────────

   create policy "anon_leitura_publica" on public.etiquetas
     for select to anon using (true);

   ───────────────────────────────────────────────────────────────────────── */
