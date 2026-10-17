/* ═══════════════════════════════════════════════════════════════════════════
   DOC-LEGADO-1 · ARQUIVAR OS 28 BOLETOS ANTIGOS DE `documentos` (B-025)

   DECISÃO DO DONO (17/10/2026, no chat da sessão): "arquivar".
   STATUS: EXECUTADO em 17/10/2026 (APR-013). 28 arquivadas; md5 de
   (id, valor, vencimento) igual antes e depois: fdd6c4cf0d7eddee75c20b680ff8a0f0.

   O QUE SÃO: 28 linhas da tela antiga "Notas e Boletos", sem unidade
   (unidade_id nulo), status pendente, R$ 7.964,69, vencimentos de 2020 a
   2026. A tela foi trocada por Contas a Pagar (redireciona desde 17/10) e
   nada mais lê esta tabela: as linhas só apareciam para o super admin.

   BACKUP: plano FREE (sem PITR). O passo 0 copia a tabela documentos inteira
   para backup_documentos_doc_legado_1_20261017, fora da API (RLS sem
   política e sem grant), na mesma transação.

   FAZ (uma transação):
     0. backup_documentos_doc_legado_1_20261017
     1. status 'pendente' → 'arquivado' nas 28 linhas sem unidade
   NÃO FAZ: não apaga linha, não mexe em valor, data, descrição nem em linha
   com unidade; não cria conta a pagar.

   PREFLIGHT: aborta sem mudar nada se não forem exatamente 28 linhas
   pendentes sem unidade somando R$ 7.964,69 (o que o dono viu).

   VERIFICAÇÃO: o select do fim mostra 28 arquivadas, 0 pendentes sem unidade
   e o mesmo md5 de (id, valor, vencimento) antes e depois.

   ROLLBACK (não rodar sem decisão do dono):
     update public.documentos d set status = b.status
       from public.backup_documentos_doc_legado_1_20261017 b
      where d.id = b.id and d.status = 'arquivado';
   ═══════════════════════════════════════════════════════════════════════════ */

begin;

do $$
declare n int; total numeric;
begin
  if to_regclass('public.documentos') is null then
    raise exception 'DOC-LEGADO-1: tabela documentos não existe. Nada foi alterado.';
  end if;
  select count(*), coalesce(sum(valor), 0) into n, total
    from public.documentos where unidade_id is null and status = 'pendente';
  if n <> 28 or total <> 7964.69 then
    raise exception 'DOC-LEGADO-1: esperava 28 linhas pendentes sem unidade somando 7964.69; achei % somando %. Nada foi alterado.', n, total;
  end if;
end $$;

create table if not exists public.backup_documentos_doc_legado_1_20261017 as table public.documentos;
-- cópia fora da API: RLS ligado sem política e sem grant para o app
alter table public.backup_documentos_doc_legado_1_20261017 enable row level security;
revoke all on public.backup_documentos_doc_legado_1_20261017 from anon, authenticated;

do $$
declare n int;
begin
  update public.documentos set status = 'arquivado'
   where unidade_id is null and status = 'pendente';
  get diagnostics n = row_count;
  if n <> 28 then
    raise exception 'DOC-LEGADO-1: arquivaria % linhas em vez de 28. Desfeito.', n;
  end if;
end $$;

commit;

-- Verificação (só leitura)
select
  (select count(*) from public.documentos where unidade_id is null and status = 'arquivado') as arquivadas,
  (select count(*) from public.documentos where unidade_id is null and status = 'pendente') as pendentes_sem_unidade,
  (select md5(string_agg(id::text || ':' || coalesce(valor::text, '') || ':' || coalesce(vencimento::text, ''), '|' order by id))
     from public.documentos where unidade_id is null) as md5_depois,
  (select md5(string_agg(id::text || ':' || coalesce(valor::text, '') || ':' || coalesce(vencimento::text, ''), '|' order by id))
     from public.backup_documentos_doc_legado_1_20261017 where unidade_id is null) as md5_backup;
