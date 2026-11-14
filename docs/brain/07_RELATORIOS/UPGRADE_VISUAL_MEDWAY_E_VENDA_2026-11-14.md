# Upgrade visual inspirado na Medway e preparação para venda — 14/11/2026

Pedido do dono (14/11/2026, 8 capturas do app da Medway): "Analise as telas, botões, cores, visuais, menu inferior, painéis e vamos fazer um upgrade no Héfisto usando isso e vamos prepará-lo para venda." Logo depois: "Vamos tornar o Héfisto um app vendável a partir de agora."

Branch `claude/upgrade-visual-medway`.

## 1. O que a Medway faz bem (análise das capturas)

| Elemento | Na Medway | Por que funciona |
|---|---|---|
| Barra inferior | 5 abas fixas: Home, MedBrain (IA), Pesquisar, Questões (atividade principal), Menu. Traço colorido em cima da aba ativa, ícone de linha, rótulo curto | O polegar alcança tudo; a IA e a busca ficam a um toque |
| Tela Menu | Grade de 2 colunas, cartões brancos grandes com ícone em cima e nome embaixo; seções com rótulo pequeno em maiúsculas ("CONTEÚDO", "OUTROS"); contador no ícone; cartão do usuário no fim com iniciais e "⋮" | Tudo visível sem menu lateral; cartão grande é fácil de tocar |
| Meu Perfil | Seta de voltar redonda; avatar, nome grande e e-mail centralizados; listas por seção ("MINHA CONTA", "FINANCEIRO") com ícone, rótulo e seta ou ícone de link externo; faixa escura "Indique a Medway"; botão "Sair" grande e contornado | Conta e cobrança num só lugar: é a tela que um cliente pagante procura |
| Home | Seletor do produto contratado no topo ("Extensivo Revalida 27.1"), atalhos de agenda e notificações; cartão de destaque em degradê ("Trilha do dia"); abas em pílula; barra de progresso "0 min / 35 h" | A primeira coisa da tela é o que fazer hoje |
| Cartões de tarefa | Selos coloridos ("Antecipado", área), "% concluído", tempo estimado, botões Feito / Pular / ação principal escura em pílula | Ação de um toque, progresso claro |
| Compras (web) | Abas "Compras / Compras canceladas", cartão do pedido com data, número e selo "Pago"; resumo com valor, desconto e total | Transparência de cobrança, essencial para vender assinatura |

## 2. O que entrou no Héfisto agora

Tudo no padrão branco e dourado (botão de ação preto, dourado só como marca), sem azul fora dos ícones de módulo.

- **Barra inferior** (`app/components/layout/BarraInferior.js`, regras em `app/lib/barra-inferior.mjs`): Início · Assistente · Pesquisar · Tarefas · Menu, com traço dourado na aba ativa. Só no celular e no tablet (some a partir de 1280 px, onde o menu do topo aparece inteiro) e só nas telas de primeiro nível (Início, Menu, Minha conta, Tarefas, Notificações e as telas de cards de Cozinha, Bar e Salão). Nas telas de trabalho (comandas, caixa, KDS, fichas, conversa do assistente) ela some, como na Medway, porque elas têm botões fixos no rodapé. App dedicado da loja não tem barra. Assistente e Tarefas só aparecem para quem tem a permissão.
- **Tela Menu** (`/dashboard/menu`): seções Áreas, Atalhos e Sistema em cartões de 2 colunas (3 no tablet, 4 no computador) com os ícones coloridos já usados no Início; cartão da pessoa no fim leva a Minha conta e mostra a versão. Cada item passa pelo guard de rotas.
- **Minha conta** (`/dashboard/conta`): avatar com iniciais, nome e e-mail; Minha conta (unidade atual, alterar senha quando o e-mail é real, notificações, configurações); Empresa e assinatura (só para quem administra usuários: usuários e acessos, apps e terminais, plano e cobrança); Sobre (privacidade e termos, versão); faixa "Indique o Héfisto" pelo WhatsApp; botão Sair grande.
- **Permissões:** as duas telas novas entram no catálogo com `comInicio`: quem vê o Painel geral abre o próprio Menu e a própria conta (trava em `permissions-catalog.test.mjs`). Entradas na busca (`navigation-registry.mjs`).
- **Versão** do `package.json` exposta como `HEFISTO_VERSAO` no `next.config.js`.
- `sairDoSistema()` em `app/lib/auth.js` (o layout e Minha conta usam a mesma saída).

