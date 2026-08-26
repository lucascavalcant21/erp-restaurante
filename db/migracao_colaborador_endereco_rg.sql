-- ─────────────────────────────────────────────────────────────────────────────
-- ENDEREÇO SEPARADO E RG NO CADASTRO DO COLABORADOR
--
-- Por que existe: o cadastro do extra grava o endereço em campos separados
-- (rua, número, bairro) e o RG, mas essas colunas nunca foram criadas no banco.
-- Nenhuma migração as adicionava — só `cidade_uf` existia, pela filiação.
--
-- O efeito era invisível: `colabRetrySemColuna` (app/lib/rh.js) remove do
-- payload a coluna que o banco recusa e regrava sem ela, então o cadastro
-- salvava "com sucesso" e o que a pessoa digitou nesses quatro campos ia para
-- o lixo. Ao reabrir o cadastro, eles voltavam vazios, sem nenhum aviso.
--
-- `endereco` (o texto único, já existente) continua sendo gravado pelo app com
-- as partes juntas, e o recibo cai nele quando as partes estão vazias. Por isso
-- esta migração NÃO tenta quebrar os endereços antigos em pedaços: seria
-- adivinhação, e o dado que já está lá continua imprimindo certo.
--
-- Como rodar: cole no SQL Editor do Supabase e execute. Idempotente.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.colaboradores add column if not exists rua_av      text;
alter table public.colaboradores add column if not exists numero_casa text;
alter table public.colaboradores add column if not exists bairro      text;
alter table public.colaboradores add column if not exists rg          text;

-- Estas duas costumam já existir (filiação / schema antigo). Ficam aqui para
-- que rodar só este arquivo num banco novo deixe o cadastro inteiro funcional.
alter table public.colaboradores add column if not exists cidade_uf   text;
alter table public.colaboradores add column if not exists cep         text;

-- O PostgREST guarda o desenho das tabelas em cache. Sem isto ele continua
-- respondendo "Could not find the 'rua_av' column" mesmo com a coluna criada,
-- e o cadastro seguiria descartando os campos em silêncio.
notify pgrst, 'reload schema';
