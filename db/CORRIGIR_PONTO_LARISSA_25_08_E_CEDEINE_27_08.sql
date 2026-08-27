-- ─────────────────────────────────────────────────────────────────────────────
-- LARISSA — 25/08/2026 e CEDEINE — 27/08/2026
--
-- Larissa: entrada 15:40, intervalo das 16:40 às 17:40 e saída à meia-noite.
-- Cedeine: entrada 15:40.
--
-- Por que existe: pela tela de Corrigir batida seriam sete correções feitas uma
-- a uma. Aqui sai tudo de uma vez, com o mesmo efeito — inclusive o registro no
-- livro legal, que é o que a tela faz e um UPDATE solto não faria.
--
-- COMO A CORREÇÃO É GRAVADA
-- registro_ponto é o resumo que as telas mostram; ponto_marcacao é o livro do
-- Anexo IX, imutável e encadeado por hash. A Portaria MTP 671/2021 não deixa
-- reescrever marcação: corrigir é INSERIR um 'ajuste' guardando o valor
-- anterior e quem corrigiu. É o que o bloco abaixo faz, nessa ordem.
--
-- A SAÍDA À MEIA-NOITE é 26/08 00:00, mas o dia de referência continua sendo
-- 25/08 — senão a jornada dela apareceria partida em dois dias.
--
-- O "-03" no horário é obrigatório: a coluna é timestamptz e a sessão do
-- Supabase roda em UTC. Sem o fuso, o banco guardaria 15:40 UTC e a tela
-- mostraria 12:40.
--
-- Rodar de novo não duplica nada: o ajuste só entra se ainda não existir um
-- igual, e o resumo é reescrito com o mesmo valor.
--
-- Como rodar: cole no SQL Editor do Supabase e execute.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
declare
  v_unidade  text := 'seldeestrela';
  v_autor    text := 'Correção do proprietário (SQL Editor)';
  v_tem_livro boolean;

  r          record;
  v_colab    uuid;
  v_reg      uuid;
  v_data     date;
  v_campo    text;
  v_tipo     text;
  v_nova     timestamptz;
  v_antes    timestamptz;
  v_status   int;
begin
  select to_regclass('public.ponto_marcacao') is not null into v_tem_livro;
  if not v_tem_livro then
    raise notice 'ponto_marcacao não existe: só o resumo será corrigido. Rode db/migracao_ponto_nsr.sql para ter o livro legal.';
  end if;

  -- Cada linha: pessoa, dia, campo do resumo, tipo da batida, hora corrigida.
  for r in
    select * from (values
      ('LARISSA%', '2026-08-25', 'hora_entrada',           'entrada',           '2026-08-25 15:40:00-03'),
      ('LARISSA%', '2026-08-25', 'hora_saida_intervalo',   'saida_intervalo',   '2026-08-25 16:40:00-03'),
      ('LARISSA%', '2026-08-25', 'hora_retorno_intervalo', 'retorno_intervalo', '2026-08-25 17:40:00-03'),
      ('LARISSA%', '2026-08-25', 'hora_saida',             'saida_trabalho',    '2026-08-26 00:00:00-03'),
      ('CEDEINE%', '2026-08-27', 'hora_entrada',           'entrada',           '2026-08-27 15:40:00-03')
    ) as t(pessoa, dia, campo, tipo, hora)
  loop
    v_data  := r.dia::date;
    v_campo := r.campo;
    v_tipo  := r.tipo;
    v_nova  := r.hora::timestamptz;

    select id into v_colab
      from public.colaboradores
     where unidade_id = v_unidade
       and upper(nome) like r.pessoa
     limit 1;

    if v_colab is null then
      raise exception 'Não achei ninguém com nome % na unidade %.', r.pessoa, v_unidade;
    end if;

    -- Valor anterior, para o livro registrar o que estava lá antes.
    execute format('select id, %I from public.registro_ponto where colaborador_id = $1 and data_referencia = $2', v_campo)
      into v_reg, v_antes
      using v_colab, v_data;

    -- 1) Livro legal primeiro. Se ele recusar, nada mais acontece: resumo
    --    corrigido sem marcação é pior do que correção nenhuma.
    if v_tem_livro then
      insert into public.ponto_marcacao
        (unidade_id, colaborador_id, tipo, tipo_alvo, marcado_em, data_referencia,
         origem, coletor, valor_anterior, registrado_por)
      select v_unidade, v_colab, 'ajuste', v_tipo, v_nova, v_data,
             -- coletor '05' = outro: correção digitada, não batida em coletor.
             'ajuste', '05', v_antes, v_autor
       where not exists (
         select 1 from public.ponto_marcacao m
          where m.colaborador_id = v_colab
            and m.data_referencia = v_data
            and m.tipo = 'ajuste'
            and m.tipo_alvo = v_tipo
            and m.marcado_em = v_nova
       );
    end if;

    -- 2) Resumo do dia, que é o que as telas leem.
    v_status := case v_tipo
                  when 'entrada' then 1 when 'saida_intervalo' then 2
                  when 'retorno_intervalo' then 3 else 4 end;

    if v_reg is null then
      execute format(
        'insert into public.registro_ponto (colaborador_id, unidade_id, data_referencia, %I, status_jornada, origem_batida)
         values ($1, $2, $3, $4, $5, ''manual'')', v_campo)
        using v_colab, v_unidade, v_data, v_nova, v_status;
    else
      -- greatest preserva o andamento: corrigir a entrada não pode voltar para
      -- o começo um dia que já tem saída registrada.
      execute format(
        'update public.registro_ponto set %I = $1, status_jornada = greatest(coalesce(status_jornada, 1), $2) where id = $3', v_campo)
        using v_nova, v_status, v_reg;
    end if;

    raise notice '% % -> % (antes: %)', r.pessoa, v_campo,
      to_char(v_nova at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'),
      coalesce(to_char(v_antes at time zone 'America/Sao_Paulo', 'DD/MM HH24:MI'), 'vazio');
  end loop;
end $$;


-- Confira. Larissa 25/08 tem que sair 15:40 / 16:40 / 17:40 / 00:00,
-- e Cedeine 27/08 com entrada 15:40.
select c.nome,
       to_char(p.data_referencia, 'DD/MM')                                  as dia,
       (p.hora_entrada           at time zone 'America/Sao_Paulo')::time    as entrada,
       (p.hora_saida_intervalo   at time zone 'America/Sao_Paulo')::time    as saiu_int,
       (p.hora_retorno_intervalo at time zone 'America/Sao_Paulo')::time    as voltou_int,
       (p.hora_saida             at time zone 'America/Sao_Paulo')::time    as saida,
       p.status_jornada
  from public.registro_ponto p
  join public.colaboradores c on c.id = p.colaborador_id
 where c.unidade_id = 'seldeestrela'
   and ((upper(c.nome) like 'LARISSA%' and p.data_referencia = '2026-08-25')
     or (upper(c.nome) like 'CEDEINE%' and p.data_referencia = '2026-08-27'))
 order by c.nome;