### Evidência

- TESTADO LOCAL: `barra-inferior.test.mjs` 4/4, `conta.test.mjs` 5/5, `cores-modulo.test.mjs` OK, `app/lib` 1005 ok (as 13 falhas são os testes de banco sem PGLITE, as mesmas da `main`), catálogo de permissões OK, navegação OK, build OK (Google Fonts simulado).
- TESTADO EM MOCK: Chrome 390×844, 820×1180 e 1366×900 com Supabase falso (admin): sem rolagem lateral, abas com 60 px de altura, barra presente em Início/Menu/Conta e ausente nas Comandas e no computador, sem erro de página.
- Preview e produção: NÃO VALIDADO.

### Ficou de fora (com motivo)

- **Cartão "Rotina do dia" no Início com barra de progresso** (o "Trilha do dia" da Medway): `tarefas_instancias` está vazia no banco real e os checklists usam `checklists_execucoes`. Fazer o cartão sobre os checklists é o próximo passo, para não mostrar um progresso que não existe.
- **Contador nos ícones do Menu**: só com dado real (notificações não lidas, tarefas pendentes); não foi ligado ainda.

## 3. Preparar o Héfisto para venda: o que falta

Achado do banco real (leitura, 14/11/2026): a tabela `empresas` tem só `id, nome, documento, ativo, created_at`. **A migração do Control Plane SaaS (`db/migracao_control_plane_saas.sql`: `plano_id`, `status`, `onboarding_status`, `hefisto_eval_entitlement`) não está aplicada.** Por isso Minha conta mostra "Plano e cobrança: Não registrado" (DADOS INSUFICIENTES), em vez de inventar um plano.

Ordem sugerida, do que bloqueia a primeira venda ao que melhora a conversão:

| # | Item | Situação | Depende do dono |
|---|---|---|---|
| 1 | Planos e preços (nomes, o que cada um libera, valor mensal/anual, limite de unidades e usuários) | Rascunho técnico existe (BASIC/PRO/MULTIUNIT) | **Sim: preços e o que entra em cada plano** |
| 2 | Aplicar o Control Plane SaaS (plano e situação por empresa, travas por plano no servidor) | Migração escrita, não aplicada | Sim: aprovação da migração |
| 3 | Cobrança recorrente (Pix/cartão/boleto, faturas, suspensão por atraso) | Não existe | Sim: escolher o meio (ex.: Asaas, Pagar.me, Stripe, Mercado Pago) e criar a conta |
| 4 | Site de vendas público (`/` hoje vai direto para o login): o que é, para quem, planos, depoimentos reais, botão de teste grátis e WhatsApp comercial | Não existe | Sim: domínio, WhatsApp comercial, fotos e depoimentos reais |
| 5 | Cadastro self-service com teste grátis e onboarding guiado (empresa, unidade, primeiros produtos, primeira ficha) | Provisionamento só pelo painel admin | Sim: duração do teste |
| 6 | Termos de uso, contrato SaaS, política de privacidade e LGPD (operador de dados, DPA) | Existe `/privacidade` | Sim: revisão jurídica |
| 7 | Isolamento entre empresas validado com uma segunda empresa real (S-01/S-02, fase 2 de RLS) | Fase 1 aplicada; fase 2 aguarda aprovação | Sim: APR-002 |
| 8 | Marca neutra do cliente: tirar dados da casa (Sel de Estrela, nomes de pratos) dos textos, exemplos e modelos padrão | A levantar | Não |
| 9 | Suporte: canal, base de ajuda, tela "Ajuda" no Menu (a Medway tem) | Não existe | Sim: canal de suporte |
| 10 | Material de venda: apresentação, vídeo de demonstração e uma empresa de demonstração com dados de exemplo | Não existe | Parcial |
