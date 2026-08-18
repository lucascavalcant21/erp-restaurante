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

### 1. Rodar 12 migrações (eu faço, só me lembre quando for relevante)
`migracao_controle_acesso`, `migracao_operacao_inteligente`, `migracao_portal_extras`,
`migracao_colaborador_filiacao`, `migracao_movimento_valor`, `migracao_ponto_facial`,
`migracao_recibos_prestacao`, `migracao_extra_dados_recibo`,
`migracao_colaborador_estado_civil`, `migracao_insumo_fornecedor_precos`,
`migracao_insumo_perda_empanado`, `migracao_memorandos_operacao` — todas em `db/`.

### 2. Recibo do extra mais curto
Já foi feito: campo vazio não ocupa linha e sumiram as linhas de R$ 0,00.
**Falta:** juntar "Prestador cadastrado" e "Trabalho realizado" num bloco só de
duas colunas (tirando dois cabeçalhos verdes) e deixar **título e subtítulo
editáveis** — hoje fixos em `app/lib/recibo-extra.js` (~linha 50). Guarde em
`config_sistema.params.recibo_textos`, mesmo padrão dos portais, sem migração.

### 3. Auditoria não recebeu a baixa do inventário
A tela é `/dashboard/gestao/auditoria`. O registro é gravado em
`app/lib/inventario.js` com `.catch(() => {})`, então falha em silêncio —
provável recusa da tabela `hefisto_auditoria` (RLS ou coluna faltando).
Faça o erro aparecer no console, leia a mensagem e corrija a causa.

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

Me pergunte por qual item começar, ou vá direto no item 2 se eu não responder.
