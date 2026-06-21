-- ==============================================================================
-- CEREBRO ERP — Seed de Cargos e Funções
-- Cria hierarquias padrão para Cozinha, Salão e Bar em todas as unidades
-- ==============================================================================

-- 1. Adicionar coluna funcoes_padrao
ALTER TABLE public.rh_cargos
ADD COLUMN IF NOT EXISTS funcoes_padrao TEXT;

-- 2. Inserir cargos para TODAS as unidades existentes
-- Utilizamos CROSS JOIN para inserir a lista de cargos em cada unidade_id
INSERT INTO public.rh_cargos (nome, funcoes_padrao, unidade_id)
SELECT v.nome, v.funcoes_padrao, u.id
FROM public.unidades u
CROSS JOIN (
  VALUES 
    -- COZINHA
    ('Auxiliar de Cozinha 1', 'Nível básico. Auxilia na higienização de hortifrutis, limpeza geral da área, descasque e preparos simples.'),
    ('Auxiliar de Cozinha 2', 'Nível intermediário. Realiza cortes precisos, porcionamento, preparo de caldos base e organização das praças (mise en place).'),
    ('Auxiliar de Cozinha 3', 'Nível avançado. Apoio direto na linha quente, manipulação de proteínas cruas e preparo de molhos complexos.'),
    ('Cozinheiro 1', 'Cozinheiro júnior. Fica em praças de menor volume, frita, monta pratos frios/saladas e segue as fichas técnicas rigorosamente.'),
    ('Cozinheiro 2', 'Cozinheiro pleno. Domina praças de fogão e chapa, controla tempo de cocção de proteínas e finalização de pratos.'),
    ('Cozinheiro 3', 'Cozinheiro sênior (Sub-chefe). Lidera a linha de produção, garante padrão visual (empratamento) e coordena a equipe na ausência do chefe.'),
    ('Produção', 'Foco exclusivo na pré-preparação de alimentos em grande escala, processamento de lotes e congelamento/etiquetagem de insumos.'),
    ('Chefe de Cozinha', 'Liderança máxima da cozinha. Responsável por escalas, controle de estoque (CMV), fichas técnicas, elaboração de cardápio e qualidade.'),

    -- SALÃO
    ('Cumim', 'Auxílio ao garçom. Limpa mesas, polimenta talheres e taças, recolhe pratos sujos e abastece as praças do salão.'),
    ('Garçom', 'Atendimento direto ao cliente. Vende os produtos do cardápio, anota pedidos, tira dúvidas e garante a satisfação da mesa.'),
    ('Chefe de Fila', 'Líder de setor no salão. Coordena um grupo de garçons, resolve problemas rápidos com clientes e garante o padrão de atendimento do setor.'),
    ('Maître', 'Gerente do Salão. Recepciona os clientes, controla fila de espera, planeja as posições do salão e resolve conflitos.'),
    ('Gerente', 'Gestão geral da unidade. Responsável por abertura/fechamento da casa, caixa, gestão de equipe geral (cozinha/salão/bar) e indicadores financeiros.'),

    -- BAR
    ('Auxiliar de Barman', 'Limpeza do bar, reposição de gelo, frutas, xaropes, lavagem de copos e organização da estação de trabalho.'),
    ('Barman / Bartender', 'Preparo de drinks (clássicos e autorais), atendimento de clientes no balcão e conferência de validade dos insumos.'),
    ('Chefe de Bar', 'Head Bartender. Criador da carta de drinks, faz inventário de bebidas, controle de desperdício e coordena a equipe do bar.')
) AS v(nome, funcoes_padrao)
-- Apenas insere se o cargo ainda não existir para aquela unidade
WHERE NOT EXISTS (
    SELECT 1 FROM public.rh_cargos c 
    WHERE c.nome = v.nome AND c.unidade_id = u.id
);
