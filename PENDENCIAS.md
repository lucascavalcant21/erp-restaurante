# Prompt para continuar o ERP

Cole o texto abaixo numa sessão nova do Claude Code, dentro da pasta do projeto.

---

Você vai continuar o **Meu ERP / Hefisto** — ERP de restaurante em Next.js 15 +
Supabase, deploy por `git push origin main` na Vercel
(https://erp-restaurante-sand.vercel.app). Estou no Windows.

## Como trabalhar aqui

- **Nunca rode `npm run build`** — estoura memória (exit 137). Valide com
  `npx esbuild <arquivo> --loader:.js=jsx --jsx=preserve --outfile=<tmp> --log-level=error`
  e `node --check` para `.js`/`.mjs` puros.
- **Antes de `git add`**, rode `rm -f ./nul` — um arquivo chamado `nul` quebra o git no Windows.
- **Deploy:** commit → `git push origin main` → confira `npx vercel ls` até aparecer **● Ready**.
  Não peça confirmação para commitar e subir na main.
- **Você não tem acesso ao meu Supabase.** Migrações eu rodo à mão no SQL Editor.
  Nunca me peça senha, chave ou string de conexão.
- **Banco:** `unidade_id` é **text**, nunca uuid. Toda migração precisa ser idempotente.
  Configuração que não exige tabela nova vai em `config_sistema.params`
  (portais, custos fixos, categorias de inventário).
- **UI:** sem emojis. Verde é a única cor primária, vermelho só para erro.
  Cores vêm dos tokens em `app/globals.css` — nunca hex chumbado no componente.
- **Nunca `.catch()` em cima de chamada ao Supabase.** O que ele devolve tem
  `then` e não tem `catch`: chamar `.catch()` estoura um TypeError **antes de a
  requisição sair**, e um `try` em volta engole tudo — a gravação simplesmente
  não acontece, sem erro na tela. Use `try/catch` ou leia o `error` do retorno.
  (Vale para `.from()`, `.rpc()`; `supabase.storage` é Promise de verdade.)
- Escreva comentários e textos de tela em português, explicando o **porquê**, não o quê.

## O que está pendente, em ordem

### 1. Migrações — FILA VAZIA (27/08)

Nada de banco pendente. As 17 antigas mais estas quatro foram rodadas em 27/08:
`LIMPAR_MONTAGENS_DUPLICADAS`, `migracao_insumo_volume_unidade`,
`CORRIGIR_PONTO_LARISSA_26_08` e `CORRIGIR_PONTO_LARISSA_25_08_E_CEDEINE_27_08`.

**Falta um passo à mão, não é SQL:** a coluna do volume nasceu vazia para quem
já estava cadastrado. Abra cada ingrediente medido em garrafa/lata/barril e
preencha quanto cabe em 1 (a Água sem gás é 500), e cada um medido em "un" e
preencha quanto pesa 1. Enquanto estiver vazio, o item não entra no rendimento
da ficha — e a linha dele diz isso, em vez de sumir da conta calado.

**Esta lista é a FILA do que falta rodar, não o inventário de `db/`.** Três
vezes num mesmo dia uma funcionalidade pareceu quebrada só porque a migração
dela nunca tinha entrado aqui. Ao criar migração nova, acrescente na lista no
mesmo commit que a cria.

**Dois erros de forma que custaram uma rodada cada, para não repetir:**
`LIMPAR_MONTAGENS_DUPLICADAS` tinha um `'SUA_UNIDADE'` para trocar à mão em
dois passos e um terceiro que não usava esse filtro — passo destrutivo que
depende de edição manual ao lado de um que não depende é armadilha. E os
arquivos abriam com `--` seguido de régua de caractere de desenho: no caminho
de cópia para o navegador os dois hifens viraram um travessão, que não abre
comentário, e o script morria na linha 1. Comentário de SQL neste projeto é
`/* */`, sem caractere decorativo.

Scripts avulsos que existem mas você roda só se quiser:
`ZERAR_FICHAS_COZINHA_E_BAR.sql` (apaga o receituário dos dois setores),
`IMPORTAR_PONTO_AGOSTO.sql` e `VINCULAR_PRODUTOS_AOS_ESTOQUES.sql`.

O último (30/08) põe cada produto na prateleira do setor dele de uma vez, em
todas as unidades. **Não precisa rodar**: o app faz isso sozinho ao abrir cada
estoque. Serve para quem prefere consertar tudo sem abrir tela por tela. É
idempotente e preserva saldo de quem já estava vinculado.

### 2. Recibo do extra mais curto — CONCLUÍDO
Nada pendente aqui. O que ficou pronto, tudo já no `main`:
- Campo vazio não ocupa linha e as linhas de R$ 0,00 sumiram
  (`campo()` e `linhaValor()` em `app/lib/recibo-extra.js`).
- "Prestador cadastrado" e "Trabalho realizado" viraram **um bloco só** de duas
  colunas e os dois cabeçalhos verdes saíram do papel.
- **Título e subtítulo editáveis** na tela `/dashboard/rh/extra/[id]/recibo`,
  guardados em `config_sistema.params.recibo_textos` por unidade — sem migração.
  Subtítulo em branco é escolha válida: a linha some do papel.
- O merge do JSON tenta a função `merge_config_sistema_params`
  (`docs/config-etiquetas-unidades.sql`) e, se ela ainda não existir no banco,
  cai sozinho para ler-e-reescrever o `params`. Por isso não trava nada.

### 3. Auditoria da baixa do inventário — MIGRAÇÃO RODADA, FALTA CONFERIR
O código está inteiro e `migracao_auditoria_correcao` foi executada em 27/08.
Falta só o teste: dê uma baixa em `/dashboard/gestao/inventario` e veja se ela
aparece em `/dashboard/gestao/auditoria`.

Se não aparecer, o sistema agora **diz o motivo** em vez de falhar calado — o
alerta na tela de inventário e o `console.error` trazem a mensagem exata do
banco. Traga esse texto e a causa se resolve na hora.

O caminho todo fala hoje: `registrarAuditoria` devolve o motivo da recusa,
`registrarMovimentoInventario` devolve `avisoAuditoria` sem desfazer o
movimento, e a tela de auditoria separa "vazio porque não houve ação" de
"vazio porque o banco recusou".

### 4. Usuários e Perfis de acesso
As telas já não quebram (mostram aviso). Se continuarem vazias, o motivo é a
variável `SUPABASE_SERVICE_ROLE_KEY` na Vercel — eu configuro, você não toca nisso.

### 5. Operação Inteligente — falta menos do que este arquivo dizia
Conferido no código em 27/08. **Dois dos cinco itens que constavam como
pendentes já estavam prontos** e ninguém sabia:

- **Captura de evidência — JÁ EXISTE.** `app/lib/operacao-evidencias.js` tem
  foto, GPS de verdade (`navigator.geolocation`, com `exigeGps` por item) e
  conferência por IA via `/api/ia-evidencia`. A tela de execução monta o
  componente `CapturaEvidencia` com veredito. A frase "Captura de evidência
  entra na próxima etapa do módulo", que este arquivo citava, não existe mais.
- **Criar checklist por IA — JÁ EXISTE**, mas no módulo vizinho:
  `/api/ia-checklist` monta título, categorias e tarefas, e
  `/dashboard/checklists/gerenciar` já usa. Não está no construtor de processos
  do Operação Inteligente — são modelos de dados diferentes (`templates` x
  `processos`), então levar para lá é trabalho, não um botão.

**Falta de verdade:**
- **Modo TV** — painel para pendurar na cozinha com o andamento do dia.
- **Rankings e relatórios** — `calcularScore` existe e é usado no painel, mas só
  agregado; não há nada por pessoa nem por setor ao longo do tempo.
- **Automações e WhatsApp** — avisar responsável, cobrar atraso, escalar NC
  crítica. Existe integração de WhatsApp em outros módulos, nenhuma aqui.

### 6. Módulo de treinamento de funcionários
Trilhas por cargo, aulas e documentos, quiz, progresso por pessoa e certificado.
Ainda não começado.

### 7. Eventos da semana — CONCLUÍDO (30/08)
`/dashboard/rh/semana` mostra escala do dia, extras com diária e custo, e agora
também os feriados da unidade e os eventos da casa na mesma agenda
(`fetchFeriados` + `fetchEventos`). Os dois são acessórios: se a tabela não
existir ou o acesso for negado, a tela abre igual, sem a faixa deles.

## O que a sessão de 27/08 entregou

Nada aqui está pendente — é registro, para a próxima sessão não refazer.

- **Recibo do extra**: formato narrativo (declaração, período por extenso, dias
  da semana calculados), dados da empresa vindos de `unidades`, valor detalhado
  e dias de folga marcáveis na tela.
- **Checklists**: módulo próprio na lateral com escolha de área; responsável
  deixou de ser obrigatório (eram quatro bloqueios); impressão em branco para
  marcar à mão e impressão do que foi feito.
- **Estoque**: lotes por validade com saída FEFO, contagem e transferência
  cientes de lote, campo de validade no estoque e no tablet.
- **Produção do Dia**: salão com estoque próprio (o roteamento mandava tudo que
  não era bar para a cozinha) e painel de plano × produzido × falta por pessoa.
- **Ponto**: tela de corrigir batida em `/dashboard/rh/ponto/corrigir`. Não
  existia — `registrarAjuste` estava escrito e sem chamador. A batida original
  nunca é reescrita: entra um ajuste com valor anterior e autor.
- **Ficha técnica**: linguagem do bar (ml, dose, sem embalagem), e a tela ficou
  mais enxuta nos dois setores — um custo só, sem barra de etapas, sem
  simulador, sem tempo/validade/observações.
- **Livro de drinks**: método (batido/mexido) no card, 9 por página A4 sem
  cortar, e a página com card alto parou de perder a largura da folha.
- **Erro silencioso**: varredura de 243 pontos; 12 exclusões que falhavam sem
  dizer nada passaram a mostrar o motivo.
- **Duplicados no guia**: três telas comparavam nome de três jeitos. Chave
  unificada em `chaveNomeMontagem` + índice único no banco.

- **Medida x embalagem**: "Unidade" misturava o que mede (ml, L, g, kg) com o
  que conta (garrafa, lata, barril), e escolher "Garrafa" apagava o volume —
  500 ml viravam "500 garrafas". Viraram duas perguntas: quanto e em que. O bar
  só oferece ml e L. A ficha mostra "500 ml por garrafa" e, quando falta, diz
  que falta em vez de sair da conta calada. Colunas `volume_unidade_ml` e
  `peso_medio_g` cobrem o cadastro antigo e o "un" (1 tomate = 100 g).
- **Checklist**: tempo por tarefa e foto do padrão ("como tem que ficar"), os
  dois no JSONB do item, sem migração. A folha ganhou coluna Tempo, total no
  cabeçalho e galeria de fotos numerada no fim — foto ao lado de cada linha
  jogaria o checklist para três folhas. Montar por foto do ambiente, tempo
  estimado pela IA, e tarefa marcável como "em conjunto".
- **Tablet do estoque**: cadastrar produto sem sair da tela; mínimo e máximo por
  produto atrás do PIN do gerente (o mesmo do ponto, 1234 de fábrica); fora os
  cinco indicadores do topo e o painel que cobria a tela a cada lançamento.
- **Ponto**: entrada antes do turno é barrada em vez de arredondada. O livro
  guarda a hora real (art. 74, II proíbe horário predeterminado) e o resumo
  segue o livro, então carimbar 15:40 em quem bateu 15:39 seria ilegal. A trava
  vale até 6 horas antes, para não apagar hora extra de quem foi chamado cedo,
  e usa a jornada do dia da semana, não o horário fixo.
- **Dois crashes**: `bar e cozinha não abre para editar` (setters órfãos depois
  de remover o simulador) e `dinheiro is not defined` (troca global de `fmtBRL(`
  que atravessou a fronteira de dois componentes). A varredura de escopo que
  achou o segundo compara, componente a componente, o que é usado contra o que é
  declarado ou recebido por prop — vale rodar depois de qualquer troca global.

## O que a sessão de 30/08 entregou

- **Produto cadastrado no bar não entrava no estoque do bar.** O cadastro
  tentava vincular, mas a chamada terminava em `.catch(() => {})` — e o que o
  Supabase devolve tem `then` e **não tem `catch`**. Chamá-lo estourava um
  TypeError antes de a requisição sair, e o `try` de fora engolia tudo. O
  vínculo nunca era gravado, sem erro na tela. Ficou escondido enquanto o
  `estoque_itens` do bar estava vazio, porque aí a listagem caía num fallback
  que mostrava o catálogo inteiro do setor; a primeira entrada criou uma linha,
  o fallback desligou e os produtos sumiram.
  **Se for usar `.catch()` em cima de chamada ao Supabase: não existe.** Use
  `try/catch` ou leia o `error` do retorno. A varredura que acha isso compara,
  para cada `.catch()`, se a função é `async` de verdade ou devolve o builder.
- **Escolha do estoque estava frouxa**: procurava "bar" no nome, o que casa com
  "Pré-preparos do Bar" e "Embalagens do Bar", sem ordem definida — e um
  `|| ests[0]` mandava a bebida para a cozinha quando não achava nada. Agora
  `estoquePrincipalDoSetor` escolhe a prateleira certa ou nenhuma, com teste.
- **Pré-preparo não sobe para o estoque principal.** O que a ficha produz já
  mora no "Pré-preparos do Bar/Cozinha"; sem esse filtro o mesmo saldo seria
  contado em dois lugares. Xarope *comprado* (Monin, 1883) continua indo para o
  Bar — o critério é ter ou não casa num pré-preparo, não o nome nem a categoria.
- **Histórico da movimentação** tinha o mesmo `.catch()`, e ali ele derrubava o
  registro **depois** de o saldo já ter sido gravado: a entrada entrava, sumia
  do histórico e a tela ainda mostrava erro.
- **Ficha: rendimento sempre automático.** O "ajustar manualmente" saiu. Número
  digitado à mão envelhecia calado quando o preço ou a quantidade de um
  ingrediente mudava. No card verde a hierarquia estava invertida — grande era o
  preço de 1 kg/L e o custo real da receita ficava pequeno embaixo; trocado.
  O efeito automático também apagava o `peso_porcao_g`: enquanto havia modo
  manual isso não acontecia ao abrir ficha salva (ela abria em manual), e sem
  ele abrir para editar apagaria um valor gravado — de que depende a composição
  por porção existir. Parei de apagar.
- **Tablet: mínimo e máximo de todos os produtos numa tela.** Já existia num
  botão dentro do card, abaixo da dobra — ninguém achava, e num estoque de trinta
  bebidas eram trinta modais e trinta senhas. Botão no cabeçalho, lista inteira,
  senha uma vez só. Grava apenas o que foi mexido, respeita a busca e congela a
  lista na abertura.
- **Portal da vaga**: o campo perdia o foco a cada tecla. `Campo` era declarado
  dentro do componente, então virava função nova a cada render e o React
  desmontava o `<label>` inteiro. Subiu para o topo do módulo.
- **Marcador de versão no cabeçalho** (`NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA`).
  Existe porque "nada mudou" era ambíguo entre build velho e bug de verdade:
  agora dá para comparar o que está na tela com o que está no `main`.

## Ideias levantadas, não decididas

- Imagem própria (fachada) no cartão dos links dos portais — hoje usa `public/icon-512x512.png`.
- Clicar num recibo do histórico do extra para reabrir e reimprimir.
- Fila de impressão da EPSON TM-T20 travada desde 30/06 no meu PC (job em
  "Printing, Retained" segurando ~40 documentos). É problema do Windows, não do
  ERP: cancelar os documentos, reiniciar o spooler e desligar "Manter documentos
  impressos" nas propriedades da impressora.

## Comece por

Me pergunte por qual item começar, ou vá direto no item 5 se eu não responder —
Modo TV, rankings e automações são o que sobrou de verdade lá.

Aberto hoje (30/08), em ordem de esforço:
- **Item 3** é só conferir: dê uma baixa no inventário e veja se aparece na
  auditoria. Se não aparecer, a tela agora diz o motivo — traga o texto.
- **Item 5**: Modo TV, rankings por pessoa/setor, automações e WhatsApp.
- **Item 6**: módulo de treinamento, do zero.
- **Item 4** é meu, não seu: depende da `SUPABASE_SERVICE_ROLE_KEY` na Vercel.

E o passo à mão do item 1 continua de pé: ingrediente cadastrado antes das
colunas de embalagem nasceu sem volume. Enquanto estiver vazio, ele não entra no
rendimento da ficha — e a linha dele diz isso, em vez de sumir da conta calado.
