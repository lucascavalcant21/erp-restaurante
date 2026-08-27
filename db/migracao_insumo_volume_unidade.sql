/*
 VOLUME DE 1 GARRAFA / LATA / BARRIL (insumos.volume_unidade_ml)
 Por que existe: no cadastro do ingrediente, "Unidade" mistura duas coisas.
 ml, L, g e kg MEDEM; garrafa, lata e barril CONTAM. Quem cadastra água em
 garrafa não tem onde dizer que a garrafa é de 500 ml - e sem isso a ficha
 técnica não conseguia somar o rendimento: 1 garrafa valia zero na conta, e o
 card "Quantidade da receita" pedia ingredientes mesmo já tendo um.
 Esta coluna guarda quanto cabe em UMA unidade contada, sempre em ml. Fica
 vazia para quem já mede em ml/L/g/kg, que não precisa dela.
 Barril de chopp: 30000 (30 L). Lata: 350 ou 473. Garrafa: 500, 600, 1000.
 Como rodar: cole no SQL Editor do Supabase e execute. Idempotente.
*/

alter table public.insumos
  add column if not exists volume_unidade_ml numeric;

comment on column public.insumos.volume_unidade_ml is
  'Quanto cabe em 1 garrafa/lata/barril, em ml. Só para unidades de contagem; vazio para itens medidos em ml/L/g/kg.';

/*
 Sem isso o PostgREST continua respondendo com o desenho antigo em cache e a
 coluna nova "não existe" para o site, mesmo já existindo no banco.
*/
notify pgrst, 'reload schema';
