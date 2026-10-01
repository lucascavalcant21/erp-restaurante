/* PROPOSTA — custo efetivo, rendimento e empanamento. NADA AQUI FOI EXECUTADO.
   Cada parte só roda depois de aprovada pelo dono, uma por vez, no SQL Editor.

   Contexto: o código (app/lib/custo-rendimento.mjs) já calcula o custo efetivo
   ao vivo pelo cadastro do ingrediente — telas, ficha, CMV por item e
   simulações estão certos sem mexer no banco. O banco entra em dois pontos:

   1. fichas_ingredientes.fator_correcao gravado pela versão antiga: perda de
      15% foi gravada como 15 ("+15%"); o certo é 17,6471 (15/85). A produção
      integrada (confirmar_producao_integrada → operacao_consumo_ficha) lê esse
      número do banco: baixa e custeia 1,15 do líquido em vez de 1,1765.
      O app corrige as linhas de um ingrediente quando ele é salvo de novo;
      a PARTE 1 corrige todas de uma vez.

   2. A composição do empanamento (farinha, ovo, panko…) não tem onde morar:
      hoje o cadastro só guarda "ganho %" e "R$/kg do empanamento" digitados.
      A PARTE 2 cria o lugar. Sem ela, a tela de composição não pode existir. */


/* ── PARTE 0 · PRÉVIA (só leitura) ─────────────────────────────────────────
   Quantas linhas de ficha estão com o fator antigo, e quanto muda. */
select
  i.nome                                         as ingrediente,
  i.perda_pct,
  fi.fator_correcao                              as fator_gravado,
  round(i.perda_pct / (100 - i.perda_pct) * 100, 4) as fator_correto,
  count(*)                                       as linhas_de_ficha
from public.fichas_ingredientes fi
join public.insumos i on i.id = fi.insumo_id
where coalesce(i.empanado, false) = false
  and i.perda_pct > 0 and i.perda_pct < 100
  and fi.fator_correcao is distinct from round(i.perda_pct / (100 - i.perda_pct) * 100, 4)
group by 1, 2, 3, 4
order by 1;


/* ── PARTE 1 · CORREÇÃO DO FATOR GRAVADO (dados, sem mudar estrutura) ──────
   Só a coluna fator_correcao; quantidade, estoque e saldo não são tocados.
   Backup das linhas antes, para voltar se preciso.

begin;
create table if not exists public.sec_backup_fator_correcao (
  ficha_ingrediente_id uuid primary key, fator_antes numeric, salvo_em timestamptz not null default now()
);
alter table public.sec_backup_fator_correcao enable row level security;
revoke all on table public.sec_backup_fator_correcao from anon, authenticated;

insert into public.sec_backup_fator_correcao (ficha_ingrediente_id, fator_antes)
select fi.id, fi.fator_correcao
from public.fichas_ingredientes fi
join public.insumos i on i.id = fi.insumo_id
where coalesce(i.empanado, false) = false and i.perda_pct > 0 and i.perda_pct < 100
on conflict do nothing;

update public.fichas_ingredientes fi
set fator_correcao = round(i.perda_pct / (100 - i.perda_pct) * 100, 4)
from public.insumos i
where i.id = fi.insumo_id
  and coalesce(i.empanado, false) = false and i.perda_pct > 0 and i.perda_pct < 100;
commit;

   Rollback (só se precisar):
   update public.fichas_ingredientes fi set fator_correcao = b.fator_antes
     from public.sec_backup_fator_correcao b where b.ficha_ingrediente_id = fi.id;
*/


/* ── PARTE 2 · COMPOSIÇÃO DO EMPANAMENTO (estrutura — aditiva) ─────────────
   empanamento_itens: [{ "insumo_id": uuid, "quantidade": 80, "unidade": "g" }]
     o custo de cada item é lido do cadastro dele na hora (custo atual),
     nunca congelado aqui.
   empanamento_peso_g: quanto o lote ganhou de peso (medido). Vazio = soma do
     peso da composição.
   O lote de referência é o peso_bruto_padrao que já existe.
   ganho_pct e custo_empanado_kg ficam (não apaga nada) e deixam de ser usados
   quando houver composição.

alter table public.insumos add column if not exists empanamento_itens  jsonb;
alter table public.insumos add column if not exists empanamento_peso_g numeric(12,3);
*/


/* ── PARTE 3 · FUNÇÃO DE CUSTO DA PRODUÇÃO INTEGRADA ───────────────────────
   operacao_custo_insumo (db/migracao_operacao_integrada.sql) ignora a perda
   no empanado. Depende da PARTE 2 para usar a composição; o texto exato será
   escrito e testado (PGlite) depois que a PARTE 2 for aprovada. */
