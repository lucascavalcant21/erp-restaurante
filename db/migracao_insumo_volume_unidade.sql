/*
 QUANTO CABE / QUANTO PESA EM 1 UNIDADE CONTADA
 (insumos.volume_unidade_ml e insumos.peso_medio_g)
 Por que existe: no cadastro do ingrediente, "Unidade" mistura duas coisas.
 ml, L, g e kg MEDEM; garrafa, lata e barril CONTAM. Quem cadastra água em
 garrafa não tem onde dizer que a garrafa é de 500 ml - e sem isso a ficha
 técnica não conseguia somar o rendimento: 1 garrafa valia zero na conta, e o
 card "Quantidade da receita" pedia ingredientes mesmo já tendo um.
 Esta coluna guarda quanto cabe em UMA unidade contada, sempre em ml. Fica
 vazia para quem já mede em ml/L/g/kg, que não precisa dela.
 Barril de chopp: 30000 (30 L). Lata: 350 ou 473. Garrafa: 500, 600, 1000.

 A cozinha tem o mesmo problema em peso: "1 un" de tomate nao diz nada para a
 receita enquanto ninguem contar quanto pesa. Mesma pergunta, unidade
 diferente - o bar responde em ml, a cozinha em g. peso_medio_g ja era LIDO
 pela ficha tecnica, mas nenhuma tela escrevia nele; agora o cadastro pergunta.
 Tomate: 100. Ovo: 50.
 Como rodar: cole no SQL Editor do Supabase e execute. Idempotente.
*/

alter table public.insumos
  add column if not exists volume_unidade_ml numeric;

alter table public.insumos
  add column if not exists peso_medio_g numeric;

comment on column public.insumos.volume_unidade_ml is
  'Quanto cabe em 1 garrafa/lata/barril, em ml. Só para unidades de contagem; vazio para itens medidos em ml/L/g/kg.';

comment on column public.insumos.peso_medio_g is
  'Quanto pesa 1 unidade, em gramas. Só para unidade "un"; vazio para itens medidos em ml/L/g/kg.';

/*
 Sem isso o PostgREST continua respondendo com o desenho antigo em cache e a
 coluna nova "não existe" para o site, mesmo já existindo no banco.
*/
notify pgrst, 'reload schema';
