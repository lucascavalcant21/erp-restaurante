-- Estado civil no cadastro de funcionários e extras.
-- Os demais campos pessoais (gênero, escolaridade, filhos, nascimento) já existem.
alter table public.colaboradores add column if not exists estado_civil text;
