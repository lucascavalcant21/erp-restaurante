-- ═══════════════════════════════════════════════════════════════════════════
-- DRINKS DUPLICADOS NO GUIA DE MONTAGEM
--
-- Por que aconteceu: tres telas criam montagem (ficha tecnica, produtos e a
-- sincronizacao do guia) e cada uma comparava o nome de um jeito. Uma so
-- minusculava, outra tirava espaco de um lado so. "Aperol Spritz " com espaco
-- no fim nao casava com "Aperol Spritz", e nascia o segundo card.
--
-- O codigo ja foi corrigido: as tres passaram a usar a mesma chave, que tira
-- acento, espaco das pontas e espaco duplicado. Este arquivo limpa o que ja
-- entrou e cria o indice que impede a repeticao.
--
-- Rode o PASSO 1 sozinho primeiro. NAO TEM DESFAZER a partir do PASSO 2.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── PASSO 0: A FUNCAO DE COMPARACAO ────────────────────────────────────────
-- Ja existe em IMPORTAR_PONTO_AGOSTO.sql, mas fica aqui tambem para este
-- arquivo rodar sozinho. A extensao unaccent nem sempre esta instalada, entao
-- a troca e feita a mao. Immutable: o indice do PASSO 3 exige isso.
create or replace function unaccent_simples(txt text) returns text as $fn$
  select btrim(regexp_replace(
    translate(
      coalesce(txt, ''),
      'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ',
      'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC'
    ),
    '\s+', ' ', 'g'
  ));
$fn$ language sql immutable;


-- ── PASSO 1: VER O QUE ESTA DUPLICADO ──────────────────────────────────────
-- Troque 'SUA_UNIDADE' pelo id da sua unidade.
-- A coluna "conteudo" diz quantas informacoes o card tem: e por ela que o
-- PASSO 2 escolhe qual fica.
with chave as (
  select
    m.*,
    lower(regexp_replace(btrim(unaccent_simples(m.nome)), '\s+', ' ', 'g')) as nome_chave,
    (case when m.estrutura_ia is not null and jsonb_array_length(coalesce(m.estrutura_ia, '[]'::jsonb)) > 0 then 1 else 0 end)
    + (case when coalesce(btrim(m.descritivo), '') <> '' then 1 else 0 end)
    + (case when coalesce(btrim(m.foto_url), '') <> '' then 1 else 0 end) as conteudo
  from public.montagem m
  where m.unidade_id = 'SUA_UNIDADE'
)
select nome_chave, count(*) as copias,
       string_agg(nome || ' [conteudo ' || conteudo || ']', ' | ' order by conteudo desc, created_at) as versoes
  from chave
 group by nome_chave
having count(*) > 1
 order by copias desc, nome_chave;


-- ── PASSO 2: APAGAR AS COPIAS, MANTENDO A MAIS COMPLETA ────────────────────
-- Criterio: fica a que tem mais informacao (camadas da IA, passo a passo,
-- foto). Empate, fica a mais antiga -- e a que os outros registros ja podem
-- estar referenciando.
begin;

with chave as (
  select
    m.id, m.nome, m.created_at,
    lower(regexp_replace(btrim(unaccent_simples(m.nome)), '\s+', ' ', 'g')) as nome_chave,
    (case when m.estrutura_ia is not null and jsonb_array_length(coalesce(m.estrutura_ia, '[]'::jsonb)) > 0 then 1 else 0 end)
    + (case when coalesce(btrim(m.descritivo), '') <> '' then 1 else 0 end)
    + (case when coalesce(btrim(m.foto_url), '') <> '' then 1 else 0 end) as conteudo
  from public.montagem m
  where m.unidade_id = 'SUA_UNIDADE'
),
ranqueado as (
  select id, nome_chave,
         row_number() over (partition by nome_chave order by conteudo desc, created_at asc) as posicao
    from chave
)
delete from public.montagem
 where id in (select id from ranqueado where posicao > 1);

commit;


-- ── PASSO 3: IMPEDIR QUE VOLTE ─────────────────────────────────────────────
-- O indice e a garantia de verdade. A checagem no app e "ler depois gravar":
-- duas telas salvando ao mesmo tempo passam as duas pela leitura antes de
-- qualquer uma inserir. Aqui o banco recusa a segunda.
create unique index if not exists idx_montagem_nome_unico
  on public.montagem (
    unidade_id,
    departamento,
    lower(regexp_replace(btrim(unaccent_simples(nome)), '\s+', ' ', 'g'))
  );

notify pgrst, 'reload schema';
