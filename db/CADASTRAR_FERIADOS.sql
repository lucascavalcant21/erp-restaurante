-- ─────────────────────────────────────────────────────────────────────────────
-- FERIADOS NACIONAIS — 2026 e 2027 (unidade: seldeestrela)
--
-- Por que existe: o espelho de ponto marca FERIADO na linha do dia e o cálculo
-- de adicionais aplica +100% sobre feriado trabalhado. Sem os dias cadastrados,
-- feriado trabalhado sai como dia comum — e a folha subpaga quem trabalhou.
--
-- Só entram aqui os feriados NACIONAIS de lei. Carnaval, Quarta de Cinzas e
-- Corpus Christi são ponto facultativo, não feriado: tratá-los como feriado
-- obriga a casa ao adicional de 100%, e essa é decisão de folha, não de
-- sistema. Ficam no bloco opcional no fim do arquivo.
--
-- Feriados municipais (aniversário da cidade, padroeiro) não estão aqui porque
-- variam por município — cadastre pela tela RH → Feriados ou me diga quais são.
--
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente: rodar duas
-- vezes não duplica nada.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.rh_feriados (
  id         uuid primary key default gen_random_uuid(),
  unidade_id text not null,
  data       date not null,
  nome       text,
  criado_em  timestamptz default now()
);

alter table public.rh_feriados add column if not exists nome      text;
alter table public.rh_feriados add column if not exists criado_em timestamptz default now();

-- Um feriado por data e unidade. Sem isso, cada execução criava outra linha e o
-- espelho passava a mostrar o mesmo feriado repetido.
create unique index if not exists rh_feriados_unidade_data_idx
  on public.rh_feriados (unidade_id, data);


-- ── Nacionais de lei ────────────────────────────────────────────────────────
-- Sexta-feira Santa acompanha a Páscoa: 05/04/2026 e 28/03/2027.
insert into public.rh_feriados (unidade_id, data, nome)
select v.unidade_id, v.data, v.nome
  from (values
    ('seldeestrela'::text, '2026-01-01'::date, 'Confraternização Universal'::text),
    ('seldeestrela',       '2026-04-03',       'Sexta-feira Santa'),
    ('seldeestrela',       '2026-04-21',       'Tiradentes'),
    ('seldeestrela',       '2026-05-01',       'Dia do Trabalho'),
    ('seldeestrela',       '2026-09-07',       'Independência do Brasil'),
    ('seldeestrela',       '2026-10-12',       'Nossa Senhora Aparecida'),
    ('seldeestrela',       '2026-11-02',       'Finados'),
    ('seldeestrela',       '2026-11-15',       'Proclamação da República'),
    ('seldeestrela',       '2026-11-20',       'Consciência Negra'),
    ('seldeestrela',       '2026-12-25',       'Natal'),

    ('seldeestrela',       '2027-01-01',       'Confraternização Universal'),
    ('seldeestrela',       '2027-03-26',       'Sexta-feira Santa'),
    ('seldeestrela',       '2027-04-21',       'Tiradentes'),
    ('seldeestrela',       '2027-05-01',       'Dia do Trabalho'),
    ('seldeestrela',       '2027-09-07',       'Independência do Brasil'),
    ('seldeestrela',       '2027-10-12',       'Nossa Senhora Aparecida'),
    ('seldeestrela',       '2027-11-02',       'Finados'),
    ('seldeestrela',       '2027-11-15',       'Proclamação da República'),
    ('seldeestrela',       '2027-11-20',       'Consciência Negra'),
    ('seldeestrela',       '2027-12-25',       'Natal')
  ) as v(unidade_id, data, nome)
 where not exists (
   select 1 from public.rh_feriados f
    where f.unidade_id = v.unidade_id and f.data = v.data
 );


-- ── OPCIONAL: ponto facultativo ─────────────────────────────────────────────
-- Carnaval, Cinzas e Corpus Christi NÃO são feriado nacional. Para um bar isso
-- pesa: se a casa abre e paga como feriado, tire os "--" abaixo e rode de novo.
-- Se abre e paga como dia comum, deixe como está.
--
-- insert into public.rh_feriados (unidade_id, data, nome)
-- select v.unidade_id, v.data, v.nome
--   from (values
--     ('seldeestrela'::text, '2026-02-16'::date, 'Carnaval'::text),
--     ('seldeestrela',       '2026-02-17',       'Carnaval'),
--     ('seldeestrela',       '2026-02-18',       'Quarta-feira de Cinzas'),
--     ('seldeestrela',       '2026-06-04',       'Corpus Christi'),
--     ('seldeestrela',       '2027-02-08',       'Carnaval'),
--     ('seldeestrela',       '2027-02-09',       'Carnaval'),
--     ('seldeestrela',       '2027-02-10',       'Quarta-feira de Cinzas'),
--     ('seldeestrela',       '2027-05-27',       'Corpus Christi')
--   ) as v(unidade_id, data, nome)
--  where not exists (
--    select 1 from public.rh_feriados f
--     where f.unidade_id = v.unidade_id and f.data = v.data
--  );


notify pgrst, 'reload schema';

-- Confira o que ficou cadastrado:
select data, nome from public.rh_feriados
 where unidade_id = 'seldeestrela'
 order by data;
