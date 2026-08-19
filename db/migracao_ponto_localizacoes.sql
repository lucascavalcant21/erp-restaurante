-- ─────────────────────────────────────────────────────────────────────────────
-- HISTÓRICO DE LOCALIZAÇÃO DAS BATIDAS (registro_ponto.localizacoes)
--
-- Por que existe: as colunas latitude/longitude/distancia_metros guardam UMA
-- localização por dia e são sobrescritas a cada batida. No fim do expediente
-- só sobrava a última — dava para saber onde a pessoa saiu, nunca onde entrou.
--
-- Agora cada batida vira uma linha aqui:
--   [{ "tipo": "entrada", "em": "...", "latitude": -1.45, "longitude": -48.5,
--      "distancia_metros": 12, "valido": true }, ...]
--
-- Enquanto esta migração não roda, o ponto continua sendo registrado
-- normalmente: o app grava sem a coluna e o histórico começa depois.
--
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.registro_ponto
  add column if not exists localizacoes jsonb not null default '[]'::jsonb;

notify pgrst, 'reload schema';
