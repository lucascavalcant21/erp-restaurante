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
