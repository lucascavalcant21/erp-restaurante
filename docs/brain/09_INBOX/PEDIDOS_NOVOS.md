# Pedidos novos

Pedidos concretos (bug, ajuste, tela, relatório). O agente cria a missão, ou resolve direto se for pequeno, e registra aqui o resultado.

| Data | Pedido | Missão / resultado |
|---|---|---|
| 07/10/2026 | Mapear telas de eventos e orçamento nas permissões | Feito (`73b4643`); ver DP-005 em [[DECISOES_PRODUTO]] |
| 08/10/2026 | Criar o sistema autônomo de desenvolvimento (Missão 000) | [[HDEV-000]] DONE |
| 08/10/2026 | Agente usar os conectores Supabase/Vercel que já estão ligados | Feito: só leitura, com guarda de SQL (DA-007) |
| 08/10/2026 | Agente poder aplicar migração, escrever no banco, mexer em branches, fazer deploy/promover/reverter e mudar variáveis | **Aguardando o dono:** a verificação de segurança da sessão recusou; ver "Pendentes" em [[DECISOES_PRODUTO]] |
| 08/10/2026 | Agente rodar 24 horas por dia, não só à noite | Feito: `npm run hefisto:continuo` (DP-006) |
| 08/10/2026 | Quando acabar o limite, não usar dinheiro: esperar o plano voltar | Feito: só o plano, para antes do uso extra e espera o horário de volta (DP-007) |
| 08/10/2026 | Política de publicação e banco AUTO SAFE / APPROVAL REQUIRED (HDEV-PUBLISH-001) | [[HDEV-PUBLISH-001]] DONE: preview automático; produção e migração pedem o dono (padrões seguros) |
| 08/10/2026 | Eliminar policies inseguras de RLS, validar isolamento, impedir regressão (HDEV-SEC-001) | [[HDEV-SEC-001]]: fase 1 pronta e testada; aplicação aguarda APR-001; trava contra regressão ativa |
| 08/10/2026 | Fase 2 de segurança: 33 tabelas, CPF/salário, pode_ver_todas, dados legados (HDEV-SEC-002) | [[HDEV-SEC-002]]: pronta e testada; aplicação aguarda APR-002 |
| 17/10/2026 | "Minha página de marmita e eventos está uma porcaria: analise e faça as mudanças" | Feito no branch `claude/sharp-meitner-0i36gu`: Eventos em 3 áreas (Funil, Agenda, Reservas), funil sem caixa fixa, reservas funcionando, telas tratando o banco sem as colunas; Marmitaria com primeiros passos, lista legível no celular e marmita fora do cardápio de volta (B-019 a B-022). Falta o dono aprovar a APR-012 (migração de eventos) |
| 17/10/2026 | "Agora faça a mesma coisa no estoque, no financeiro e no dashboard" | Feito no mesmo branch: Financeiro com barra de áreas e 3 telas duplicadas redirecionadas, CMV sem 0% inventado, Contas a Pagar em cartões no celular, Pizza do Lucro visível no celular; Estoque e Financeiro sem fundo preto, abas do Estoque à vista no celular; painel inicial com faturamento vazio compacto (B-023 a B-027). Falta o dono decidir B-025 (28 boletos antigos sem unidade) |
| 17/10/2026 | "1. pode sim, 2. arquivar e 3. merge" (aplicar APR-012, arquivar os boletos antigos, merge) | APR-012 aplicada e verificada; DOC-LEGADO-1 executado (APR-013); merge do PR #185 na `main` |
| 18/10/2026 | Cardápio digital ligado à ficha técnica, celular e tablet em pé ou deitado, menu na lateral, banner com vídeo e fotos, estudo do Goomer e do Cardápio Web, tudo funcionando | Feito no branch `claude/sharp-meitner-0i36gu` (PR #187): cardápio novo (mesa estilo tablet e delivery), editor do dono com prévia; B-028 a B-030 corrigidos |
| 18/10/2026 | Oito idiomas (+ chinês, japonês, coreano, francês, italiano) com um botão de idioma | Feito: interface, conversa e textos fixos nos 8; traduções do conteúdo pelo dono (aba Idiomas) |
| 18/10/2026 | Chatbot, KDS, fidelidade e impressão automática | Chatbot = conversa do cardápio (feita). Fidelidade: feita (abaixo). KDS e impressão automática: próximos |
| 18/10/2026 | Cartões de selo por produto (vários, nº de selos do dono) e cashback para a próxima visita; pontos de programas externos | Feito (código + migração FIDELIDADE-1 testada no PGlite, aguarda APR-014). Pontos externos: BLQ-018 |
| 18/10/2026 | Cadastro pelo QR (CRM) com 10% de desconto nos pedidos pelo app | Feito: `/cadastro/[unidade]`, QR no editor, desconto aplicado pelo servidor (primeiro pedido ou todos, à escolha do dono); depende da APR-014 |
| 18/10/2026 | "Já vai publicando tudo" | Merge do PR #187 e deploy; migração FIDELIDADE-1 só com o sim do dono para ela (APR-014) |

