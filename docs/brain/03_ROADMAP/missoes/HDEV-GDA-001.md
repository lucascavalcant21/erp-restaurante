---
id: HDEV-GDA-001
titulo: Green Dot Assist vira o assistente único do Héfisto (perguntas, ações e voz)
fase: HI-07
status: BACKLOG
prioridade: 1
dependencias: []
bloqueadores: []
tentativas: 0
sem_progresso: 0
mesma_falha: 0
ultima_falha: ""
atualizado_em: 2026-10-29
---

# HDEV-GDA-001 — Green Dot Assist: o assistente que sabe tudo do restaurante

## Pedido do dono (29/10/2026, resumido)

"Transformar o Green Dot Assist no nosso sistema de perguntas e respostas." Ele:
- sabe a escala do dia, o ticket médio, tudo do financeiro e o **lucro líquido** (o que mais interessa);
- põe produtos no estoque e pergunta quando tiver dúvida; cadastra produto e mostra o valor da última compra;
- controla estoque e CMV real; imprime etiquetas;
- sabe a ficha de qualquer prato e como faz; sabe usar cada equipamento;
- treina cozinha, bar, salão e garçom;
- sabe delivery, eventos e marmitas; cria evento do zero conversando;
- dá sugestões, cria promoções; cuida do RH, CRM, cardápio digital e marketing;
- conversa como um colega, **por áudio**; tira dúvidas; responde até previsão do tempo.

## Regras que não mudam (CLAUDE.md)

- Número sai do banco por código testado (DADOS INSUFICIENTES quando falta). A IA interpreta, explica e conversa; não calcula dinheiro nem estoque e não acessa o banco.
- Empresa e unidade vêm da sessão, nunca do texto.
- Ação que grava (estoque, cadastro, evento, promoção, etiqueta) passa por cartão de confirmação (AgentConfirmationCard) e auditoria. Perguntar quando tiver dúvida = cartão com a dúvida.

## O que já existe

- Intelligence Core (`app/lib/intelligence/`): 22 intenções, agentes (vendas, compras, estoque, financeiro, RH, operações), ActionRegistry (hoje só "registrar perda"), provedor Anthropic, voz (`voice/voice-provider.js`).
- Green Dot Assist (`app/components/green-dot/`, `/dashboard/assistente`): tablet de bancada (receitas, equipamentos, escala, praças).
- Chaves em Production (só os nomes): `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`.

## Fases

1. **Uma porta só:** o Green Dot Assist abre o chat do Héfisto (texto e microfone), com as perguntas do Intelligence Core e o conteúdo do tablet (fichas, equipamentos, escala).
2. **Perguntas novas (leitura):** lucro líquido do mês (Resultado do mês), ticket médio, escala do dia, ficha e modo de preparo de um prato, última compra de um produto, CMV real, eventos e marmitas da semana, delivery.
3. **Ações com confirmação:** entrada no estoque (pergunta embalagem e quantidade quando não tiver certeza), cadastro de produto, etiqueta, rascunho de evento, rascunho de promoção/combo.
4. **Conversa de colega por voz:** fala e ouve (pt-BR), respostas curtas, memória da conversa.
5. **Treinamento:** trilhas por função (cozinha, bar, salão, garçom) com perguntas e conferência.
6. **Fora do restaurante:** previsão do tempo (Open-Meteo, sem chave) e conversa geral pelo modelo.

## Decisões pendentes do dono

- Qual IA conversa: o Héfisto já usa a Anthropic (Claude); existe também `OPENAI_API_KEY`. Cada conversa tem custo por uso na conta do provedor.
- Segurança: a `ANTHROPIC_API_KEY` na Vercel está como variável legível ("readable-secret"); trocar para "Sensitive".

## Critério de pronto (por fase)

- [ ] Fase 1 — NÃO VALIDADO
- [ ] Fase 2 — NÃO VALIDADO
- [ ] Fase 3 — NÃO VALIDADO
- [ ] Fase 4 — NÃO VALIDADO
- [ ] Fase 5 — NÃO VALIDADO
- [ ] Fase 6 — NÃO VALIDADO
