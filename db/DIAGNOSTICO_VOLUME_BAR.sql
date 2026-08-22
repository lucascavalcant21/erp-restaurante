-- ─────────────────────────────────────────────────────────────────────────────
-- DIAGNÓSTICO — por que o volume não aparece em alguns itens do bar
--
-- O cadastro guarda tamanho_embalagem (número) + unidade_medida. O par serve
-- para duas coisas diferentes, e é isso que confunde a tela:
--
--   Absolut       → 1  e "L"        → volume de uma garrafa  ✔ é volume
--   Água com gás  → 12 e "garrafa"  → garrafas no fardo      ✘ é contagem
--
-- A tela agora só mostra como volume o que é medida (ml, L, kg, g). Item
-- cadastrado com unidade de contagem fica sem volume — e o certo é corrigir o
-- cadastro, não a tela: o volume da garrafa some do sistema inteiro, não só
-- desse cartão.
--
-- Este SELECT não altera nada. A coluna "situacao" diz o que fazer em cada um.
-- ─────────────────────────────────────────────────────────────────────────────

select nome,
       tamanho_embalagem,
       unidade_medida,
       unidade_comercial,
       case
         when tamanho_embalagem is null or tamanho_embalagem <= 0 then
           'SEM TAMANHO — preencha o volume da embalagem'
         when unidade_medida is null then
           'SEM UNIDADE — preencha ml, L, kg ou g'
         when lower(regexp_replace(unidade_medida, '\.$', '')) in (
                'un','und','unid','unidade','unidades','garrafa','garrafas',
                'lata','latas','caixa','caixas','cx','pct','pacote','pacotes',
                'fardo','fardos','dz','duzia','duzias','saco','sacos',
                'pote','potes','bandeja','bandejas','peca','pecas') then
           'CONTAGEM, NAO VOLUME — o numero e quantidade de itens. Ponha o volume de UMA unidade (ex.: 600 e ml) e use unidade_comercial para dizer "garrafa"'
         else 'ok — aparece como ' || tamanho_embalagem || ' ' || unidade_medida
       end as situacao
  from public.insumos
 where coalesce(departamento, '') ilike '%bar%'
    or lower(coalesce(categoria, '')) similar to '%(bebida|destilado|cerveja|refrigerante|agua|vinho)%'
 order by
   case when tamanho_embalagem is null or unidade_medida is null then 0
        when lower(unidade_medida) similar to '%(un|garrafa|lata|caixa|fardo|pacote|pote)%' then 1
        else 2 end,
   nome;
