---
id: HDEV-009
titulo: Orçamento universal de eventos: modalidades combinadas (mesa, buffet, coffee, bar, equipe), visão interna e do cliente, PDF/WhatsApp, versões e pacotes
status: IN_PROGRESS
prioridade: 1
dependencias: []
bloqueadores: []
tentativas: 0
sem_progresso: 0
mesma_falha: 0
ultima_falha: ""
atualizado_em: 2026-10-31
---

# HDEV-009 — Orçamento universal de eventos: modalidades combinadas (mesa, buffet, coffee, bar, equipe), visão interna e do cliente, PDF/WhatsApp, versões e pacotes

## Objetivo (pedido do dono, 31/10/2026)

Um único modelo profissional de proposta para TODAS as modalidades de evento do Seldeestrela (buffet, mesa montada, coffee break, open bar, casamento, personalizado), com a organização do PDF de referência do dono (dados do evento → cardápio por categorias → valores → serviços → itens inclusos → condições) e visual moderno: capa elegante, fundo branco, detalhes dourados, fotos dos pratos quando houver, tabelas limpas.

- **Modalidades combinadas no mesmo orçamento** (ex.: mesa de entradas + buffet + mesa de sobremesas + open bar). Cada parte com cálculo próprio:
  - mesa montada: produtos × quantidades;
  - buffet: custo por pessoa pelo cardápio e consumo;
  - bar: por pessoa, consumo estimado ou quantidade fechada;
  - equipe: pessoas × horas × valor.
  Soma única com custos operacionais, impostos e margem na precificação.
- **Sem custo em dobro**: o mesmo funcionário, equipamento ou insumo em duas modalidades conta uma vez.
- **Seções da proposta** (só as que se aplicam): capa, informações (cliente, contato, data, local, horário, adultos/crianças), cardápio, investimento (por pessoa × convidados + pacotes = total, montado sozinho: ex. do PDF 130 pax × R$ 132 + bebidas R$ 42/pessoa = R$ 22.620), serviços, itens inclusos, condições comerciais, aceite.
- **Duas visões**:
  - interna: fichas, custos, simulações, margem, lucro previsto e preço;
  - cliente: apresentação sem custos.
- O dono escolhe mostrar o valor por modalidade ou só o fechado.
- **Versões da proposta** quando o cliente pede alteração, e **pacotes comparáveis** (Econômico, Intermediário, Premium) no mesmo evento.
- Exportar **PDF**, compartilhar no **WhatsApp**, salvar no **histórico do evento**.

## Regras

- Números do motor determinístico (evento-orcamento.mjs / evento-financeiro.mjs / Resultado do mês); a IA não calcula preço.
- Reusar fichas técnicas, bases do cardápio do evento e custo médio do estoque.
- Visual no design system branco e dourado (HDEV-010).

## Pendente do dono

- O PDF de referência ("Orçamento Lucas - 130 pax - Confraternização - VI - Menu I") não está no repositório: enviar o arquivo para copiar a organização exata (ou confirmar que a lista de seções acima basta).
- Logo do Seldeestrela em boa resolução para a capa.

## Feito (etapa 1 — simulador, 31/10/2026)

- **Simulador do evento** em Eventos & Reservas → Simulador (rota /rapido, substitui o Orçamento rápido).
  - Liga e desliga Mesa montada, Buffet, Bar e Equipe.
  - Fichas por categoria com ✓; quantidade fechada na mesa, porções ou doses por pessoa no buffet e no bar.
  - Resultado ao vivo: custo por modalidade, total, por convidado, faturamento, saldo e margem.
  - "Continuar para precificação" cria o evento com o orçamento montado.
- Contas em app/lib/evento-simulador.mjs (custo = ficha técnica, o mesmo do orçamento do evento). 5 testes, incluindo o simulador e o orçamento do evento dando o mesmo custo.
- TESTADO EM MOCK no navegador: mesa R$ 172 fixa; bar R$ 60 → R$ 120 com 20 → 40 convidados; evento criado com itens, equipe e preço por pessoa.

## Critério de pronto

- [ ] Evento com 2+ modalidades calcula cada uma e soma sem duplicar recurso — testes
- [ ] Proposta do cliente sem nenhum custo interno (teste que procura custo no HTML/PDF)
- [ ] PDF e link do WhatsApp; versões no histórico; 3 pacotes comparáveis
- [ ] TESTADO EM MOCK → TESTADO NO PREVIEW
