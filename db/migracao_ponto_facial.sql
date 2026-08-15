-- ─────────────────────────────────────────────────────────────────────────────
-- PONTO POR RECONHECIMENTO FACIAL
--
-- O rosto NÃO é guardado como imagem: o aparelho calcula um vetor de 128
-- números (descritor) e é só isso que fica no banco. Não dá para reconstruir a
-- face a partir dele.
--
-- LGPD: biometria é dado pessoal SENSÍVEL (art. 5º, II). O consentimento
-- específico de cada funcionário fica registrado em face_consentimento_em.
-- A foto da batida (face_foto_auditoria) é guardada por escolha da gestão para
-- conferência — trate-a como dado sensível e apague o que não for mais preciso.
--
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

-- Cadastro facial do funcionário
alter table public.colaboradores add column if not exists face_descritores      jsonb;        -- lista de vetores (uma por captura)
alter table public.colaboradores add column if not exists face_cadastrado_em    timestamptz;
alter table public.colaboradores add column if not exists face_consentimento_em timestamptz;  -- aceite do termo LGPD
alter table public.colaboradores add column if not exists face_consentimento_por text;        -- quem colheu o aceite

-- Auditoria da batida por rosto
alter table public.registro_ponto add column if not exists face_foto_entrada   text;  -- base64 pequeno
alter table public.registro_ponto add column if not exists face_foto_saida     text;
alter table public.registro_ponto add column if not exists face_confianca      numeric(6,4); -- distância do match (menor = melhor)
alter table public.registro_ponto add column if not exists origem_batida       text;  -- facial | pin | manual
