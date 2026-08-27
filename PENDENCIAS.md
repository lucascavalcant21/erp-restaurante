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
- Escreva comentários e textos de tela em português, explicando o **porquê**, não o quê.

## O que está pendente, em ordem

### 1. Migrações — RODADAS EM 27/08
As 17 da fila foram executadas. Falta rodar estes dois:

- **`db/LIMPAR_MONTAGENS_DUPLICADAS.sql`** — apaga os cards duplicados do guia
  de montagem e cria o índice único que impede voltarem. A primeira tentativa
  falhou porque o arquivo tinha um `'SUA_UNIDADE'` para trocar à mão e o passo
  do índice não usava esse filtro; foi corrigido e agora roda inteiro sem
  editar nada. Confirme se rodou até o `CREATE INDEX`.
- **`db/CORRIGIR_PONTO_LARISSA_25_08_E_CEDEINE_27_08.sql`** — Larissa 25/08
  (entrada 15:40, intervalo 16:40–17:40, saída 00h) e Cedeine 27/08 (entrada
  15:40). Grava o ajuste no livro legal antes do resumo do dia, igual à tela de
  Corrigir batida. Rodar duas vezes não duplica nada.

**Esta lista é a FILA do que falta rodar, não o inventário de `db/`.** Três
vezes num mesmo dia uma funcionalidade pareceu quebrada só porque a migração
dela nunca tinha entrado aqui. Ao criar migração nova, acrescente na lista no
mesmo commit que a cria.

Scripts avulsos que existem mas você roda só se quiser:
`ZERAR_FICHAS_COZINHA_E_BAR.sql` (apaga o receituário dos dois setores) e
`IMPORTAR_PONTO_AGOSTO.sql`.

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

### 7. Eventos da semana — completar
`/dashboard/rh/semana` já mostra escala do dia, extras com diária e custo.
**Falta** juntar feriados e atividades do restaurante na mesma agenda.

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
