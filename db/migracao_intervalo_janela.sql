-- ─────────────────────────────────────────────────────────────────────────────
-- JANELA DO INTERVALO (colaboradores.intervalo_inicio / intervalo_fim)
--
-- Por que existe: o cadastro guardava só a DURAÇÃO do intervalo (60 min), mas a
-- folha de jornada da casa mostra a JANELA — "int: 17:00 as 18:00". Sem as duas
-- horas, o espelho impresso não fica igual ao papel que a contabilidade usa.
--
-- Domingo tem par próprio porque quem trabalha domingo costuma ter outra
-- jornada: a Chefe de Cozinha, por exemplo, faz 09:00–17:20 com intervalo
-- 10:30–11:30, enquanto nos outros dias é 15:40–00:00 com 17:00–18:00.
--
-- A duração (tempo_intervalo) continua valendo: é ela que o banco de horas usa
-- para saber quanto faltou quando alguém não tirou o intervalo inteiro.
--
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.colaboradores add column if not exists intervalo_inicio     text;
alter table public.colaboradores add column if not exists intervalo_fim        text;
alter table public.colaboradores add column if not exists intervalo_dom_inicio text;
alter table public.colaboradores add column if not exists intervalo_dom_fim    text;


-- ── Valores das folhas de agosto/2026 ──────────────────────────────────────
-- Padrão da casa: intervalo das 17:00 às 18:00 de terça a domingo.
update public.colaboradores
   set intervalo_inicio = '17:00',
       intervalo_fim    = '18:00'
 where unidade_id = 'seldeestrela'
   and upper(nome) in (
     'LARISSA DA SILVA UHE', 'ALICE TERESINHA VISINTAINER XAVIER',
     'CEDEINE DEL VALLE TABLANTE FLORES', 'BRENDA LARISSA RIBEIRO MARTINS',
     'EDUARDA DE LIMA OLIVEIRA', 'JOSEPH ANDREY GOMES DA SILVA'
   );

-- Cedeine: domingo é 09:00–17:20 com intervalo 10:30–11:30.
update public.colaboradores
   set intervalo_dom_inicio = '10:30',
       intervalo_dom_fim    = '11:30'
 where unidade_id = 'seldeestrela'
   and upper(nome) = 'CEDEINE DEL VALLE TABLANTE FLORES';

notify pgrst, 'reload schema';
