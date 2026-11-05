import { aula, modulo, pratos, prova, situacao, FONTE_ECA } from "./base.mjs";

export const BAR = [
  modulo("b-conhecer", "bar", 210, "Conhecendo o bar", "A estação, os insumos e a rotina.", [
    aula("b-con-1", "A estação de trabalho", 6, `
Seu líder vai mostrar o bar inteiro. Aprenda onde ficam:
- garrafas de uso, reposição e estoque;
- copos e taças de cada drink;
- gelo, xaropes, sucos e guarnições;
- coqueteleiras, dosadores, colheres e coadores.

Uma estação bem montada deixa tudo a um passo de distância. Devolva cada coisa ao lugar. Isso economiza minutos no pico.

[PREENCHER: como a estação do bar é organizada na casa.]`, [
      prova("Por que devolver tudo ao mesmo lugar?", ["Para trabalhar mais rápido no pico", "Só para ficar bonito", "Para o gerente não reclamar"], 0, "Na correria, você não pode procurar nada."),
    ]),
    aula("b-con-2", "Abertura, fechamento e limpeza", 6, `
Abertura:
- confira o checklist;
- abasteça gelo, frutas, sucos e xaropes;
- veja a validade do que foi aberto;
- prepare as guarnições do dia;
- deixe copos limpos e secos.

Fechamento:
- guarde e identifique os preparos;
- limpe bancada, pia e máquina;
- lave os utensílios;
- confira a reposição para o próximo turno.

Gelo também é alimento: use a pá, nunca o copo nem a mão. Se cair vidro perto do gelo, descarte todo o gelo daquele recipiente.`, [
      prova("Como pegar gelo?", ["Com o próprio copo", "Com a pá de gelo", "Com a mão limpa"], 1, "Copo pode quebrar dentro do gelo. Mão contamina."),
      situacao("Uma taça quebrou perto do balde de gelo.", ["Tirar os cacos visíveis", "Descartar todo o gelo e limpar o balde", "Servir só de cima"], 1, "Um caco invisível no drink pode ferir o cliente."),
    ]),
  ]),

  modulo("b-tecnica", "bar", 220, "Técnica e padrão dos drinks", "Medir, bater, mexer, servir.", [
    aula("b-tec-1", "Medida e ficha", 5, `
A ficha de drink define os ingredientes, a dose, o copo, o gelo e a guarnição. Siga sempre, inclusive quando estiver sem movimento.

- Meça com dosador. Olhar não é medida.
- Use o gelo indicado.
- Confira o copo antes de começar.
- Prove com canudo limpo quando for necessário ajustar.

Drink forte demais, fraco demais ou diferente da última vez faz o cliente desconfiar. Dose a mais também é prejuízo.`, [
      prova("Por que usar dosador?", ["Para manter o padrão e o custo", "Só para quem está aprendendo", "Porque fica bonito no balcão"], 0, "Até o melhor bartender mede."),
      situacao("Um cliente amigo pede para você carregar na dose por conta da casa.", ["Colocar dose extra", "Explicar com gentileza que segue a ficha e falar com o líder se precisar", "Cobrar uma gorjeta"], 1, "Dose extra é prejuízo e foge do padrão."),
    ]),
    aula("b-tec-2", "Bater, mexer e montar", 6, `
O método da ficha muda o drink:

- Batido (shake): para misturar ingredientes densos, como sucos, xaropes e cremes, resfriando e diluindo.
- Mexido (stir): para drinks só de bebidas, com menos ar e mais transparência.
- Montado (build): direto no copo.
- Macerado: amassar com cuidado para extrair aroma, sem destruir o ingrediente.
- Coado: retira gelo e pedaços.

Gelo faz parte da receita. Pouco gelo derrete rápido e aguada o drink.`, [
      prova("Qual método é mais usado para drinks só com bebidas, sem suco?", ["Batido", "Mexido", "Macerado"], 1, "Mexer resfria com menos ar e mantém o drink limpo."),
      prova("Por que não economizar gelo?", ["Pouco gelo derrete rápido e aguada o drink", "Porque o gelo é barato", "Porque o copo fica mais pesado"], 0, "Mais gelo mantém a temperatura e dilui mais devagar."),
    ]),
    aula("b-tec-3", "Serviço no balcão", 5, `
No balcão, você é bartender e atendente ao mesmo tempo.

- Cumprimente quem chegou, mesmo sem poder atender na hora: um olhar já diz "já vou".
- Mantenha o balcão seco e limpo.
- Sirva pelo lado certo, com o copo limpo e seco por fora.
- Saiba explicar o sabor de cada drink em uma frase.
- Registre tudo no sistema antes de entregar.

Pedidos que chegam do salão têm a mesma atenção. Veja a tela do bar.`, [
      prova("Quando registrar o pedido?", ["No fim do turno", "Antes de entregar", "Só se o cliente pedir a conta"], 1, "O que não foi registrado se perde e vira prejuízo."),
      situacao("Há gente esperando e você está no meio de um drink.", ["Fingir que não viu", "Olhar, cumprimentar e dizer que já atende", "Largar o drink na hora"], 1, "Reconhecer a pessoa acalma a espera."),
    ]),
  ]),

  modulo("b-responsavel", "bar", 230, "Serviço responsável", "Quando não servir, e como fazer isso direito.", [
    aula("b-res-1", "Menores de 18 anos", 4, `
Vender, servir ou entregar bebida alcoólica a menor de 18 anos é crime, mesmo de graça e mesmo que um adulto peça para ele.

Na dúvida sobre a idade:
- peça um documento com foto, com educação;
- sem documento, não sirva;
- bebida para o maior que vai passar para o menor também não pode.

Não negocie. Ofereça uma opção sem álcool e chame o líder se o cliente insistir.`, [
      prova("Um pai pede cerveja para o filho de 16 anos. O que fazer?", ["Servir, porque o pai autorizou", "Servir só um copo", "Não servir e oferecer opção sem álcool"], 2, "Autorização dos pais não muda a regra."),
      situacao("Um jovem sem documento pede um gin, e você tem dúvida da idade.", ["Servir, pois ele parece adulto", "Não servir sem documento e chamar o líder se insistir", "Servir pouca bebida"], 1, "Sem comprovar a idade, não sirva."),
    ], FONTE_ECA),
    aula("b-res-2", "Cliente embriagado", 5, `
Sinais: fala arrastada, perda de equilíbrio, voz alta, irritação, confusão.

Quando notar:
1. Avise o líder.
2. Pare de oferecer álcool.
3. Ofereça água e algo para comer.
4. Se ele pedir mais, diga em voz baixa e com respeito que não pode servir.
5. Nunca discuta, não toque na pessoa e não exponha o cliente.

Se ele for dirigir, avise o líder para ajudar a chamar um carro ou contato.`, [
      prova("Quem decide como lidar com cliente embriagado?", ["Só você", "O líder deve ser avisado", "Os outros clientes"], 1, "Essa situação não deve ser resolvida sozinho."),
      situacao("Um cliente visivelmente embriagado exige outra dose e levanta a voz.", ["Servir para evitar confusão", "Discutir na frente de todos", "Manter a calma, recusar com respeito, oferecer água e chamar o líder"], 2, "Calma, respeito e o líder ao lado."),
    ]),
  ]),

  modulo("b-organizacao", "bar", 240, "Estoque e perdas do bar", "Reposição, validade e controle.", [
    aula("b-org-1", "Reposição e estoque", 5, `
Bebida parada é dinheiro parado. Bebida perdida é dinheiro jogado fora.

- Lance entrada e retirada no Héfisto, sempre.
- Identifique sucos, xaropes e frutas com etiqueta e validade.
- O que vence primeiro sai primeiro.
- Registre quebra, perda ou drink descartado. Não esconda.
- Avise antes que um item acabe.

Quebrar uma garrafa é acidente. Esconder é problema.`, [
      prova("Uma garrafa caiu e quebrou. O que fazer?", ["Registrar a perda e avisar o líder", "Esconder", "Pagar do bolso sem falar nada"], 0, "O registro mantém o estoque certo."),
      prova("Quando lançar a retirada de uma bebida do estoque?", ["No fim do mês", "Sempre que retirar", "Só em garrafas caras"], 1, "Retirada sem lançamento deixa o estoque errado."),
      situacao("O xarope aberto está sem etiqueta.", ["Usar, pois parece bom", "Separar e chamar o líder", "Etiquetar com a data de hoje"], 1, "Sem data, ninguém sabe a validade."),
    ]),
  ]),

  pratos("p-bar-conhecer", "bar", 250, "Conhecer os drinks", "Todos os drinks da casa, com o que vai em cada um.", "bar", "conhecer"),
  pratos("p-bar-montar", "bar", 260, "Como montar cada drink", "Ingredientes, copo, gelo, método e guarnição. O líder confirma quando você faz sozinho.", "bar", "montar"),
  pratos("p-bar-preparar", "bar", 270, "Como preparar as bases", "Xaropes e preparos do bar. O líder confirma quando você faz sozinho.", "bar", "preparar"),
];
