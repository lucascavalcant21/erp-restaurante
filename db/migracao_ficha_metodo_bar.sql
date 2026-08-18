-- ─────────────────────────────────────────────────────────────────────────────
-- MÉTODO DE PREPARO DO DRINK (fichas_tecnicas.metodo_bar)
--
-- Por que existe: batido e mexido não são estilo, mudam o resultado no copo.
-- O shaker aera, gela e dilui mais; o mixing glass mantém o drink límpido e com
-- corpo. Sem o campo, essa diferença só vivia na cabeça de quem já sabia.
--
-- Valores usados pelo app: batido | mexido | montado | liquidificador | dose.
-- Sem constraint de propósito: se amanhã entrar outro método, é só o app mudar,
-- e ficha antiga fica com nulo (nenhum método declarado).
--
-- Enquanto esta migração não roda, o app continua salvando a ficha sem o campo:
-- salvarFicha remove a coluna que o banco recusa e regrava.
--
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.fichas_tecnicas add column if not exists metodo_bar text;

notify pgrst, 'reload schema';
