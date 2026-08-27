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

### 1. Rodar 17 migrações (eu faço, só me lembre quando for relevante)
`migracao_controle_acesso`, `migracao_operacao_inteligente`, `migracao_portal_extras`,
`migracao_colaborador_filiacao`, `migracao_movimento_valor`, `migracao_ponto_facial`,
`migracao_recibos_prestacao`, `migracao_extra_dados_recibo`,
`migracao_colaborador_estado_civil`, `migracao_insumo_fornecedor_precos`,
`migracao_insumo_perda_empanado`, `migracao_memorandos_operacao`,
`migracao_auditoria_correcao`, `migracao_colaborador_endereco_rg`,
`migracao_ficha_metodo_bar`, `migracao_estoque_lotes`, `migracao_producao_salao`
— todas em `db/`.

**Esta lista NÃO é o inventário de `db/`.** Ela é a fila do que ainda falta
rodar; há dezenas de migrações antigas na pasta que já foram aplicadas. Três
vezes num mesmo dia uma funcionalidade pareceu quebrada só porque a migração
dela nunca tinha entrado aqui. Ao criar migração nova, acrescente na lista no
mesmo commit.

Quais destravam funcionalidade já publicada:

- `migracao_auditoria_correcao` — único passo que falta para o item 3.
- `migracao_colaborador_endereco_rg` — cria `rua_av`, `numero_casa`, `bairro` e
  `rg` em `colaboradores`. Essas colunas nunca existiram no banco, e o cadastro
  do extra descartava esses quatro campos em silêncio a cada "Salvar".
- `migracao_ficha_metodo_bar` — sem ela o método (batido/mexido) não persiste na
  ficha e o livro de drinks imprime o card sem essa linha.
- `migracao_estoque_lotes` — cria os lotes por validade. Sem ela, a entrada com
  validade no estoque é **recusada** com o motivo, em vez de gravar a
  quantidade e descartar a data.
- `migracao_producao_salao` — acrescenta o salão ao plano do dia e grava setor e
  local na produção. Sem ela o painel do turno não tem o que comparar.

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

### 3. Auditoria não recebeu a baixa do inventário — SÓ FALTA A MIGRAÇÃO
O código já está inteiro; o que falta é rodar `db/migracao_auditoria_correcao.sql`
no SQL Editor (item 1). Enquanto ela não rodar, o sintoma continua igual.

O `.catch(() => {})` já saiu. Hoje o caminho todo fala:
- `registrarAuditoria` (`app/lib/hefisto-acoes.js`) devolve o motivo da recusa e
  loga em `console.error` por `detalharErroAuditoria`.
- `registrarMovimentoInventario` (`app/lib/inventario.js`) devolve `avisoAuditoria`
  sem desfazer o movimento — o movimento já está gravado quando a auditoria falha.
- A tela de inventário avisa na hora que o movimento não entrou na auditoria e
  diz qual migração rodar.
- `/dashboard/gestao/auditoria` separa "lista vazia porque não houve ação" de
  "lista vazia porque o banco recusou" e mostra o erro em vez de fingir calmaria.

A causa provável está escrita na própria migração: `unidade_id`, `usuario_id` e
`registro_id` nasceram `uuid` na criação original, mas no ERP inteiro esses ids
trafegam como texto ("matriz" não é uuid). Qualquer id não-uuid derruba o INSERT
com `invalid input syntax for type uuid`. A migração cobre os quatro casos
possíveis — tabela faltando, coluna faltando, tipo errado e GRANT/RLS — e no fim
manda `notify pgrst, 'reload schema'`, senão o PostgREST continua respondendo
com o desenho antigo em cache.

**Se depois de rodar ainda falhar:** a mensagem exata agora aparece no alerta da
tela de inventário e no console. Me traga esse texto que eu ataco a causa certa.

### 4. Usuários e Perfis de acesso
As telas já não quebram (mostram aviso). Se continuarem vazias, o motivo é a
variável `SUPABASE_SERVICE_ROLE_KEY` na Vercel — eu configuro, você não toca nisso.

### 5. Operação Inteligente — construída pela metade
Já existe: construtor de processos, 7 checklists prontos (abertura e fechamento
de cozinha, bar e salão), agendamento recorrente, execução guiada item a item,
não conformidades com ações corretivas, alertas com deduplicação e auditoria.
Motor de recorrência testado em `app/lib/operacao-agenda.test.mjs` (33 testes).

**Falta, do prompt original:**
- **Captura de evidência** — foto, GPS e conferência por IA. Hoje a tela de
  execução mostra "Captura de evidência entra na próxima etapa do módulo" e só
  marca como feito. As colunas já existem em `op_evidencias`.
- **Modo TV** — painel para pendurar na cozinha com o andamento do dia.
- **Rankings e relatórios** — score P/E/Q por pessoa e por setor ao longo do tempo
  (`calcularScore` já existe e é testado).
- **Automações e WhatsApp** — avisar responsável, cobrar atraso, escalar NC crítica.
- **Criar checklist por IA** — descrever em texto e a IA montar seções e itens.

### 6. Módulo de treinamento de funcionários
Trilhas por cargo, aulas e documentos, quiz, progresso por pessoa e certificado.
Ainda não começado.

### 7. Eventos da semana — completar
`/dashboard/rh/semana` já mostra escala do dia, extras com diária e custo.
**Falta** juntar feriados e atividades do restaurante na mesma agenda.

## Ideias levantadas, não decididas

- Imagem própria (fachada) no cartão dos links dos portais — hoje usa `public/icon-512x512.png`.
- Clicar num recibo do histórico do extra para reabrir e reimprimir.
- Fila de impressão da EPSON TM-T20 travada desde 30/06 no meu PC (job em
  "Printing, Retained" segurando ~40 documentos). É problema do Windows, não do
  ERP: cancelar os documentos, reiniciar o spooler e desligar "Manter documentos
  impressos" nas propriedades da impressora.

## Comece por

Me pergunte por qual item começar, ou vá direto no item 5 se eu não responder
(o 3 depende só de você rodar a migração).
