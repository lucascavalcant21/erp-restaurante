# Spec — Cardápio Digital e Loja Online (referência: Suitable)

> Documento de referência para implementar no ERP via Claude Code.
> Levantado em 20/10/2026 a partir da central de ajuda pública da Suitable
> (https://intercom.help/suitableapp/pt-BR). As páginas de produto do site
> não puderam ser lidas (bloqueio de acesso automatizado).
>
> Convenção:
> - **[doc]** = comportamento descrito na documentação deles.
> - **[sugestão]** = lacuna que a documentação não cobre; decisão nossa para o ERP.
>
> Use isto como referência funcional. Nomes, textos, layout e identidade visual
> do nosso produto devem ser próprios.

---

## 1. Visão geral

Um único cardápio alimenta vários **canais de venda**. Cada categoria, produto,
grupo de complementos e item de complemento pode ser ligado/desligado por canal.

Canais **[doc]**:

| Código | Canal | Quem usa |
|---|---|---|
| `APP` | Loja online / cardápio digital (link) | Cliente, delivery/retirada |
| `AUTOATENDIMENTO` | QR Code na mesa ou comanda | Cliente no salão |
| `TABLET` | Tablet fixo na mesa | Cliente no salão |
| `TOTEM` | Quiosque touch com pagamento | Cliente no balcão |
| `GARCOM` | App do garçom | Equipe |
| `PDV` | Terminal de pedidos (lançamento manual, telefone) | Equipe |

Tipos de pedido **[doc]**: `ENTREGA`, `RETIRADA`, `SALAO` (mesa/comanda),
`SENHA`, `VEM_COMER` (consumo no local pelo balcão).

Modalidades **[doc]**: imediato, `AGENDAMENTO` (mesmo dia, horário escolhido),
`ENCOMENDA` (outro dia).

---

## 2. Cardápio

### 2.1 Categoria
Tipos de categoria **[doc]**: `ITENS_PRINCIPAIS` (tradicional), `PIZZA`.
Combos e promoções são **tipos de produto** cadastrados dentro de uma categoria.

Campos:
- nome, detalhes (descrição curta) **[doc]**
- impressora de produção (roteia o pedido para a cozinha/bar certo) **[doc]**
- perfil fiscal **[doc]**
- `aberta` — abre expandida no app **[doc]**
- disponibilidade (dias/horários) **[doc]**
- ativo por canal **[doc]**
- ordem de exibição (reordenável) **[doc]**
- imagem (usada no layout "categorias com foto") **[doc]**
- Pizza: `cobrar_pelo_maior_valor` **[doc]**

Ações **[doc]**: criar, duplicar, reordenar, desativar por canal, exportar
grupos de complementos de uma categoria para outra.

### 2.2 Produto (tradicional)
Campos **[doc]**: nome, detalhes, preço, perfil fiscal, impressora, foto,
código de integração (mapeia o produto em marketplaces), código de balança
(5 dígitos), `vender_por_kg`, ativo por canal, disponibilidade, ordem.

Regras:
- **Venda por kg [doc]**: no PDV/garçom o operador informa o peso; preço = preço/kg × peso.
- **Código de barras de balança [doc]**: a etiqueta traz 5 dígitos do produto; ao ler no PDV o item entra com o preço certo. Só no PDV.
- **Código de integração [doc]**: se presente, pedido de marketplace é vinculado ao produto existente; se ausente, o sistema cria o produto numa categoria do marketplace casando por nome.

### 2.3 Grupos de complementos (etapas)
É o coração da personalização. Um grupo é **reutilizável** em vários produtos;
editar o grupo afeta todos os produtos ligados **[doc]**.

Campos do grupo **[doc]**:
- nome, descrição (instrução para o cliente)
- `min`, `max` — `min > 0` torna obrigatório; `min = 0` é opcional
- ativo por canal
- `eh_ingredientes` — marca como etapa de **retirada de ingredientes** (sem custo; o cliente desmarca o que não quer)
- `permitir_repeticao` — o mesmo item pode ser escolhido mais de uma vez
- ordem dentro do produto

Campos do item **[doc]**: nome, descrição, foto, preço adicional (0 = grátis),
`padrao` (vem pré-selecionado), controle de estoque, ativo por canal.

Tipos especiais de etapa:
- **Retirada de ingredientes [doc]** — grupo com `eh_ingredientes = true`; itens listam os ingredientes; a doc diz que a impressão fica mais clara. **[sugestão]** imprimir como "SEM X".
- **Observação [doc]** — campo de texto livre. No sistema deles é um truque (grupo ativo com item inativo, sempre por último). **[sugestão]** No ERP, modelar como tipo explícito `OBSERVACAO` com `max_caracteres`.

Cálculo de preço **[sugestão]** (a doc não define): preço do produto + soma
de (preço do item × quantidade) de todos os itens escolhidos.

### 2.4 Pizza
Estrutura **[doc]**:
1. Categoria tipo `PIZZA`
2. **Tamanhos** (ex.: P, M, G)
3. **Sabores** — nome, imagem, detalhes/ingredientes, **preço por tamanho**, classificação (tipo de sabor; o app agrupa sabores por tipo com cor própria, ex.: tradicional/especial/doce)
4. Etapas opcionais, reordenáveis: **massas**, **bordas**, **complementos** — cada opção com nome, descrição e preço adicional

Regras:
- `cobrar_pelo_maior_valor` **[doc]**: pizza com vários sabores custa o preço do sabor mais caro naquele tamanho.
- **[sugestão]** suportar também `MEDIA` e `PROPORCIONAL` como regra configurável, e `max_sabores` por tamanho (a doc não mostra onde isso é configurado).
- Importação em massa de sabores **[doc]**: uma linha por sabor no formato `Nome; ingrediente1, ingrediente2, ...`.
- Alteração de preços em massa **[doc]**: tela que agrupa sabores com o mesmo preço por tamanho; editar o valor do grupo ou aplicar acréscimo/desconto (% ou R$) a todos.
- Destaques só podem apontar para um **tamanho** de pizza, não para um sabor **[doc]**.

### 2.5 Combo
Tipo de produto **[doc]**: nome, detalhes, imagem, disponibilidade
(sempre ou dias/horários). Composto por **etapas**:
- Etapa `PRODUTO`: nome, lista de produtos do cardápio elegíveis, quantidade a escolher, **preço de cada opção dentro do combo**, ordem.
- Etapa `PIZZA`: nome, categoria de pizza, tamanho, sabores elegíveis, quantidade de sabores, preço de cada sabor dentro do combo, ordem.

Preço do combo **[sugestão]**: soma dos preços das opções escolhidas em cada etapa (+ complementos dos itens, se permitido).

### 2.6 Promoção
Tipo de produto **[doc]**: categoria, nome, detalhes, itens incluídos
(produto ou pizza com categoria/tamanho/sabor), disponibilidade.
Desconto **[doc]**: novo preço fixo, percentual ou valor em R$ sobre o original.
Exibição **[doc]**: preço original riscado, preço novo em destaque.

### 2.7 Gerenciadores (operação do dia a dia)
- **Status de produtos [doc]**: filtro por categoria, status (ativo/inativo) e busca por nome/ingrediente; ativar/desativar por canal. **[sugestão]** permitir ação em lote.
- **Status de complementos**: existe um artigo com esse nome (conteúdo não lido). **[sugestão]** mesma tela para itens de complemento (ex.: acabou o bacon → desliga em todos os produtos de uma vez).
- **Valores de complementos [doc]**: visão simples (lista) ou agrupada por produto; alterar preço por: novo valor, acréscimo (% ou R$), desconto (% ou R$). Não vale para pizza (editada na categoria).
- **Pré-visualizar no app [doc]**.

---

## 3. Loja online (configurações)

### 3.1 Aparência **[doc]**
- Tema claro/escuro; cor principal
- Logo, capa (foto ou vídeo), favicon
- Layout de categorias: (1) todas abertas, (2) colapsáveis com escolha por categoria, (3) categorias em ícones com foto

### 3.2 Informações **[doc]**
Sobre, nome do app, telefone, e-mail, redes sociais, horário de funcionamento
com até 2 turnos por dia.

### 3.3 Abertura e fechamento **[doc]**
- Abrir/fechar manual, também para lojas de marketplace
- Tempo estimado de retirada e de entrega; retirada/entrega podem ser desligadas
- Histórico de quem abriu/fechou e quando

### 3.4 Agendamento e encomendas **[doc]**
- Antecedência mínima: horas, dias, horas úteis, ou "tempo médio de entrega/retirada"
- Janela máxima (dias ou horas à frente)
- Intervalo entre horários (ex.: 15 ou 60 min)
- Antecedência de produção: encomenda entra na lista mas só é aceita/impressa X tempo antes
- Capacidade: máximo de pedidos por hora (0 = ilimitado)
- Horários específicos de aceite

### 3.5 Destaques **[doc]**
- Mensagem no topo (texto + cor, aceita emoji)
- "Repetir último pedido"
- Destaque de produto ou tamanho de pizza, com nome/detalhes editáveis só para o destaque, formato `CARD` ou `BANNER`, ordem
- Dois blocos de destaques
- Carrossel automático com mínimo de 3 cards ou 2 banners
- Destaque só aparece no canal onde o produto está ativo

### 3.6 Roleta de prêmios **[doc]**
Desconto em R$ ou % (com teto), aplicado no pedido ou só na taxa de entrega;
pedido mínimo; permitir/bloquear em promoções e em combos.
**[sugestão]** definir pesos/probabilidades por prêmio e limite de giro por cliente.

### 3.7 Várias lojas em um link
Existe um recurso "Store Locator" (só o título do artigo foi visto).
**[sugestão]** um link agrupa várias unidades; o cliente escolhe a loja mais próxima.

---

## 4. Entrega

Três formas de cobrar taxa **[doc]** (uma ativa por loja):
1. **Bairros** — descrição, cidade, valor da taxa, ativo no app
2. **Raio** — faixas concêntricas a partir da loja, cada uma com valor (requer Google Maps)
3. **Áreas** — polígonos desenhados no mapa, cada um com valor e tempo de entrega (requer Google Maps)

Descontos na entrega por área **[doc]**: entrega grátis, % ou R$; todas as
áreas ou algumas; pedido mínimo; dias da semana.

Pagamento do entregador por área **[doc]**: valor da área, valor cobrado do
cliente, zero se grátis, valor manual, ou taxa fixa.

---

## 5. Checkout e pedido

### 5.1 Cliente **[doc]**
Telefones (vários), endereços (vários), documento, e-mail, observações
(ex.: restrições alimentares).

### 5.2 Configurações de pedido **[doc]**
- Pedido mínimo no app
- Taxa de serviço (%) e cobrança de entrada (R$, ao abrir comanda)
- Desconto máximo permitido
- Comanda por mesa **ou** comanda por pessoa (com numeração sequencial: inicial e ponto de reinício)
- Numeração inicial de pedidos de retirada/entrega
- Status automático ao atribuir entregador / ao atribuir preparador
- Senha para cancelar pedido

### 5.3 Formas de pagamento **[doc]**
Nome, ponto de recebimento (banco, caixa, cofre), tipo (`CARTAO`, `DINHEIRO`,
`PRAZO`, `PIX`). Cartão: débito/crédito, bandeira, dia de recebimento,
tarifa e taxa. Pix: chave, tipo de chave, titular.
No salão via QR **[doc]**: "pagar depois", Pix integrado, cartão integrado.
**[sugestão]** troco para dinheiro; flag online/offline por canal.

### 5.4 Status do pedido
A doc não lista os status. **[sugestão]**:
`RECEBIDO → ACEITO → EM_PREPARO → PRONTO → SAIU_PARA_ENTREGA → ENTREGUE`,
mais `CANCELADO`; `AGENDADO` antes de `ACEITO` para encomendas.
Mudança individual, em lote e por leitor de código de barras **[doc]**;
notifica o cliente pelo WhatsApp quando o bot está ativo **[doc]**.

---

## 6. Fidelização

### 6.1 Cupons **[doc]**
- Tipo: desconto no pedido ou na entrega
- Valor: R$ ou % (com desconto máximo); incluir ou não a entrega
- Pedido mínimo
- Público: todos, primeira compra, aniversariante (com X dias de tolerância), clientes por tags
- Limite total de usos (vazio = ilimitado), uso único por cliente, data de expiração, dias da semana
- Permitir com promoção / com combo
- Produtos que ativam / produtos que bloqueiam
- Restringir por forma de pagamento, modalidade (agendamento/encomenda) e tipo de pedido
- Código; link do app com cupom já aplicado

### 6.2 Cashback **[doc]**
% do pedido vira saldo; resgate máximo por pedido; validade em dias; só em
canais selecionados; só para formas de pagamento selecionadas; excluir combos
e promoções. O saldo só fica disponível depois que o pedido é pago; o cliente
escolhe usar agora ou depois.

### 6.3 Pontos **[doc]**
Liga/desliga; pontua por pedido (1 por pedido) ou por valor (1 ponto a cada
R$ X); considerar ou não a taxa de entrega; onde pontua; onde resgata (por
canal); mínimo de pontos para resgatar; recompensa em R$ ou %; permitir
resgate em promoções.

---

## 7. Autoatendimento

- **QR Code [doc]**: um QR por mesa (impressão/PDF); cliente pede e o pedido cai vinculado à mesa.
- **Tablet [doc]**: vinculado a uma mesa (troca protegida por senha); botão "chamar garçom" imprime alerta; opcional ler QR da comanda física para lançar nela.
- **Totem [doc]**: cadastro como dispositivo com nome; pagamento por Pix, voucher e cartão via maquininha vinculada; tema; tela de descanso (imagem/vídeo após 30 s parado); modos salão/retirada/entrega; exigir nome, exigir mesa, imprimir número do pedido, pagar no balcão; acesso pela URL da loja + `/totem` ou app Android com código de login de 5 dígitos.

---

## 8. Modelo de dados sugerido (PostgreSQL) **[sugestão]**

```sql
-- Canais como enum; disponibilidade por canal em tabela de junção genérica
create type canal as enum ('APP','AUTOATENDIMENTO','TABLET','TOTEM','GARCOM','PDV');
create type tipo_pedido as enum ('ENTREGA','RETIRADA','SALAO','SENHA','VEM_COMER');

create table loja (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  slug text unique not null,
  tema text default 'claro',
  cor_principal text,
  logo_url text, capa_url text, favicon_url text,
  layout_categorias text default 'colapsaveis', -- abertas | colapsaveis | com_foto
  pedido_minimo numeric(10,2) default 0,
  taxa_servico_pct numeric(5,2) default 0,
  modo_taxa_entrega text default 'bairro',      -- bairro | raio | area
  aberta boolean default false,
  tempo_entrega_min int, tempo_retirada_min int
);

create table horario_funcionamento (
  loja_id uuid references loja, dia_semana smallint, -- 0=dom
  turno smallint, abre time, fecha time
);

create table categoria (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid references loja not null,
  tipo text not null default 'ITENS_PRINCIPAIS', -- ITENS_PRINCIPAIS | PIZZA
  nome text not null, detalhes text, imagem_url text,
  impressora_id uuid, perfil_fiscal_id uuid,
  aberta boolean default false,
  cobrar_pelo_maior_valor boolean default true, -- só PIZZA
  regra_preco_pizza text default 'MAIOR',       -- MAIOR | MEDIA | PROPORCIONAL
  ordem int default 0
);

create table produto (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid references categoria not null,
  tipo text not null default 'SIMPLES', -- SIMPLES | COMBO | PROMOCAO
  nome text not null, detalhes text, foto_url text,
  preco numeric(10,2),
  vender_por_kg boolean default false,
  codigo_balanca char(5),
  codigo_integracao text,
  impressora_id uuid, perfil_fiscal_id uuid,
  ordem int default 0
);

-- Disponibilidade por canal (serve para categoria, produto, grupo, item, tamanho, sabor)
create table canal_ativo (
  entidade text not null,   -- 'categoria' | 'produto' | 'grupo' | 'item' | ...
  entidade_id uuid not null,
  canal canal not null,
  ativo boolean not null default true,
  primary key (entidade, entidade_id, canal)
);

-- Disponibilidade por dia/horário
create table disponibilidade (
  entidade text not null, entidade_id uuid not null,
  dia_semana smallint, inicio time, fim time
);

create table grupo_complemento (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid references loja not null,
  tipo text not null default 'ADICIONAL', -- ADICIONAL | INGREDIENTES | OBSERVACAO | MASSA | BORDA
  nome text not null, descricao text,
  min int default 0, max int default 1,
  permitir_repeticao boolean default false,
  max_caracteres int -- só OBSERVACAO
);

create table item_complemento (
  id uuid primary key default gen_random_uuid(),
  grupo_id uuid references grupo_complemento not null,
  nome text not null, descricao text, foto_url text,
  preco numeric(10,2) default 0,
  padrao boolean default false,
  controla_estoque boolean default false,
  ordem int default 0
);

-- Grupo reutilizável ligado a produtos (ou a categoria de pizza)
create table produto_grupo (
  produto_id uuid references produto, grupo_id uuid references grupo_complemento,
  ordem int default 0, primary key (produto_id, grupo_id)
);
create table categoria_grupo (
  categoria_id uuid references categoria, grupo_id uuid references grupo_complemento,
  ordem int default 0, primary key (categoria_id, grupo_id)
);

-- Pizza
create table pizza_tamanho (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid references categoria not null,
  nome text not null, max_sabores int default 1, fatias int, ordem int default 0
);
create table pizza_sabor (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid references categoria not null,
  nome text not null, detalhes text, imagem_url text,
  classificacao text, -- tipo de sabor (tradicional, especial, doce...)
  ordem int default 0
);
create table pizza_sabor_preco (
  sabor_id uuid references pizza_sabor, tamanho_id uuid references pizza_tamanho,
  preco numeric(10,2) not null, primary key (sabor_id, tamanho_id)
);

-- Combo
create table combo_etapa (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid references produto not null, -- produto tipo COMBO
  tipo text not null, -- PRODUTO | PIZZA
  nome text not null, quantidade int default 1,
  pizza_categoria_id uuid, pizza_tamanho_id uuid,
  ordem int default 0
);
create table combo_etapa_opcao (
  etapa_id uuid references combo_etapa,
  produto_id uuid, sabor_id uuid,
  preco_no_combo numeric(10,2) not null, ordem int default 0
);

-- Promoção
create table promocao_item (
  produto_id uuid references produto, -- produto tipo PROMOCAO
  item_produto_id uuid, pizza_tamanho_id uuid, sabor_id uuid
);
create table promocao_desconto (
  produto_id uuid primary key references produto,
  modo text not null, -- PRECO_FIXO | PERCENTUAL | VALOR
  valor numeric(10,2) not null
);

-- Entrega
create table bairro (id uuid primary key default gen_random_uuid(), loja_id uuid, cidade text, nome text, taxa numeric(10,2), ativo_app boolean default true);
create table raio_entrega (loja_id uuid, km_ate numeric(5,2), taxa numeric(10,2), tempo_min int, ordem int);
create table area_entrega (id uuid primary key default gen_random_uuid(), loja_id uuid, nome text, poligono jsonb, taxa numeric(10,2), tempo_min int, taxa_entregador numeric(10,2));

-- Cupom
create table cupom (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid, codigo text not null,
  alvo text not null,        -- PEDIDO | ENTREGA
  modo text not null,        -- VALOR | PERCENTUAL
  valor numeric(10,2) not null, desconto_maximo numeric(10,2),
  incluir_entrega boolean default false, pedido_minimo numeric(10,2),
  publico text default 'TODOS', -- TODOS | PRIMEIRA_COMPRA | ANIVERSARIANTE | TAGS
  dias_pos_aniversario int, tags text[],
  limite_usos int, uso_unico_por_cliente boolean default false,
  expira_em timestamptz, dias_semana smallint[],
  permitir_promocao boolean default false, permitir_combo boolean default false,
  produtos_ativam uuid[], produtos_bloqueiam uuid[],
  formas_pagamento uuid[], modalidades text[], tipos_pedido tipo_pedido[],
  unique (loja_id, codigo)
);

-- Pedido (item guarda snapshot de nome e preço)
create table pedido (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid, numero int, canal canal, tipo tipo_pedido,
  modalidade text default 'IMEDIATO', agendado_para timestamptz,
  cliente_id uuid, endereco jsonb, mesa_id uuid, comanda text,
  status text default 'RECEBIDO',
  subtotal numeric(10,2), taxa_entrega numeric(10,2), taxa_servico numeric(10,2),
  desconto numeric(10,2), total numeric(10,2),
  cupom_id uuid, observacao text, criado_em timestamptz default now()
);
create table pedido_item (
  id uuid primary key default gen_random_uuid(),
  pedido_id uuid references pedido, produto_id uuid,
  nome text, quantidade numeric(10,3), preco_unitario numeric(10,2),
  pizza_tamanho_id uuid, sabores jsonb,  -- [{sabor_id, nome, preco}]
  complementos jsonb,                     -- [{grupo, item, qtd, preco}]
  removidos text[], observacao text, total numeric(10,2)
);
```

---

## 9. Interface do cardápio (cliente, mobile-first)

> Padrões de layout e fluxo observados em prints de uma loja em produção
> (20/10/2026). Reproduzir a **estrutura e o comportamento**, não a marca:
> cores, logo, capa e textos vêm da configuração de cada loja (seção 3.1).

### 9.1 Estrutura geral
- Mobile-first, coluna única, fundo cinza bem claro, conteúdo em **cards
  brancos** (borda fina cinza, cantos ~12px).
- **Cor principal da loja** em: preços, botões principais, links de ação
  ("Regras", "Editar", "Adicionar endereço"), seleção de opções, cabeçalho da
  tela Descontos.
- Vermelho só para alertas e ações destrutivas ("Loja fechada", "Falta 1",
  "Excluir conta", "Não é meu telefone").
- **Barra inferior fixa** com 4 abas: Início, Histórico, Descontos, Perfil
  (ativa em preto, demais em cinza).
- Rodapé das telas longas: crédito da plataforma + versão do app.
- Modais de aviso como **bottom sheet** (ícone, título, texto, botão
  "Entendi" largo) ou **card central** sobre fundo escurecido.
- Estados vazios: ícone grande cinza + frase curta centralizada.

### 9.2 Início
De cima para baixo:
1. **Capa** (foto/vídeo da loja, largura total) com botões flutuantes
   redondos no canto: **idioma** (bandeira) e **tema claro/escuro**.
2. **Logo redondo** grande sobreposto à borda inferior da capa; o conteúdo
   sobe por cima da capa com cantos superiores arredondados.
3. **Linha de status**: "● Loja aberta/fechada" (verde/vermelho) à esquerda,
   botão **Info** à direita (abre sobre, horários, contato, endereço).
4. **Avisos em faixa** com ícone ⓘ: vermelho claro (loja fechada, não dá
   para concluir) e verde claro (mensagem de destaque, ex. cupom de 1ª compra).
5. **Repetir último pedido** (só com cliente identificado): card com as linhas
   "1x Produto" do último pedido, miniaturas das fotos lado a lado, e rodapé
   com o total + ação "Inserir no carrinho 🛒".
6. **Mais vendidos**: carrossel horizontal de cards verticais (foto, nome em
   até 2 linhas, descrição em 1–2 linhas, preço); o próximo card aparece cortado.
7. **Cabeçalho sticky**: logo pequeno + **seletor de categoria** (dropdown com
   scroll-spy: troca o nome ao rolar, rola até a seção ao escolher) + **Buscar**.
8. **Seções por categoria**: título em negrito + lista de produtos.

### 9.3 Card de produto
- Horizontal: texto à esquerda (~55%), foto à direita (~45%) na altura toda.
- Nome em negrito (até 2 linhas; o código do item pode vir no nome), descrição
  cinza até 3 linhas, preço na cor principal.
- **"A partir de R$ X"** quando o preço depende de escolha (ex. tamanho);
  **"R$ X"** quando é fixo.
- Sem foto: só texto, largura total.
- Promoção: preço original riscado + preço novo.

### 9.4 Busca
Tela cheia: campo com lupa, botão "Limpar" e **X** para fechar; estado vazio
"Digite para buscar produtos". **[sugestão]** busca por nome, descrição e
ingrediente, resultados com o mesmo card da lista.

### 9.5 Montagem do produto (wizard por etapas)
O produto com complementos vira um **passo a passo, uma etapa por tela**:
- **Tela 1**: foto grande no topo (voltar e compartilhar flutuantes), nome,
  descrição e o **primeiro grupo**.
- **Telas seguintes**: cabeçalho compacto (voltar, nome do produto,
  compartilhar) + um grupo por tela.
- **Indicador de pontos** acima do rodapé: um ponto por etapa, preenchidos até
  a etapa atual.
- **Rodapé fixo**: quantidade (– n +) e botão principal com o **total ao vivo**
  (base + complementos × quantidade). Rótulo **"Próximo →"** nas etapas
  intermediárias e **"Inserir →"** na última.
- Produto cujo preço vem do tamanho começa em **R$ 0,00** até a escolha.

Cabeçalho do grupo (fundo cinza claro):
- título e, abaixo, a instrução do grupo;
- **selo vermelho "⚠ Falta N"** enquanto o mínimo obrigatório não foi atingido
  (bloqueia avançar);
- **selo cinza "n / máx"** em grupos opcionais com limite (ex. "1 / 2");
- **lupa** para filtrar as opções do grupo (útil em grupos grandes).

Opções do grupo (lista com divisórias):
- nome + preço ("R$ 14,99"; omitir se for 0) **[sugestão]**;
- **radio** quando `max = 1`, **checkbox** quando `max > 1`;
- linha selecionada com **fundo na cor principal clara** e checkbox preenchido;
- **[sugestão]** com `permitir_repeticao`, trocar o checkbox por seletor – n +.

Última etapa típica: **Observação** — título, texto de apoio e campo livre.

### 9.6 Carrinho
- Tela com título "Carrinho" e **X** para fechar.
- Card por item: "1x Nome", foto miniatura à direita, e para cada grupo o
  **nome do grupo** seguido das escolhas em tópicos com o preço entre
  parênteses; ações **Editar** (reabre o wizard preenchido) e **Remover**;
  total do item à direita.
- Botão contornado **"Continuar comprando"**.
- Rodapé: "Total do pedido" + botão largo **"Fazer pedido"**.
- Loja fechada: ao tocar em "Fazer pedido" abre bottom sheet "Loja fechada —
  não é possível pedir agora" com "Entendi". O cliente pode navegar e montar o
  carrinho, só não finaliza.

### 9.7 Identificação
- **Seus dados**: WhatsApp (bandeira de país + máscara) e nome e sobrenome;
  "Próximo" desabilitado até validar; aceite por texto "Fazendo o pedido, você
  concorda com os Termos e condições". [observado]
- Cliente já conhecido pelo telefone pula esta tela; para trocar dados, pede
  código pelo WhatsApp (9.10). [observado]

### 9.7.1 Checkout — padrão de mercado (estilo iFood) **[sugestão]**

**Princípio**: uma **única tela de checkout** em seções empilhadas, todas
editáveis no lugar, com o botão final sempre visível. Nada de wizard longo:
o cliente vê tudo, ajusta o que quiser e finaliza. Primeiro pedido pede o
mínimo; pedidos seguintes já vêm preenchidos com as últimas escolhas.

Ordem das seções:

1. **Entrega ou Retirada** — segmented control no topo
   (`Entrega` | `Retirada`; `Consumir no local` se a loja oferecer).
   Esconde opções que a loja desligou (seção 3.3).

2. **Endereço** (só Entrega)
   - Card com o endereço selecionado (ícone pelo rótulo, rua e número,
     bairro/complemento) + "Trocar".
   - "Trocar" abre lista dos endereços salvos + "Adicionar novo"
     (busca com autocomplete ou "Usar minha localização" → pin no mapa →
     número, complemento, referência, rótulo Casa/Trabalho/Outro).
   - Ao escolher, recalcula **taxa** e **tempo** pela regra da loja
     (bairro, raio ou área — seção 4). Fora da área: aviso e sugestão de Retirada.
   - Retirada: mostra endereço da loja + botão "Como chegar" (mapa).

3. **Quando**
   - Opções em chips: **"Agora · 40–50 min"** e **"Agendar"**.
   - Agendar abre seletor de dia (chips com os próximos dias) e horários em
     faixas (respeitando antecedência, intervalo e capacidade — seção 3.4).
     Horários lotados aparecem desabilitados.
   - Loja fechada mas com agendamento ativo: "Agora" some, só "Agendar".

4. **Pagamento** — duas abas, como nos marketplaces:
   - **Pagar pelo app**: **Pix** (gera QR + copia-e-cola com contador de
     expiração na tela seguinte) e **Cartão** (cartões salvos tokenizados +
     "Adicionar cartão"; nunca guardar número completo).
   - **Pagar na entrega/retirada**: Dinheiro (pergunta **"Precisa de troco?"**
     → "Troco para quanto?" validando que é ≥ total), Cartão de crédito,
     Cartão de débito, Vale-refeição (bandeiras aceitas), Pix na entrega.
   - Só aparecem as formas que a loja habilitou para aquele canal (seção 5.3).
   - Lembra a última forma usada.

5. **Cupom e benefícios**
   - Linha "Cupom" → campo de código + lista de cupons disponíveis para o
     cliente (seção 6.1); mostra por que um cupom não vale ("pedido mínimo
     R$ 50", "não vale para combos").
   - **Cashback**: "Usar R$ X de saldo" (toggle), respeitando o máximo por pedido.
   - **Pontos**: quando atingiu a meta, "Resgatar R$ 30 com 300 pontos" (toggle).

6. **CPF na nota** — toggle "Incluir CPF na nota" → campo CPF com máscara
   (salva no cadastro do cliente para os próximos pedidos).

7. **Resumo de valores** (sempre no fim da tela)
   ```
   Subtotal            R$ 54,98
   Taxa de entrega     R$  6,00   (ou "Grátis" em verde)
   Taxa de serviço     R$  0,00   (só se configurada)
   Desconto (cupom)   -R$  5,50   (verde)
   Cashback           -R$  3,00   (verde)
   ─────────────────────────────
   Total               R$ 52,48
   ```

8. **Rodapé fixo**: total + botão largo **"Fazer pedido"**.
   Desabilitado com motivo explícito logo acima quando algo impede:
   "Escolha um endereço", "Pedido mínimo de R$ 30,00 — faltam R$ 4,00",
   "Informe o troco", "Loja fechada — agende para outro horário".

Validações no envio (servidor, nunca só no front):
- loja aberta ou horário agendado válido; produtos e complementos ainda ativos
  no canal; **preços recalculados no servidor** (o carrinho guarda só IDs);
  endereço dentro da área; pedido mínimo; regras do cupom; capacidade do horário.
- Se algo mudou (produto esgotou, preço mudou): modal listando o que mudou
  e botão "Atualizar carrinho". Nunca cobrar valor diferente do exibido.
- Idempotência: `chave_idempotencia` gerada no front para não duplicar
  pedido em clique duplo ou rede instável.

### 9.7.1b Tempo de retirada pelos produtos escolhidos **[decisão]**
O tempo de **retirada** depende do que está no carrinho. **[decisão]**

Regra de cálculo **[sugestão]**:
1. Cada produto tem `tempo_preparo_min` (seção 9D.4); se vazio, usa o da
   categoria; se vazio, o padrão da estação.
2. Itens são preparados em paralelo, então a base é o **item mais demorado**
   do pedido: `base = max(tempo_preparo dos itens)`.
3. Quantidade grande pesa: + X min a cada N unidades do mesmo item (ex.
   +3 min a cada 4 pizzas), configurável por produto/estação.
4. Fila da cozinha: + tempo conforme pedidos em preparo na estação mais
   carregada (ex. +2 min por pedido acima de 5).
5. Arredondar para faixa de 5 min e mostrar intervalo: "Pronto em 25–30 min".

Onde aparece:
- **Início do delivery**: "Retirada · a partir de 15 min" (menor tempo do
  cardápio + fila atual).
- **Card/detalhe do produto** (quando o tempo é alto): "⏱ 25 min de preparo".
- **Carrinho e checkout em Retirada**: "Pronto para retirar em 25–30 min" e,
  abaixo, o motivo: "Costela no fogo de chão leva 25 min". Recalcula ao
  adicionar/remover item.
- **Agendar retirada**: os horários disponíveis começam depois dessa
  previsão.
- **Confirmação/acompanhamento**: "Retire a partir de 19:40".
- **KDS**: o prazo de atraso (9D.2.2) passa a ser a **previsão do próprio
  pedido**, não um valor fixo — o card vira PRIORIDADE quando passa do horário
  prometido ao cliente.
- Entrega usa a mesma base + tempo de deslocamento da área (seção 4).

```sql
alter table categoria add column tempo_preparo_min int;
alter table estacao add column tempo_padrao_min int default 15,
                    add column extra_por_pedido_fila_min numeric(4,1) default 2,
                    add column fila_livre int default 5;
alter table produto add column extra_qtd_min int default 0,      -- +X min…
                    add column extra_qtd_a_cada int;              -- …a cada N unidades
-- pedido.previsao_inicio / previsao_fim (9.7.4) guardam a promessa feita ao cliente
```

### 9.7.2 Pagamento online **[sugestão]**
- **Pix**: tela com QR, copia-e-cola, valor e contador (ex. 15 min); confirma
  sozinho por webhook do PSP e avança para o acompanhamento. Expirou → "Gerar
  novo Pix" ou trocar forma de pagamento. Pedido só entra na cozinha após pago.
- **Cartão**: tokenização no front pelo gateway; 3DS quando exigido; recusado
  → mensagem clara e voltar para escolher outra forma, mantendo o carrinho.

### 9.7.3 Acompanhamento do pedido **[sugestão]**
Abre logo após "Fazer pedido" (e fica acessível no Histórico):
- Cabeçalho: número do pedido, status atual grande e **previsão**
  ("Chega entre 19:40 e 19:50").
- **Linha do tempo** vertical com os status (seção 5.4) e horário de cada
  passo: Recebido → Aceito → Em preparo → Pronto/Saiu para entrega → Entregue.
  Retirada troca "Saiu para entrega" por "Pronto para retirada".
- Mapa com o entregador quando houver rastreio (app do motoboy).
- Resumo: itens, endereço, forma de pagamento (e troco), valores.
- Ações: "Falar com a loja" (abre WhatsApp da loja com o número do pedido),
  "Cancelar" (só antes de aceito), "Pedir de novo" e "Avaliar" após entregue.
- Atualização em tempo real (WebSocket/SSE ou realtime do banco) + notificação
  no WhatsApp a cada mudança de status (seção 5.4).
- Pedido recusado/cancelado pela loja: status vermelho com motivo e, se pago
  online, informação do estorno.

### 9.7.4 Dados extras no pedido (modelo, seção 8) **[sugestão]**
```sql
alter table pedido add column forma_pagamento_id uuid,
  add column pagar_online boolean default false,
  add column troco_para numeric(10,2),
  add column cpf_nota text,
  add column cashback_usado numeric(10,2) default 0,
  add column pontos_resgatados int default 0,
  add column previsao_inicio timestamptz,
  add column previsao_fim timestamptz,
  add column pagamento_status text default 'PENDENTE', -- PENDENTE | PAGO | FALHOU | ESTORNADO
  add column pagamento_ref text,                       -- id da transação no gateway
  add column chave_idempotencia text unique;

create table pedido_status_log (
  pedido_id uuid references pedido, status text not null,
  em timestamptz default now(), usuario_id uuid, motivo text
);
```

### 9.8 Histórico
Cabeçalho com ícone de relógio e "Histórico de Pedidos"; lista de pedidos.
**[sugestão]** card por pedido com data, status, itens resumidos, total e
"Pedir de novo".

### 9.9 Descontos
- Cabeçalho largo na **cor principal** com borda inferior curva e título.
- **Card Fidelidade** sobreposto ao cabeçalho: ícone, título, link **Regras**,
  contador **"pontos / meta"** e **barra de progresso** (cor de destaque
  diferente da principal).
- Abaixo, lista de cupons/descontos disponíveis; vazio: "Nenhum desconto
  encontrado".
- **Regulamento** (modal ao tocar em Regras): texto **gerado da configuração
  de fidelidade** (seção 6.3) — R$ por ponto, meta e recompensa, quais tipos de
  pedido contam (entrega/retirada, app, telefone, salão), data de início da
  contagem, se o frete conta, "só após o pagamento", e exclusão de pedidos de
  marketplaces.

### 9.10 Perfil (Minha conta)
Cards empilhados:
1. **Meus pontos**: regra em uma frase + progresso + link Regras.
2. **Dados do cliente**: Nome, Telefone, Documento ("-" se vazio) + **Editar**.
3. **Meus endereços**: cada um com ícone pelo rótulo (Casa, Trabalho…),
   endereço em 2 linhas e menu ⋮ (editar/excluir/padrão); **"+ Adicionar endereço"**.
4. **Pedidos (n)** + "Ver histórico".
5. **Configurações de privacidade** (consentimentos LGPD, ex. receber campanhas).
6. **Sair**.
7. **Excluir conta** (vermelho).

Adicionar endereço → modal **"Confirmar localização"**: busca de endereço
(autocomplete) e **"Usar minha localização"** (GPS); **[sugestão]** depois
mostrar pin no mapa para ajuste + número, complemento, referência e rótulo.

**Verificação de identidade**: ações sensíveis (editar dados, ver endereços em
outro aparelho) abrem modal "Confirme sua identidade" com o telefone mascarado,
botão **"Receber código via WhatsApp"** (OTP) e link vermelho **"Não é meu
telefone"** (desloga e pede outro número).

### 9.11 Marketing pelo WhatsApp (fora do app, mas faz parte do fluxo)
Campanhas e gatilhos enviados pela conta comercial da loja:
- texto **personalizado com o nome** do cliente e tema do dia;
- **carrossel de cards** com imagem do produto/combo, legenda e botões de ação:
  "Pedir agora" (link direto para o produto no cardápio) e "Deixe sua
  avaliação";
- exemplos de gatilho: dia temático da semana com brinde, sugestão de prato.

Requisitos no ERP **[sugestão]**: deep link por produto/categoria/cupom
(`/p/{produto}`, `?cupom=CODIGO`), opt-in nas configurações de privacidade,
templates aprovados na API oficial do WhatsApp, link de avaliação pós-pedido.

### 9.12 Tokens de design (configuráveis por loja) **[sugestão]**
```css
:root {
  --cor-principal: #14532D;       /* verde escuro, vem da loja; texto sobre ela sempre branco */
  --cor-principal-clara: #EAF4EE; /* seleção, chips */
  --cor-destaque: #f5b47c;        /* barra de progresso */
  --fundo: #f4f4f4;
  --card: #ffffff;
  --borda: #e2e2e2;
  --texto: #111111;
  --texto-secundario: #6b6b6b;
  --perigo: #d32f2f;
  --aviso-erro-fundo: #fcecec;
  --aviso-ok-fundo: #edf5ee;  --aviso-ok: #2e7d32;
  --raio: 12px;
  --fonte: "Nunito", system-ui, sans-serif;
}
[data-tema="escuro"] { --fundo:#121212; --card:#1e1e1e; --borda:#2c2c2c; --texto:#f2f2f2; --texto-secundario:#a0a0a0; }
```

### 9.13 Componentes
`CapaLoja` (capa + logo + idioma + tema), `StatusLoja`, `ModalInfoLoja`,
`AvisoFaixa`, `CardRepetirPedido`, `CarrosselDestaques`, `CardDestaque`,
`CabecalhoCategorias` (sticky + scroll-spy), `CardProduto`, `TelaBusca`,
`WizardProduto`, `CabecalhoGrupo` (selos "Falta N" e "n/máx", lupa),
`OpcaoRadio`, `OpcaoCheckbox`, `OpcaoQuantidade`, `CampoObservacao`,
`IndicadorEtapas`, `RodapeAcao` (quantidade + botão com total),
`TelaCarrinho`, `CardItemCarrinho`, `BottomSheetAviso`, `FormIdentificacao`,
`TelaCheckout`, `SeletorTipoPedido`, `CardEndereco`, `SeletorEndereco`,
`SeletorQuando`, `SeletorPagamento`, `CampoTroco`, `LinhaCupom`,
`ToggleCashback`, `ToggleResgatePontos`, `CampoCpfNota`, `ResumoValores`,
`TelaPix`, `TelaAcompanhamento`, `LinhaDoTempoStatus`,
`ModalVerificacaoWhatsApp`, `TelaHistorico`, `TelaDescontos`,
`CardFidelidade`, `ModalRegulamento`, `TelaPerfil`, `ListaEnderecos`,
`ModalLocalizacao`, `BarraInferior`, `EstadoVazio`.

## 9B. Cardápio de mesa (salão)

> Fontes: documentação da Suitable (seção 7), página de produto da Consumer
> e imagens públicas de cardápios em tablet (Goomer e outros) enviadas pelo
> usuário. Marcação: **[observado]** = visto nas imagens/doc;
> **[sugestão]** = padrão de mercado ou decisão nossa.
> Reproduzir estrutura e comportamento; visual e marca são da loja.

Mesmo cardápio do delivery (seção 2), filtrado pelos canais `AUTOATENDIMENTO`
(QR no celular) e `TABLET`. O que muda é o **contexto de mesa/comanda** e que
o pedido **não tem checkout de entrega**: vai direto para a cozinha e soma na
conta da mesa.

### 9B.1 Dois formatos

| | QR na mesa (celular do cliente) | Tablet fixo na mesa |
|---|---|---|
| Layout | Mesmo layout mobile do delivery (seção 9) | **Paisagem**, 3 colunas, botões grandes |
| Vínculo com a mesa | Pelo QR (URL com token da mesa) **[observado]** | Tablet vinculado à mesa; troca protegida por senha **[observado]** |
| Identificação | Nome (e opcional WhatsApp) | Não pede; opcional ler QR da comanda física **[observado]** |
| Pagamento | Pagar depois, Pix ou cartão integrado **[observado]** | Pedir a conta / pagar na maquininha **[sugestão]** |

### 9B.2 Tablet — estrutura da tela (paisagem) **[observado]**
- **Barra superior**: logo da loja · campo **Buscar** · **"Mesa 29"** ·
  seletor de **idioma** (bandeiras PT/EN/ES) · botões de ação à direita:
  **Chamar garçom**, **Chamar valet** (opcional), **Minha conta**,
  **Carrinho** (com indicador "Pedido vazio" / quantidade).
- **Trilho lateral esquerdo** (ícones): Destaques, grupos do cardápio,
  Ofertas; embaixo: **Sobre**, **Pontos**, **Avalie**, idiomas.
- **Coluna de categorias**: lista vertical (Entradas, Pratos, Bebidas…),
  selecionada destacada na cor da loja.
- **Área de conteúdo**:
  - **Banner da categoria**: foto larga com título e descrição.
  - **Linhas de produto**: foto à esquerda, nome em caixa alta/negrito,
    descrição, **preço antigo riscado + preço atual**, ícones de restrição
    (vegano, sem glúten, picante…), info extra (peso "600 g", **tempo de
    preparo "15 a 25 min"**), "Ver mais" e botão **"Adicionar"** na cor da loja.
- **Menu alternativo** (variações vistas): Cardápio, **Carta de vinhos**,
  **Avalie o local**, **Mural da casa** (novidades/eventos), Minha conta.
- **Tela de descanso**: após inatividade, hero em tela cheia com promoções
  em carrossel ("Especial da casa", "Experimente!") e CTA "Peça já" **[observado]**.
- Temas escuros e cores fortes da marca funcionam bem em salão (menos reflexo).

### 9B.3 Modo rodízio **[observado]**
Categoria/cardápio de rodízio: itens **sem preço**, mostrados por "Unidade",
botão "Adicionar ao carrinho". O valor é cobrado por pessoa na abertura da
mesa. **[sugestão]** limite de itens por rodada e intervalo mínimo entre
rodadas para evitar desperdício.

### 9B.4 Fluxo do pedido na mesa **[sugestão, padrão de mercado]**
1. **Abrir**: cliente lê o QR (ou senta à mesa com tablet). Se a loja usa
   comanda por pessoa (seção 5.2), pede o número da comanda ou lê o QR dela.
   Cobrança de entrada/couvert e rodízio entram aqui.
2. **Montar**: mesmo wizard de produto da seção 9.5 (grupos, observação).
3. **Carrinho**: itens + "Enviar para a cozinha" (sem endereço, sem pagamento).
   Confirmação: "Pedido enviado! Tempo estimado 20 min".
4. **Produção**: cada item vai para a impressora/KDS da sua categoria.
5. **Pedir mais**: rodadas ilimitadas, tudo soma na mesma conta.
6. **Acompanhar**: em "Minha conta", itens por rodada com status
   (Enviado → Em preparo → Servido).

### 9B.5 Minha conta (consumo) **[sugestão]**
- Lista de tudo que foi pedido na mesa/comanda, agrupado por rodada e por
  pessoa (quando comanda individual), com horário.
- Subtotal, **taxa de serviço (10%, opcional para o cliente)**, couvert,
  descontos, total.
- **Dividir a conta**: igualmente por N pessoas, por itens (cada um marca o
  que consumiu) ou valor livre.
- **Pagar**: Pix (QR na tela), cartão online, ou "Pedir a conta" (chama o
  garçom com a maquininha). Pagamento parcial abate do saldo da mesa.
- Fechamento só quando saldo = 0; ao fechar, oferecer avaliação e cadastro
  na fidelidade (pontos/cashback do pedido).

### 9B.6 Chamados **[observado + sugestão]**
- Botão **Chamar garçom** → alerta impresso e/ou no app do garçom
  **[observado]**. **[sugestão]** motivo opcional (dúvida, talheres, gelo,
  conta) e estado "Garçom a caminho" até alguém atender.
- **Chamar valet** (opcional, por loja) **[observado]**.
- **Avalie o local** (nota + comentário), alimenta Suit Ratings/avaliações.

### 9B.7 Segurança do QR **[sugestão]**
- QR com token rotativo por mesa (não só `/mesa/12`), para impedir pedidos
  de fora do restaurante.
- Opcional: primeiro pedido da mesa precisa ser liberado pelo garçom/caixa,
  ou a mesa precisa estar "aberta" no sistema.
- Pedido via QR sem pagamento antecipado fica vinculado ao nome + mesa.

### 9B.8 Modelo de dados adicional **[sugestão]**
```sql
create table mesa (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null, nome text not null, -- "Mesa 29"
  area text, lugares int,
  qr_token text unique not null, ativa boolean default true
);

create table conta_mesa (            -- a "sessão" da mesa, aberta até pagar
  id uuid primary key default gen_random_uuid(),
  mesa_id uuid references mesa, aberta_em timestamptz default now(),
  fechada_em timestamptz, pessoas int, rodizio_pessoas int,
  couvert numeric(10,2) default 0, taxa_servico_pct numeric(5,2) default 10,
  status text default 'ABERTA'       -- ABERTA | PEDIU_CONTA | FECHADA
);

create table comanda (               -- comanda individual (modo "por pessoa")
  id uuid primary key default gen_random_uuid(),
  conta_mesa_id uuid references conta_mesa, numero text, nome_cliente text,
  cliente_id uuid
);

-- pedido ganha: conta_mesa_id, comanda_id, rodada int, tablet_id

create table pagamento_mesa (
  id uuid primary key default gen_random_uuid(),
  conta_mesa_id uuid references conta_mesa, comanda_id uuid,
  forma_pagamento_id uuid, valor numeric(10,2), itens uuid[], -- divisão por itens
  status text, em timestamptz default now()
);

create table chamado (
  id uuid primary key default gen_random_uuid(),
  mesa_id uuid references mesa, tipo text,  -- GARCOM | CONTA | VALET
  motivo text, criado_em timestamptz default now(),
  atendido_por uuid, atendido_em timestamptz
);

create table tablet (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid, nome text, mesa_id uuid references mesa,
  codigo_login char(5), senha_troca_mesa text
);
```

### 9B.9 Componentes extras
`BarraSuperiorTablet`, `TrilhoLateral`, `ListaCategoriasVertical`,
`BannerCategoria`, `LinhaProdutoTablet` (preço riscado, ícones de restrição,
tempo de preparo, peso), `SeletorIdioma`, `TelaDescanso`, `BotaoChamarGarcom`,
`TelaMinhaConta`, `DivisaoConta`, `PagamentoMesa`, `ModoRodizio`,
`CartaDeVinhos`, `MuralDaCasa`, `AvalieLocal`.

## 9C. Tablet de mesa — definição do produto **[decisão]**

> Definido pelo dono do produto em 20/10/2026. Prevalece sobre 9B onde houver
> conflito. **[decisão]** = definido; **[sugestão]** = detalhe nosso a validar.

### 9C.1 Orientação
- Funciona em **horizontal e vertical**; a loja escolhe por tablet (ou
  segue a rotação do aparelho). **[decisão]**
- Horizontal: menu lateral fixo à esquerda + conteúdo + carrinho em aba à
  direita. Vertical: menu lateral recolhível (ícone ☰) ou categorias em
  faixa rolável no topo; carrinho abre como painel de baixo para cima.
  **[sugestão]**

### 9C.2 Tela principal (de cima para baixo) **[decisão]**
1. **Menu lateral** com as categorias.
2. **Banner de apresentação**: carrossel de **fotos e vídeos** passando
   automaticamente (vídeo sem som, em loop).
3. **Logo abaixo do banner: faixa de promoções do momento** — promoções do
   dia, **happy hour**, pratos do dia, o que a casa quer vender agora.
   - Cada bloco com horário de exibição (ex. happy hour 17h–20h some sozinho
     fora do horário) **[sugestão]**; usa disponibilidade por dia/horário
     (seção 2.1) e promoções (2.6).
4. **Lista de pratos** da categoria selecionada.

### 9C.3 Mídia dos pratos **[decisão]**
- Cada prato pode ter **foto e/ou vídeo**. O vídeo **toca direto no quadro
  pequeno** da lista (sem som, loop), sem precisar abrir.
- Tocar na foto/vídeo abre em **tela cheia**, com **zoom por pinça** na foto
  e galeria se houver várias mídias.
- **[sugestão]** técnica: vídeo curto (até ~10 s), comprimido (MP4/H.264 e
  WebM), com poster (imagem) enquanto carrega; tocar só os vídeos visíveis
  na tela (IntersectionObserver) para não travar o tablet; pré-carregar o
  cardápio e as mídias no aparelho (cache/Service Worker) para funcionar
  rápido mesmo com Wi-Fi ruim.

### 9C.4 Detalhe do prato **[decisão]**
Ao tocar no prato:
- mídia grande, nome, **descrição**, preço;
- **alergênicos** (ex. glúten, lactose, crustáceos, amendoim, ovo, soja,
  castanhas) com ícones;
- **nível de pimenta** (sem pimenta / leve / média / forte, ícone de pimenta
  1–3);
- complementos (seção 2.3) e **observações** em texto livre;
- quantidade e "Adicionar".
- **[sugestão]** etiquetas extras: vegano, vegetariano, sem glúten, sem
  lactose; filtro no topo "esconder pratos com…" para quem tem alergia.

**Selos da ficha técnica (vem do F2) [decisão]**
- Cada prato do cardápio fica **ligado à ficha técnica** do F2. Ao criar a
  ficha, os ingredientes já entram migrados. Em cada **ingrediente** marca-se:
  contém glúten, contém lactose, outros alergênicos (crustáceos, amendoim,
  ovo, soja, castanhas, peixe), nível de pimenta 0–3 e se é de origem animal.
- O **prato herda** isso sozinho: se 1 ingrediente tem glúten, o prato
  "Contém glúten". A pimenta do prato é o maior nível entre os ingredientes.
  Trocou o ingrediente na ficha, o selo muda em todos os canais.
- Na tela do cliente sempre aparece **o lado positivo e o negativo**:
  - verde com ✓: "Sem glúten", "Sem lactose", "Vegano";
  - amarelo com ⚠: "Contém glúten", "Contém lactose", "Contém crustáceos";
  - pimenta: 3 pimentinhas (0 = verde "Sem pimenta"; 1–3 = vermelho
    "Pimenta leve / média / forte") com uma frase curta;
  - "Ver ingredientes" abre a lista da ficha, destacando os alergênicos.
- **Atenção (contaminação cruzada):** "Sem glúten" quer dizer que nenhum
  ingrediente tem glúten, não que a cozinha é livre de glúten. A ficha deve
  ter o campo "pode conter traços de…", que aparece embaixo dos
  ingredientes com "Alergia grave? Fale com o garçom". O F2 bloqueia o selo
  "Sem X" se faltar marcar algum ingrediente (sem dado = não mostra selo).
- **Tempo de preparo:** a ficha guarda o tempo base (ex. 10 min). A tela
  mostra "Pronto em 10 a 15 min", somando a fila atual da estação no KDS
  (9D): "Cozinha tranquila agora" ou "Cozinha cheia, +10 min".
- Os mesmos selos aparecem pequenos no card da lista e servem de filtro
  ("Sem glúten", "Sem lactose", "Sem pimenta").
- Tabelas: `ingrediente (contem_gluten, contem_lactose, alergenos[],
  nivel_pimenta, origem_animal)`, `ficha_tecnica (produto_id,
  tempo_preparo_min, pode_conter_tracos[])`, `ficha_item (ficha_id,
  ingrediente_id, quantidade, unidade)`. Os selos são calculados (view ou
  cache atualizado quando a ficha muda).

**Foto que vende (revisão) [decisão]**
- A foto **não ocupa metade da tela**: fica numa coluna à esquerda
  (~430×320 px no tablet horizontal), com zoom lento e botão "Ampliar"
  para tela cheia. As opções ficam visíveis sem rolar.
- Sempre **foto real do prato**, de perto, bem iluminada. Sem foto, o prato
  não ganha destaque (o painel avisa "prato sem foto").
- Selos sobre a foto: "Mais pedido da casa" (automático, top 3 de vendas
  da semana), "★ nota · N avaliações" (só se tiver ≥ 10 avaliações),
  "Novo" (até 30 dias).
- Miniaturas embaixo: até 3 fotos + 1 vídeo do preparo.
- **"Combina com"** embaixo da foto: 2 cards (bebida que harmoniza e o
  acompanhamento mais pedido junto), com "+ Adicionar" que soma ao total
  do botão. Vem das regras de sugestão (9P) e nunca bloqueia o pedido.
- Do lado direito: nome, "a partir de R$", descrição curta, três
  caixinhas (Contém · Pimenta · Preparo em minutos), grupos de
  complemento com status "✓ Ok" / "1 / 2", observação e o rodapé fixo
  (Aqui/Viagem, quantidade, "Adicionar ao pedido · R$ total").

### 9C.5 Carrinho em aba lateral **[decisão]**
**Revisão:** o carrinho abre **por cima** do cardápio, como um painel
flutuante à direita (cerca de 430 px, cantos arredondados, sombra forte),
com **fundo amarelo claro** (`#FFF8E1`, cabeçalho `#FFF0C2`, borda
`#F2DDA6`). O cardápio por trás fica **desfocado e escurecido**
(blur ~7 px + véu de 30%), para o cliente focar só no pedido. Fecha pelo X,
por "Continuar escolhendo" ou tocando fora. Fechado, vira um botão flutuante
"Ver meu pedido · N itens · R$ total" no canto. Itens com rolagem; subtotal
e "Enviar para a cozinha" ficam fixos embaixo.

- Fluxo: **cardápio sem carrinho** → toca no prato → **detalhe do prato**
  (escolhas, observação) → "Adicionar ao pedido" → volta ao cardápio com a
  **aba do carrinho aberta**.
- A aba **só aparece depois do primeiro item**; se o cliente excluir todos, ela
  some de novo.
- Cada item no carrinho tem **– quantidade +** e botão **Excluir** (diminuir
  abaixo de 1 também remove).
- **Cada item escolhe: "Consumir aqui" ou "Para viagem"** — dá para ter itens
  dos dois tipos no mesmo pedido.
- Botão **"Enviar para a cozinha"** → confirmação "Seu pedido foi enviado
  para a cozinha".
- **[sugestão]** "Para viagem" sai com embalagem: impressão/etiqueta marca
  VIAGEM, e o KDS mostra o item destacado; pode cobrar taxa de embalagem.

### 9C.6 Acompanhamento no tablet (estilo painel de fast-food) **[decisão]**
Depois de enviado, o cliente vê o status de cada pedido, atualizado na hora
pelo KDS:
`Na fila` → `Em preparação` → `Pronto`.
- **Por item/estação**: um pedido com prato e drinks mostra separado, ex.
  "Drinks: Pronto · Prato: Em preparação". **[decisão]**
- Aviso visual (e som curto) quando algo fica pronto. **[sugestão]**
- Posição na fila / tempo estimado ("2 pedidos na sua frente · ~12 min").
  **[sugestão]**

## 9E. Cadastro na mesa e sessão temporária **[decisão]**

### 9E.1 Onde vale
- O cardápio de mesa funciona no **tablet** e, onde não houver tablet, pelo
  **QR Code da mesa** no celular do cliente (mesmo cardápio, layout mobile).
  **[decisão]**

### 9E.2 Convite ao entrar **[decisão]**
- O tablet **abre direto no cardápio, pronto para pedir** (não obriga
  cadastro). No topo do cardápio fica a faixa **"Quer ganhar 10% de desconto em
  todos os pratos? Clique aqui"**, que abre a tela de CPF/cadastro
  ("Faça parte do nosso mundo"). **[decisão]**
- Na tela de CPF, a opção de **recusar é um botão grande** ("Não, obrigado ·
  quero só pedir"), tão visível quanto o de entrar, para ninguém se sentir
  obrigado. **[decisão]**
- Tela inicial: **"Já tem conta? Entre com seu CPF"** (campo grande + teclado
  numérico no tablet) → entrou, já aparecem os dados dele. **[decisão]**
- Outras saídas: **Cadastre-se** (formulário) e **Agora não** (cardápio sem
  desconto). **[decisão]**
- **Segurança [sugestão]**: CPF sozinho basta para aplicar os 10% e somar
  pontos. Para **resgatar pontos/cashback** ou ver/editar dados pessoais, pedir
  uma confirmação extra (data de nascimento ou código no WhatsApp), porque CPF
  não é segredo e outra pessoa poderia usar.
- O convite pode reaparecer no carrinho antes de enviar ("Quer 10% neste
  pedido?"). **[sugestão]**

### 9E.3 Campos do cadastro **[decisão]**
Nome completo · CPF · data de nascimento · estado (UF) · município · bairro
(onde mora) · **WhatsApp**. **Todos os campos são obrigatórios.** **[decisão]**
O consentimento para receber promoções no WhatsApp continua separado (LGPD):
o número é obrigatório para o cadastro, mas a promoção só vai para quem marcou
o aceite.
- CPF validado (dígitos verificadores) e **único**: CPF já cadastrado → oferece
  "Já tenho cadastro". **[sugestão]**
- UF e município em listas (IBGE), município filtrado pela UF. **[sugestão]**
- **LGPD [sugestão, obrigatório na prática]**: caixa de consentimento com
  finalidade (desconto, pontos, comunicações) e link da política de
  privacidade; consentimento de marketing separado e opcional; registrar data
  e versão do aceite; teclado/formulário nunca autocompleta dados de outro
  cliente.

### 9E.4 Benefícios **[decisão]**
- **10% de desconto em todos os pratos** do pedido do cliente identificado
  (CPF). **[decisão]** **[a confirmar]** se vale em toda visita ou só na
  primeira (configurável: `desconto_cadastro_modo` = `SEMPRE` |
  `PRIMEIRO_PEDIDO`; padrão `SEMPRE`).
- **Pontos: R$ 1 = 1 ponto**, no salão e no delivery (seção 6.3), creditados
  após o pagamento.
- **[a confirmar]** desconto de 10% acumula com cupom/promoção?

### 9E.5 Sessão temporária — "desfazer" para o próximo cliente **[decisão + sugestão]**
O cliente **não fica logado**. O tablet é compartilhado, então a sessão do
cliente é curta e se apaga sozinha:
- **Tablet**: a sessão (cliente identificado + carrinho) é ligada ao pedido.
  Encerra quando:
  1. **pedido enviado** → tela "Pedido enviado! Obrigado, Fulano" com o
     DESCONTO e os pontos, por **~6 segundos (só o tempo de ler), sem botão**,
     e volta **sozinha** ao cardápio inicial **sem cliente**. **[decisão]**
     - Na tela inicial fica um card **"Pedido #48 · Mesa 12"** com o status por
       estação (Drinks: Pronto · Pratos: Em preparação), **sem nome nem dados**
       do cliente. Quando tudo fica pronto/entregue, o card **some**.
     - O tablet já está pronto para a próxima pessoa. Para pedir de novo, o
       cliente entra de novo com o CPF (para ter o DESCONTO) ou pede direto.
  2. **inatividade** (ex. 3 min sem toque com carrinho vazio) → limpa;
  3. **conta da mesa fechada** no caixa → tablet volta à tela inicial.
- **QR no celular**: sessão guardada só naquela aba (`sessionStorage`), expira
  quando a conta da mesa fecha ou após X horas; nada de login persistente.
- Botão **"Não sou eu / Sair"** sempre visível enquanto há cliente na sessão.
- Na tela, mostrar só o primeiro nome; nunca exibir CPF completo
  (`***.456.789-**`).
- **Técnico [sugestão]**: o servidor cria `sessao_mesa` com token curto
  (expira); o front guarda só o token; o pedido grava `cliente_id`; ao encerrar,
  o token é invalidado no servidor e o front limpa memória/armazenamento.

### 9E.6 Modelo de dados adicional **[sugestão]**
```sql
alter table cliente add column cpf text unique,
  add column data_nascimento date,
  add column uf char(2), add column municipio_ibge int, add column bairro text,
  add column origem_cadastro text,            -- TABLET | QR_MESA | DELIVERY | PDV
  add column consentimento_em timestamptz, add column consentimento_versao text,
  add column aceita_marketing boolean default false;

create table sessao_mesa (
  id uuid primary key default gen_random_uuid(),
  mesa_id uuid references mesa, tablet_id uuid, cliente_id uuid,
  token text unique not null, criada_em timestamptz default now(),
  expira_em timestamptz not null, encerrada_em timestamptz,
  motivo_encerramento text                    -- PEDIDO_ENVIADO | INATIVIDADE | CONTA_FECHADA | SAIR
);
-- pedido ganha: sessao_mesa_id, desconto_cadastro numeric(10,2)
```

## 9G. Nossa história **[decisão]**
- Item **"Nossa história"** no menu lateral do tablet (e no QR).
- Carrossel de capítulos **por ano**: foto grande, ano em destaque, título e
  texto da história embaixo/ao lado; setas anterior/próximo, deslizar com o
  dedo, e **linha do tempo** com os anos para pular direto.
- Conteúdo cadastrado no painel pelo dono. **[sugestão]** aceitar vídeo curto
  no lugar da foto; textos entram na tradução (9F).
```sql
create table historia_capitulo (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null, ano text not null,    -- texto para aceitar "Hoje"
  rotulo text, titulo text not null, texto text not null,
  midia_url text, midia_tipo text default 'FOTO', ordem int default 0, ativo boolean default true
);
```

## 9H. Menu degustação **[decisão]**
Problema: todos os preparos chegam juntos e o cliente se perde. Solução no
tablet/QR, item **"Menu degustação"** no menu lateral:
- **Foto clicável [decisão]**: uma **foto real do menu servido** com **pontos
  numerados em cima de cada preparo**. Tocar no ponto (ou no prato) mostra o
  que é, como comer e com o que harmoniza. A montagem na mesa pode variar um
  pouco; a foto serve para o cliente **reconhecer pela aparência**.
  - Pratos principais com números na ordem de comer (1, 2, 3…); molhos,
    farinhas e acompanhamentos com letras (A, B, C…) em cor diferente.
  - Ponto selecionado aumenta e pulsa; os demais continuam visíveis.
  - **Painel do dono**: sobe a foto, toca em cima de cada preparo para criar o
    ponto (grava `pos_x`/`pos_y` em %) e liga o ponto ao passo cadastrado.
    Arrastar para ajustar. **[sugestão]**
  - Se o tamanho da tela mudar, os pontos ficam no lugar certo porque a
    posição é em % da foto (manter a mesma proporção, ex. quadrada).
- **Ordem sugerida** 1 → N (botões numerados).
- **Detalhe de cada passo**: foto, nome, **o que é**, **como comer** (passos
  curtos e numerados, ex. "quebre a gema e misture", "coloque sobre o pão do
  passo 1"), **combina com** (bebida/harmonização) e **alergênicos**.
- Botões **Anterior / Próximo: [nome do próximo]**; no último, "Bom apetite!".
- **[sugestão]** o garçom pode abrir esta tela ao servir; o KDS/expedição usa a
  mesma posição numerada para montar a tábua igual sempre; versão impressa em
  um cartão com o mesmo mapa.
```sql
create table degustacao (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null, produto_id uuid references produto, -- o produto vendido "Menu degustação"
  nome text not null, descricao text, foto_referencia_url text  -- foto real do menu servido (pontos ficam sobre ela)
);
create table degustacao_passo (
  id uuid primary key default gen_random_uuid(),
  degustacao_id uuid references degustacao, ordem int not null,
  tipo text default 'PASSO',               -- PASSO (número) | ACOMPANHAMENTO (letra)
  rotulo text,                             -- '1', '2'… ou 'A', 'B'…
  nome text not null, nome_curto text, o_que_e text, como_comer text[],
  combina_com text, alergenos text[], foto_url text,
  pos_x numeric(5,2), pos_y numeric(5,2)   -- posição do ponto na foto, em % (0–100)
);
```

## 9F. Idiomas **[decisão]**

- Botão **"Idioma"** sempre visível (tablet, QR e delivery) abre o seletor.
- Idiomas: **Português, Inglês, Espanhol, Italiano, Francês, Chinês
  (mandarim, simplificado), Japonês e Coreano**.
- Traduz o **cardápio por completo**: categorias, nomes e descrições dos
  pratos, complementos, alergênicos, promoções/banners com texto, botões e
  mensagens da interface. Preços continuam em R$.
- Cada idioma aparece no próprio nome (English, Español, 中文, 日本語, 한국어)
  para o estrangeiro se reconhecer.
- **[sugestão] implementação**:
  - Textos da interface em arquivos de tradução (i18n, ex. `pt-BR.json`,
    `en.json`…).
  - Textos do cardápio cadastrados pelo restaurante: tabela de traduções por
    campo; ao salvar um prato em português, o sistema gera as traduções
    automaticamente (API de tradução/IA) e marca como "revisar"; o dono pode
    corrigir no painel.
  - Prato sem tradução cai para o português (nunca fica em branco).
  - Fontes com suporte a chinês, japonês e coreano (ex. Noto Sans SC/JP/KR).
  - O idioma escolhido vale só para a sessão; volta ao português quando a
    sessão do tablet encerra (9E.5).
- Modelo:
```sql
create table traducao (
  entidade text not null,        -- 'categoria' | 'produto' | 'grupo' | 'item' | 'banner' ...
  entidade_id uuid not null,
  campo text not null,           -- 'nome' | 'descricao' ...
  idioma text not null,          -- 'en' | 'es' | 'it' | 'fr' | 'zh-CN' | 'ja' | 'ko'
  texto text not null,
  origem text default 'AUTO',    -- AUTO | MANUAL
  revisado boolean default false,
  primary key (entidade, entidade_id, campo, idioma)
);
```

## 9D. KDS — tela da cozinha e do bar **[decisão]**

Sistema próprio, ligado ao mesmo banco: o pedido enviado pelo tablet (ou QR,
garçom, PDV, delivery) aparece na hora na tela da estação certa.

### 9D.1 Estações **[decisão + sugestão]**
- Cada categoria/produto tem uma **estação de produção**: Cozinha, Bar
  (drinks), Sobremesas, Chapa… (substitui ou complementa a "impressora" da
  seção 2.1).
- Um pedido com itens de estações diferentes é **dividido**: cada KDS vê só
  os seus itens; o cliente vê o status de cada parte.

### 9D.2 Tela do KDS **[sugestão, padrão de mercado]**
- Colunas ou cards por pedido em ordem de chegada: número, **mesa** (ou
  "Delivery #123", "Balcão"), canal, hora, **cronômetro** desde a chegada
  (verde → amarelo → vermelho conforme o tempo).
- Itens com quantidade, complementos, **"SEM X"**, observação em destaque,
  **etiqueta por item: VIAGEM ou NO LOCAL** **[decisão]**, **alerta de alergia** quando o cliente marcou.
- Toque no card/item: **Iniciar preparo** → **Pronto** (dar baixa).
  Pronto some da tela e vai para o histórico ("Desfazer" por alguns segundos).
- Som ao chegar pedido novo; modo tela cheia; filtros por estação e canal.
- **Expedição** (opcional): tela que junta as partes prontas do pedido para
  o garçom/runner levar à mesa.
- Funciona em TV/tablet com navegador; reconecta sozinho se cair a rede.

### 9D.2.1 Pronto = imprime comanda de entrega **[decisão]**
- Ao tocar **"Pronto"**, o sistema **imprime uma comanda na impressora da
  própria estação** com: número do pedido, **mesa** (ou Delivery/Balcão),
  itens prontos com quantidade, complementos e etiqueta NO LOCAL/VIAGEM, e
  hora. A cozinha entrega o papel ao garçom, que leva o prato à mesa.
- Card em "Prontos" mostra "Comanda impressa às HH:MM" e botão
  **"Reimprimir comanda"**.
- **[sugestão]** cadastro: `estacao.impressora_id`; fila de impressão com
  reenvio se a impressora estiver offline e aviso no KDS.

### 9D.2.2 Atraso e prioridade **[decisão]**
- Cada estação tem um **prazo** (ex. 15 min). Passou do prazo, o pedido vira
  **PRIORIDADE** automaticamente (faixa vermelha "PRIORIDADE N · Atrasado há
  X min").
- O card **pisca em vermelho** de leve; **a cada 5 min de atraso a piscada
  fica mais rápida** (níveis: 0–5 min, 5–10, 10–15, 15+).
- Prioridades vão para o **topo da coluna**. Com várias prioridades, a
  **mais antiga vem primeiro** (PRIORIDADE 1 = maior tempo esperando) e deve
  ser enviada antes das outras.
- Contador "Prioridades N" no topo do KDS.
- **[sugestão]** som de alerta ao virar prioridade; o garçom/gerente recebe
  aviso; registrar atrasos para o relatório de tempo de preparo.

### 9D.3 Status e sincronização **[decisão]**
| Ação no KDS | Status do item | Cliente vê no tablet |
|---|---|---|
| Chegou | `NA_FILA` | Na fila de espera |
| Iniciar preparo | `EM_PREPARO` | Em preparação |
| Pronto | `PRONTO` | Pronto |
| Garçom entregou (opcional) | `ENTREGUE` | Entregue |

- Status do **pedido** = derivado dos itens (todos prontos → pedido pronto).
- Tempo real por **WebSocket/SSE** ou realtime do banco (ex. Supabase
  Realtime) — tablet, KDS e app do garçom assinam o mesmo pedido.
  **[sugestão]**
- Delivery usa o mesmo fluxo e, quando pronto, segue para "Saiu para
  entrega" (seção 9.7.3).

### 9D.4 Modelo de dados adicional **[sugestão]**
```sql
create table estacao (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null, nome text not null,    -- Cozinha, Bar, Sobremesas
  tempo_alerta_min int default 15
);
alter table categoria add column estacao_id uuid references estacao;
alter table produto   add column estacao_id uuid references estacao; -- sobrepõe a da categoria

-- Mídia e informações do prato
create table produto_midia (
  id uuid primary key default gen_random_uuid(),
  produto_id uuid references produto, tipo text not null, -- FOTO | VIDEO
  url text not null, poster_url text, ordem int default 0
);
alter table produto add column alergenos text[] default '{}',   -- GLUTEN, LACTOSE, CRUSTACEOS...
                    add column nivel_pimenta smallint default 0, -- 0 a 3
                    add column etiquetas text[] default '{}',   -- VEGANO, VEGETARIANO...
                    add column tempo_preparo_min int;

-- Promoções/blocos do momento no tablet
create table vitrine_bloco (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid, titulo text,                    -- "Happy hour", "Pratos do dia"
  produtos uuid[], dias_semana smallint[], inicio time, fim time,
  canais canal[], ordem int default 0, ativo boolean default true
);
create table banner (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid, tipo text,                      -- FOTO | VIDEO
  url text, link_produto_id uuid, canais canal[], ordem int, ativo boolean
);

-- Item do pedido: consumo e produção
alter table pedido_item add column consumo text default 'LOCAL', -- LOCAL | VIAGEM
                        add column estacao_id uuid,
                        add column status text default 'NA_FILA', -- NA_FILA | EM_PREPARO | PRONTO | ENTREGUE | CANCELADO
                        add column iniciado_em timestamptz,
                        add column pronto_em timestamptz;
```

### 9D.5 Componentes
Tablet: `MenuLateral`, `BannerMidia` (foto/vídeo), `FaixaPromocoes`,
`CardPratoMidia` (vídeo no quadro), `VisualizadorMidia` (tela cheia + zoom),
`SeloAlergenos`, `IndicadorPimenta`, `AbaCarrinho`, `SeletorConsumo`
(aqui/viagem), `PainelStatusPedido`.
KDS: `QuadroKDS`, `CardPedidoKDS`, `CronometroPedido`, `FiltroEstacao`,
`TelaExpedicao`.

## 9I. Recomendações no tablet e no QR **[decisão]**
- Botão **"Recomendações · O que você quer hoje?"** em destaque no topo do
  menu lateral.
- Saudação: cliente identificado → "Olá, {primeiro_nome}! Que bom te ver por
  aqui."; sem cadastro → "Olá! Seja bem-vindo." (textos editáveis).
- Pergunta inicial: **"Qual experiência você está buscando hoje?"** com
  opções em cards com foto (ex. Explorar a Amazônia, Um bom peixe, Camarão,
  Carne na brasa, Algo leve, Surpreenda-me).
- Cada opção leva a **outra pergunta** (ex. peixe → assado, cozido, frito) ou
  ao **resultado**: prato sugerido com foto, descrição, preço, "porque você
  escolheu…", e botões **Quero este** (abre o detalhe do prato), **Outra
  sugestão** (próximo prato da lista) e **ver cardápio completo**.
- Barra de progresso e "Recomeçar". Pratos esgotados são pulados.

**Fluxo completo (revisão) [decisão]** — a **mesma árvore** serve tablet,
QR da mesa, delivery e retirada; só muda o layout (tablet horizontal ×
celular) e o botão final ("Adicionar ao pedido" × "Adicionar à sacola").
1. **Experiência** (cards com ícone ou foto) → 2. **detalhe** quando a opção
   tem sub-pergunta → 3. **Alguma restrição?** (sem glúten, sem lactose, sem
   crustáceos, sem pimenta, vegetariano, multi-escolha; filtra pelos selos
   da ficha técnica, 9C.4) → 4. **Quantas pessoas?** (1, 2, 3–4, 5+) →
   5. **Sugestão**.
- Na sugestão: foto, selo "Nossa sugestão", tempo (mesa: "Pronto em";
  entrega: "Chega em"; retirada: "Pronto para retirar em"), selos de
  alergia/pimenta, "porque você escolheu", **quantidade certa** (prato que
  serve 2 para 4 pessoas → 2 porções), **"Combina com"** (regras da 9P, botão
  + soma no total), até 2 **outras opções** e botão com o total.
- Se nenhum prato da linha passa nas restrições, mostra os que passam com o
  aviso "Nenhum prato dessa linha atende às suas restrições".
- Cliente identificado: botão "Pedir de novo seu favorito" na primeira tela;
  restrições ficam salvas no cadastro; pratos que ele avaliou mal ficam de
  fora ("Tiramos o X: você não curtiu da última vez").
- "Voltar" volta uma pergunta; "Recomeçar" zera. No delivery, a entrada é o
  botão "Me ajuda a escolher" na fileira de categorias.
- **Painel → Recomendações**: árvore de perguntas, opções e pratos, editável
  (título, subtítulo, foto, "ao tocar: outra pergunta | mostrar pratos").
```sql
create table recomendacao_no (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid not null, pai_id uuid references recomendacao_no,
  tipo text not null,                 -- PERGUNTA | OPCAO
  texto text not null, subtitulo text, foto_url text, ordem int default 0,
  produtos uuid[]                      -- só em OPCAO final: pratos sugeridos, em ordem
);
-- pedido_item ganha: origem text  -- CATEGORIA | RECOMENDACAO | PROMOCAO | BUSCA | REPETIR | DEGUSTACAO | CAMPANHA
```

## 9J. Wi-Fi **[decisão]**
- Botão **Wi-Fi** no menu lateral do tablet (ao lado de Idioma) abre um
  **QR Code grande** para o cliente conectar o celular, com nome da rede e
  senha por extenso.
- QR no padrão `WIFI:T:WPA;S:<rede>;P:<senha>;;`, gerado a partir de
  Configurações (rede e senha da rede de clientes). **[sugestão]** usar uma
  rede separada da rede do caixa/sistema.

## 9K. Painel do restaurante **[decisão]**
Menu do painel: Dashboard · Clientes (CRM) · Campanhas WhatsApp · Cardápio ·
Promoções e descontos · Recomendações · Menu degustação · Vitrine e banners ·
Nossa história · Idiomas · Configurações.

### 9K.1 Cardápio
- Categorias (arrastar para ordenar) e lista de produtos com foto, preço,
  promoção ativa, **liga/desliga por canal** (Tablet, QR, Delivery) e
  **"Esgotado hoje"**: tira o prato de todos os canais na hora e volta
  sozinho no dia seguinte. **[decisão]**
- Editar produto: fotos e vídeo (capa, ordenar), nome, descrição, categoria,
  preço, estação do KDS, tempo de preparo, alergênicos, pimenta, etiquetas,
  grupos de adicionais (reutilizáveis, com esgotado por item), onde aparece e
  horários, traduções (automática + revisar) e **prévia** de como fica no
  tablet e no delivery.

### 9K.2 Promoções e descontos
Tipos: desconto %, desconto R$, preço fixo, **pegue 1, leve 2** (e variações
pegue 2 leve 3 etc.), combo, frete grátis.
Aplica em produtos/categorias; dias e horários (ex. happy hour seg–sex
17h–20h); canais; "mostrar em Agora na casa"; "acumula com os 10% de
cadastro". Lista mostra o que está **no ar agora**.

### 9K.3 Dashboard por canal **[decisão]**
Abas **Geral · Mesa · Delivery · Balcão**, cada uma com seus números:
pedidos, faturamento, ticket médio, novos cadastros, tempo de preparo/entrega;
**por onde os clientes chegam ao prato** (categorias, recomendações,
promoções, busca, repetir pedido, degustação, campanha) — vem de
`pedido_item.origem`; **cadastro hoje** (novos, entraram com CPF, pediram sem
cadastro, desconto concedido); pratos mais pedidos; pedidos por horário.

### 9K.4 CRM — perfil do cliente **[decisão]**
- Lista com busca (nome, CPF, WhatsApp) e filtros (frequentes, sumidos 30+
  dias, aniversário no mês, só delivery).
- Perfil: contato, aniversário, bairro, canais que usa, aceite de promoções,
  visitas, ticket médio, total gasto, pontos, última visita.
- **O que costuma pedir em cada dia da semana** (ex. "terça: Tacacá, 5 de 6
  terças").
- **Mais pedidos**, **gostou** (avaliação 4–5), **não gostou** (avaliação
  1–2 ou reclamação) e **nunca pediu** (oportunidade, botão "Oferecer").
- De onde vem "gostou/não gostou": avaliação por prato pedida no tablet ao
  fechar a conta e no WhatsApp 1 h depois do pedido (campanha "Como foi seu
  pedido?"). **[sugestão]**
```sql
create table avaliacao_item (
  id uuid primary key default gen_random_uuid(),
  pedido_item_id uuid references pedido_item, cliente_id uuid,
  nota smallint check (nota between 1 and 5), comentario text,
  canal text, criada_em timestamptz default now()
);
-- "costuma pedir no dia X" = consulta sobre pedido_item + pedido.criado_em (extract(dow))
```

### 9K.5 Campanhas automáticas no WhatsApp **[decisão]**
- Exemplo: **"Toda terça, Tacacá com 20%"** enviada às 11h **só para quem já
  pediu Tacacá** (e não avaliou mal), com a mensagem personalizada: "Oi,
  {primeiro_nome}, tudo bom? Hoje é terça e o {prato} que você pediu da última
  vez está com {desconto} de desconto…" + foto + botões "Pedir agora" (link
  com o desconto aplicado) e "Ver o cardápio".
- Gatilhos: dia/horário fixo, aniversário, cliente sumido há N dias, depois do
  pedido (pedir avaliação).
- Público por filtros (pediu o produto X, canal, frequência, bairro…); mostra
  quantos vão receber; limite de 1 promoção por semana por cliente.
- Métricas: enviadas, lidas, pedidos gerados (pelo link com código da
  campanha).
- **Obrigatório na prática [sugestão]**: API oficial do WhatsApp (Cloud API /
  provedor BSP) com **modelos aprovados pela Meta**; só envia para quem deu
  **aceite de marketing**; responder "PARAR" descadastra na hora.
```sql
create table campanha (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid, nome text, gatilho text,     -- AGENDADA | ANIVERSARIO | SUMIDO | POS_PEDIDO
  agenda text,                                -- ex. cron 'ter 11:00'
  filtro jsonb, promocao_id uuid, modelo_whatsapp text,
  ativa boolean default true
);
create table campanha_envio (
  campanha_id uuid references campanha, cliente_id uuid,
  enviada_em timestamptz, lida_em timestamptz, pedido_id uuid
);
```

### 9K.6 Disparos manuais no WhatsApp **[decisão]**
- Painel → **Disparos WhatsApp**: selecionar clientes (filtros do CRM,
  "selecionar todos"), em quantidade (100, 200… de uma vez).
- Tocar no cliente abre o **histórico**: pratos que mais pede, dias em que
  costuma vir, último pedido, e o que **ele** vai receber.
- A mensagem usa um modelo aprovado e é **personalizada por cliente**: nome +
  **os pratos favoritos dele em carrossel com foto** + botão "Pedir agora" com
  o desconto aplicado.
- Antes de enviar: quantos selecionados, quantos **sem aceite** (não recebem),
  **custo estimado** (custo por mensagem em Configurações), enviar agora ou
  agendar. Envio em lotes para não bloquear o número.
- O sistema liga o WhatsApp da empresa (número oficial conectado em
  Configurações) ao WhatsApp cadastrado de cada cliente.
- **Resultado** (Painel → Disparos → Ver resultados) por **Dia · Semana · Mês
  · Ano** e data: custo, faturamento gerado, retorno (R$ por R$ 1 gasto),
  custo por pedido, funil **enviadas → entregues → lidas → entraram em contato
  → fizeram pedido**, e lista de disparos com custo e faturamento de cada um.
- Atribuição **[sugestão]**: pedido conta para o disparo se feito em até 48 h
  pelo link do disparo (código no link) ou pelo mesmo WhatsApp; "entrou em
  contato" = respondeu ou tocou num botão (webhook da API).
```sql
create table disparo (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid, nome text, modelo_whatsapp text, mensagem text,
  agendado_para timestamptz, enviado_em timestamptz,
  custo_unitario numeric(10,4), criado_por uuid
);
create table disparo_envio (
  disparo_id uuid references disparo, cliente_id uuid,
  status text,                    -- ENVIADA | ENTREGUE | LIDA | FALHOU
  respondeu_em timestamptz, pedido_id uuid, valor_pedido numeric(10,2),
  custo numeric(10,4),
  primary key (disparo_id, cliente_id)
);
```

## 9L. Regra de cores **[decisão]**
- Cor principal: **verde escuro** (padrão `#14532D`, configurável pela loja).
  Nada de marrom.
- **Fundo escuro → texto branco, sempre.** Nunca texto escuro sobre fundo
  escuro (inclui botões, chips selecionados, abas, selos e cards na cor
  principal).
- Fundo claro de seleção: verde bem claro (`#EAF4EE`) com texto escuro.
- Checar contraste mínimo 4,5:1 em todo texto (WCAG AA); ter um teste
  automático que falha o build se um componente usar a cor principal como
  fundo sem `color: #FFFFFF`. **[sugestão]**
- **Neutros só em cinza, nada de preto ou marrom.** **[decisão]**
  - Cinza claro (`#CFCFCF`–`#DADADA`): espaço reservado de foto pequena
    (miniaturas de prato, promoções, carrinho).
  - Cinza escuro (`#4A4A4A`–`#5A5A5A`): banner, fundo de foto com texto
    branco por cima, botões secundários e marcadores (ex.: letras dos
    molhos no menu degustação).
  - Faixa por cima de foto/vídeo: `rgba(55,55,55,.78)` com texto branco.
  - Bordas e divisórias: cinza neutro (`#E3E3E3`, `#DADADA`), sem bege.
  - Preto (`#1A1A1A`) fica só como **cor de texto** em fundo claro.
- **Profundidade (tokens) [decisão]**
  - Card: `0 1px 2px rgba(16,24,20,.05), 0 6px 18px rgba(16,24,20,.07)`,
    borda `#EEEEEE`.
  - Botão principal (verde): sombra verde `0 1px 2px rgba(12,51,28,.28),
    0 6px 14px rgba(20,83,45,.22)`, brilho interno no topo e leve degradê.
  - Botão secundário: fundo branco, borda `#E3E3E3`, sombra curta.
  - Voltar e fechar: **redondos**, brancos, com borda e sombra.
  - Ao tocar, o botão afunda 1 px. Cantos mínimos de 12 px nos botões
    grandes.
  - Banner de destaque: degradê verde com círculos que flutuam devagar e um
    brilho que passa (desligado em "reduzir movimento").

## 9M. Palavra "DESCONTO" **[decisão]**
- Em toda tela do cliente (tablet, QR, delivery, checkout, WhatsApp), quando
  houver desconto, aparece a palavra **DESCONTO** junto do valor: **em
  maiúsculo, negrito e um pouco maior** que o texto ao redor (ex. "10% de
  **DESCONTO** em todos os pratos", "Entrar e ganhar 10% de **DESCONTO**",
  linha "**DESCONTO** −R$ 11,09" no resumo). Nunca "off".
- Componente único `<SeloDesconto valor="10%">` para manter o padrão; nas
  traduções a palavra também vai em maiúsculo (DISCOUNT, DESCUENTO, SCONTO,
  RÉDUCTION, 折扣, 割引, 할인).

## 9F.1 Confirmar idioma **[decisão]**
- No seletor de idioma, o cliente toca no idioma e depois em **Confirmar**
  (o idioma só muda ao confirmar). Os botões **Confirmar / Cancelar** já
  aparecem escritos no idioma selecionado (Confirm, Conferma, Confirmer,
  确认, 確認, 확인…).

## 9N. Fidelidade (gamificação): pontos, cashback e cartão de selos **[decisão]**

### 9N.1 Pontos e cashback
- **R$ 1 = 1 ponto**; **100 pontos = R$ 2,00 de CASHBACK** (valores
  configuráveis no painel — ex. pode ser R$ 3,00).
- **Mesmo CPF soma em todos os canais**: mesa (tablet/QR), delivery e balcão.
- Pontos entram depois do pagamento; validade configurável (ex. 12 meses);
  pedidos de marketplaces não contam.
- Cliente vê saldo em pontos e em R$ de cashback, e usa no próximo pedido
  (checkout, seção 9.7.1).

### 9N.2 Cartão de selos virtual
- Exemplo: **"Compre 6 Tacacás e ganhe 1"**. Cada compra do produto = 1 selo,
  **preenchido automaticamente** em qualquer canal (mesa, delivery, balcão).
- O cliente vê o cartão com os **selos que já tem e os que faltam** (animação
  de "carimbo" quando ganha um selo) e "Faltam 2 selos".
- Ao completar: mensagem **"Parabéns, você ganhou 1 Tacacá"** com **código
  único** (ex. `TCK-7F3Q`) e **prazo de 30 dias** para retirar. Também enviar
  o código no WhatsApp. **[sugestão]**
- Cartão novo começa automaticamente depois de completar.
- **Painel → Fidelidade e selos**: criar cartões (produto ou categoria que
  conta, nº de selos, prêmio, prazo, canais, aparecer no banner),
  acompanhar quantos estão em andamento/completos.
- **Validar código**: no painel (caixa/garçom) digita o código → mostra
  cliente, prêmio e validade → **Confirmar retirada** → registra
  "**Fulano retirou 1 Tacacá**", com hora e quem liberou. Código usado ou
  vencido é recusado.
```sql
create table fidelidade_config (
  loja_id uuid primary key, reais_por_ponto numeric(10,2) default 1,
  pontos_por_resgate int default 100, valor_resgate numeric(10,2) default 2,
  validade_meses int default 12, canais text[]
);
create table cartao_selos (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid, nome text, produto_ids uuid[], categoria_ids uuid[],
  selos_necessarios int not null, premio_produto_id uuid, premio_descricao text,
  prazo_retirada_dias int default 30, canais text[], no_banner boolean default true,
  ativo boolean default true
);
create table cliente_cartao (
  id uuid primary key default gen_random_uuid(),
  cartao_id uuid references cartao_selos, cliente_id uuid,
  selos int default 0, completado_em timestamptz,
  codigo text unique, expira_em timestamptz,
  retirado_em timestamptz, retirado_por uuid, retirado_pedido_id uuid
);
create table cliente_selo (               -- histórico de cada selo ganho
  cliente_cartao_id uuid references cliente_cartao, pedido_item_id uuid, canal text,
  criado_em timestamptz default now()
);
```

### 9N.3 Banners **[decisão]**
- **Tablet e delivery** têm banner/carrossel no topo para promoções, eventos
  da semana, **promoção do mês** e cartões de selos (ex. "Compre 6 Tacacás e
  ganhe 1 → ver meu cartão").
- Cadastrados no painel (Vitrine e banners): imagem/vídeo, título, texto,
  link (produto, promoção, cartão de selos), dias/horários e canais.

### 9N.4 Só para cadastrados **[decisão]**
- **Visitante (sem CPF)** vê apenas o convite: "Cadastre-se e ganhe **10% de
  DESCONTO** e R$ 1 = 1 ponto". Não vê cartão de selos, saldo, cashback nem
  promoções exclusivas.
- **Cliente identificado** vê tudo: pontos, cashback, cartões de selos,
  **promoções exclusivas para cadastrados** (marcar a promoção como
  `so_cadastrados = true` no painel) e a área do cliente.
- Vale para tablet, QR e delivery: banners e "Agora na casa" filtram o que é
  exclusivo conforme o cliente estiver identificado ou não.

### 9N.5 Área do cliente ("o app dele") **[decisão]**
- **Quanto economizou** usando o app: "Sem o app você pagaria R$ X · com o app
  pagou R$ Y · economizou R$ Z (DESCONTO + CASHBACK)".
- **Lembretes que levam ao pedido**:
  - "Faltam 2 selos para seu Tacacá grátis" + botão **Pedir agora**.
  - "Faltam 80 pontos para R$ 2,00 de CASHBACK" + **pratos que completam mais
    rápido** (com quantos pontos cada um dá) + botão **Pedir** em cada um, que
    leva direto ao carrinho/checkout.
- **Promoções exclusivas** para ele.
- **Meus pedidos**: histórico de **todos os canais** (mesa, delivery,
  retirada, balcão) com itens, total, quanto economizou, pontos e selos
  ganhos, e **Pedir de novo**.
- **[sugestão]** os mesmos lembretes viram notificações no WhatsApp
  (campanhas automáticas, 9K.5) — ex. "faltam 2 selos" 3 dias depois do
  último pedido.

## 9P. Venda sugerida no pedido (upsell e cross-sell) **[decisão]**
- O sistema sugere itens **enquanto o pedido é montado**, em **todos os
  canais**: tablet, QR, delivery, totem, balcão — e também no **PDV e app do
  garçom**, onde a sugestão aparece para o atendente oferecer ("Sugira:
  sobremesa por +R$ 5"). Vale com ou sem cadastro.
- Exemplos de regras (configuráveis no painel):
  - **Sem sobremesa** no pedido → "Por **+R$ 5** leve um Pudim" (preço
    especial só como complemento).
  - **Sem bebida** → sugerir bebida que combina com o prato.
  - **Mais 1 prato = X% de DESCONTO** no pedido (com barra de progresso
    "falta 1 prato").
  - "Combina com" definido por produto (ex. Picanha → farofa extra; Tacacá →
    cachaça de jambu).
- **Sem ser chato** **[decisão]**:
  - no carrinho/sacola como **card discreto** ou carrossel "Combina com seu
    pedido" — **nunca pop-up que bloqueia**;
  - no máximo **2 sugestões** por vez, cada uma com **"×" / Agora não**;
  - dispensou → não volta a mostrar a mesma sugestão naquele pedido;
  - adicionar é **1 toque**, sem sair do carrinho.
- Métricas no dashboard **[sugestão]**: sugestões mostradas, aceitas, taxa de
  aceite e R$ gerado por regra (origem `pedido_item.origem = 'SUGESTAO'`).
```sql
create table regra_sugestao (
  id uuid primary key default gen_random_uuid(),
  loja_id uuid, nome text,
  condicao jsonb,     -- ex. {"sem_categoria": "Sobremesas"} | {"tem_produto": "<id>"} | {"qtd_pratos": 2}
  oferta jsonb,       -- ex. {"produto": "<id>", "preco_especial": 5.00} | {"desconto_pedido_pct": 10}
  canais text[], prioridade int default 0, ativa boolean default true
);
```

## 9O. Nossa história com movimento **[decisão]**
- Visual rico: **folhagem animada** balançando nas bordas, partículas subindo
  (pólen/vaga-lumes), foto com **zoom lento** (efeito Ken Burns), ano grande e
  texto entrando com animação a cada capítulo; linha do tempo com pontos.
- **Modo apresentação**: tela cheia, passa sozinho (ex. 6 s por capítulo) com
  barras de progresso; pode virar a **tela de descanso** do tablet.
- **Tema do fundo editável** no painel (Floresta clara, Floresta noturna, Rio
  e areia, foto própria) e tipo de movimento (folhas + zoom, só zoom, sem
  movimento). Respeitar "reduzir movimento" do aparelho.
- **Sugestões automáticas** enquanto o dono preenche: texto longo demais
  ("até 60 palavras é lido até o fim — encurtar?"), capítulo sem foto,
  sugestão de título, duração total da apresentação. **[sugestão]** gerar com
  IA a partir do texto do dono; o dono sempre aprova.

## 9Q. Financeiro das promoções **[decisão]**
Toda promoção ou desconto mostra **para o cliente quanto ele ganha** e **para
o dono quanto lucra**, antes de salvar e depois, no dia a dia.
- **Custo (CMV)** vem da ficha técnica do F2 (soma dos ingredientes × custo
  atual). Mudou o custo do ingrediente, a conta muda sozinha.
- Conta mostrada ao criar a promoção (exemplo: Tacacá R$ 50, custo R$ 14,
  "pegue 1, leve 2"):
  - Preço normal 2 × R$ 50 = R$ 100 → cliente paga R$ 50 → **cliente ganha
    R$ 50 (50%)**;
  - custo dos produtos 2 × R$ 14 = R$ 28; taxa de pagamento 3% = R$ 1,50;
  - **lucro por venda R$ 20,50 (41%)**.
  - Comparação: sem promoção, 1 Tacacá dá R$ 34,50 → a promoção precisa
    trazer **68% mais vendas** naquele horário para empatar.
- **Semáforo:** verde (lucro e margem acima da meta), amarelo (lucro, mas
  margem abaixo da meta, ex. 30%, configurável), vermelho (prejuízo: o
  custo passa do que o cliente paga). Vermelho pede confirmação para salvar.
- **Cliente vê** "Você ganha R$ 50,00" no card da promoção, no carrinho e no
  resumo do pedido (soma de tudo que ganhou no pedido).
- **Lista de promoções** mostra em cada uma: cliente ganha / lucro por venda
  / margem. Topo do mês: vendas com promoção, desconto dado, lucro das
  promoções, margem média e quantas estão abaixo da meta.
- Vale para tudo que é desconto: 10% de cadastro, cashback, prêmio do cartão
  de selos (custo do prato grátis), cupom de campanha e upsell ("sobremesa
  por + R$ 5" mostra o lucro dos R$ 5 sobre o custo da sobremesa).
- Base para o módulo financeiro: CMV por prato, margem por canal (taxa de
  app/entrega no delivery), lucro por promoção, por campanha de WhatsApp e
  por cliente. **[sugestão]** próximo passo: tela "Financeiro" no painel com
  DRE simples do mês (vendas, descontos, CMV, taxas, lucro bruto).
```sql
-- custo do prato calculado a partir da ficha técnica
create view produto_custo as
select ft.produto_id, sum(fi.quantidade * i.custo_unitario) as cmv
from ficha_tecnica ft join ficha_item fi on fi.ficha_id = ft.id
join ingrediente i on i.id = fi.ingrediente_id group by ft.produto_id;
-- pedido_item ganha: preco_cheio, desconto_valor, promocao_id, cmv_no_momento
-- (guardar o custo do dia para o lucro histórico não mudar depois)
```

## 10. Ordem de implementação sugerida **[sugestão]**

1. Categoria, produto simples, canais e disponibilidade
2. Grupos de complementos reutilizáveis (adicional, ingredientes, observação) + cálculo de preço
3. Loja online pública: layout, horário, abrir/fechar, carrinho, checkout
4. Entrega por bairro → raio → área
5. Pizza (tamanhos, sabores, preço por tamanho, regra de cobrança, massas/bordas)
6. Combos e promoções
7. Gerenciadores de status e de preço em massa
8. Cupons, cashback, pontos
9. Agendamento/encomendas
10. Destaques, roleta, store locator
11. QR de mesa, tablet, totem

## 11. Fontes
- Prints de uma loja em produção enviados pelo usuário (20/10/2026)
- Central de ajuda — Cardápio: https://intercom.help/suitableapp/pt-BR/collections/2886851-cardapio
- Loja Online: https://intercom.help/suitableapp/pt-BR/collections/3780827-loja-online
- Autoatendimento: https://intercom.help/suitableapp/pt-BR/collections/3780902-autoatendimento
- Cadastros e Configurações: https://intercom.help/suitableapp/pt-BR/collections/2886853-cadastros-e-configuracoes
- Delivery: https://intercom.help/suitableapp/pt-BR/collections/2886856-delivery
