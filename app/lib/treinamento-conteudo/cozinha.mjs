import { aula, modulo, pratos, prova, situacao, FONTE_RDC } from "./base.mjs";

export const COZINHA = [
  modulo("c-conhecer", "cozinha", 110, "Conhecendo a cozinha", "A área, as praças, os equipamentos e a rotina.", [
    aula("c-con-1", "A cozinha e as praças", 6, `
Seu líder vai caminhar com você por toda a cozinha. Olhe, pergunte e anote.

Conheça:
- onde o alimento entra e onde fica guardado;
- onde é o pré-preparo, onde é o fogão e onde sai o prato;
- onde ficam utensílios, panelas e produtos de limpeza;
- quem responde por cada praça.

Uma praça é um posto de trabalho: fogão, fritura, frios, finalização. Cada uma tem o que precisa à mão. Manter a sua praça arrumada é parte do trabalho.

[PREENCHER: nomes das praças da casa e quem é o responsável por cada uma.]`, [
      prova("O que é uma praça?", ["O salão", "Um posto de trabalho da cozinha", "A área do lixo"], 1, "Cada praça concentra o que é preciso para aquele preparo."),
    ]),
    aula("c-con-2", "Equipamentos", 5, `
Antes de usar qualquer equipamento, peça para alguém ensinar. Consulte também os Guias de uso no Héfisto.

Regras:
- leia a temperatura da geladeira e do freezer nos Controles;
- não sobrecarregue equipamentos;
- desligue da energia antes de limpar;
- não deixe faca dentro de pia com água;
- avise qualquer defeito na hora.

Equipamento quebrado sem aviso vira problema no meio do serviço.`, [
      prova("A geladeira marca temperatura acima do normal. O que fazer?", ["Avisar o líder e registrar agora", "Esperar o próximo turno", "Colocar menos comida e não falar nada"], 0, "Alimento perecível fora da temperatura corre risco. Avise na hora."),
    ]),
    aula("c-con-3", "Abertura e fechamento", 5, `
A cozinha tem checklists de abertura e fechamento no Héfisto. Eles não são burocracia: garantem que nada foi esquecido.

Na abertura, confira temperaturas, limpeza, gás, mise en place e validade.

No fechamento, guarde tudo identificado, limpe a praça, retire o lixo, desligue o que deve ser desligado e confira gás e geladeiras.

Marque apenas o que você fez de verdade. Marcar sem fazer é pior do que não marcar, porque o próximo turno confia nisso.`, [
      prova("Faltou um item do checklist e o turno acabou. O que fazer?", ["Marcar assim mesmo", "Deixar em branco e avisar o líder", "Apagar o checklist"], 1, "O checklist precisa dizer a verdade. Avise o que ficou pendente."),
      situacao("Seu colega pede para você marcar o checklist dele.", ["Marcar para ajudar", "Não marcar: cada um registra o que fez", "Marcar só os itens fáceis"], 1, "O registro fica no seu nome, e você não viu aquilo ser feito."),
    ]),
  ]),

  modulo("c-preparo", "cozinha", 120, "Pré-preparo e organização", "O que acontece antes do pedido chegar.", [
    aula("c-pre-1", "Mise en place", 5, `
Mise en place é deixar tudo pronto antes do serviço: cortado, porcionado, identificado e no lugar.

Boa praça tem:
- o que você vai usar à mão;
- quantidade certa para o movimento do dia;
- utensílios limpos;
- bancada livre para trabalhar.

Veja a Produção do dia e o Memorando de amanhã no Héfisto para saber o que preparar.`, [
      prova("O que é mise en place?", ["A limpeza final", "Deixar tudo pronto antes do serviço", "O prato do dia"], 1, "Sem mise en place, o serviço trava."),
      situacao("Você vê na Produção do dia um item que não sabe fazer.", ["Tentar adivinhar", "Pular o item", "Pedir ajuda e consultar a ficha"], 2, "A ficha e o líder garantem o padrão."),
    ]),
    aula("c-pre-2", "Ficha técnica: a receita da casa", 6, `
A ficha técnica é a receita oficial. Ela define ingredientes, quantidades, rendimento e preparo. O cliente precisa receber o mesmo prato hoje e daqui a um mês, não importa quem fez.

Por isso:
- siga a ficha, sem mudar por conta própria;
- use balança e medidas, não o olho;
- se achar que dá para melhorar, fale com o líder;
- se a ficha estiver sem informação, avise o líder.

Mudar a quantidade também muda o custo. Porção maior sem querer é prejuízo.`, [
      prova("Por que usar balança no preparo?", ["Para manter o padrão e o custo", "Porque a cozinha exige, sem motivo", "Só para o cliente ver"], 0, "Sem medida, não há padrão nem controle de custo."),
      situacao("Você acha que o molho ficaria melhor com mais sal do que pede a ficha.", ["Colocar mais sal", "Seguir a ficha e sugerir ao líder", "Mudar só hoje para testar"], 1, "Mudança passa pelo líder, para valer para todos."),
    ]),
    aula("c-pre-3", "Recebimento, estoque e etiquetas", 6, `
Ao receber mercadoria:
- local limpo e protegido;
- embalagem íntegra;
- validade conferida;
- temperatura conferida no que precisa de frio;
- produto com problema não entra: avise o líder.

No estoque, registre toda entrada e retirada no Héfisto. Se você tirou e não lançou, o número fica errado, e alguém vai comprar errado.

Nas prateleiras, nada direto no chão. Guarde com a validade à vista.`, [
      prova("A embalagem de um produto chegou violada. O que fazer?", ["Aceitar e usar logo", "Não aceitar e chamar o líder", "Trocar de embalagem"], 1, "Embalagem íntegra é item da conferência."),
      prova("Você retirou um produto do estoque. O que fazer?", ["Lançar a retirada no Héfisto", "Avisar no fim do mês", "Nada, se for pouco"], 0, "O estoque só está certo se tudo for lançado."),
    ], FONTE_RDC),
  ]),

  modulo("c-servico", "cozinha", 130, "Hora do serviço", "Pedido entra, prato sai certo e na hora.", [
    aula("c-ser-1", "Pedido, tempo e comunicação", 6, `
No serviço, atenção vale mais que pressa.

- Acompanhe os pedidos na tela da cozinha (KDS).
- Confirme em voz alta o que vai fazer.
- Avise quanto tempo falta quando perguntarem.
- Termine os pratos da mesma mesa juntos.
- Avise imediatamente se faltar um ingrediente.
- Antes de sair, olhe o prato: limpo, completo, igual ao padrão e na temperatura certa.

Prato duvidoso não sai. Refazer custa menos que perder o cliente.`, [
      prova("O que conferir antes do prato sair?", ["Só se está quente", "Se está limpo, completo, no padrão e na temperatura certa", "Só a aparência"], 1, "O prato só sai quando tudo está certo."),
      situacao("Acabou um ingrediente de um prato do cardápio em pleno serviço.", ["Trocar por outro sem avisar", "Avisar o líder e o salão na hora", "Atrasar o pedido sem falar nada"], 1, "O salão precisa saber para não vender mais e oferecer alternativa."),
    ]),
    aula("c-ser-2", "Quando o prato volta", 5, `
Prato devolvido não é ataque pessoal. É uma informação.

1. Escute o que o salão trouxe.
2. Avise o líder.
3. Refaça com prioridade.
4. Olhe o motivo com calma depois do serviço.

Comida que voltou da mesa do cliente não é reaproveitada.

Se houver suspeita de alimento estragado ou objeto no prato, guarde o prato e chame o líder. Não jogue fora antes de ele ver.`, [
      situacao("Um prato voltou porque o cliente achou um cabelo.", ["Tirar o cabelo e devolver", "Guardar o prato, chamar o líder e refazer", "Dizer que não é da cozinha"], 1, "Refaça do zero e deixe o líder ver o que aconteceu."),
      prova("O que fazer com a comida que voltou da mesa?", ["Reaproveitar", "Servir aos funcionários", "Não reaproveitar"], 2, "Depois de ir à mesa, o alimento não retorna ao preparo."),
    ]),
  ]),

  modulo("c-coccao", "cozinha", 140, "Cocção e padrão", "Para cozinheiros: controlar fogo, tempo e finalização.", [
    aula("c-coc-1", "Controlar a cocção", 7, `
Cozinheiro controla três coisas: temperatura, tempo e ponto.

- Aqueça a panela antes de selar. Panela fria solta água e não doura.
- Não encha demais a panela ou a fritadeira: a temperatura cai.
- Prove antes de servir, sempre com colher limpa.
- Lembre: todas as partes do alimento precisam atingir 70 °C, a não ser que a casa tenha outro procedimento validado.

Molhos, caldos e bases também têm ficha. Mantenha-os na temperatura certa durante o serviço e resfrie rápido o que sobrar.`, [
      prova("Por que não encher demais a fritadeira?", ["Porque a temperatura do óleo cai", "Porque gasta menos óleo", "Porque frita mais rápido"], 0, "Com muita comida, o óleo esfria e o alimento encharca."),
      prova("Como provar a comida?", ["Com a colher da panela, devolvendo depois", "Com colher limpa a cada vez", "Com o dedo limpo"], 1, "Colher usada volta com contaminação."),
      situacao("O centro da peça não chegou à temperatura e o pedido está atrasado.", ["Mandar assim mesmo", "Terminar a cocção e avisar sobre o atraso", "Trocar o prato sem avisar"], 1, "Segurança vem antes de pressa. Avise o salão."),
    ], FONTE_RDC),
    aula("c-coc-2", "Finalização e empratamento", 5, `
O prato é a assinatura da casa. Monte igual à foto e ao guia de montagem.

- Limpe a borda do prato.
- Respeite o tamanho da porção.
- Coloque cada item no lugar definido.
- Confira quente com quente e frio com frio.

Se o guia não tiver foto ou passo a passo, peça ao líder para completar a ficha. Ninguém deve montar pela memória de outra pessoa.`, [
      prova("O guia de um prato está incompleto. O que fazer?", ["Montar do seu jeito", "Pedir ao líder para completar", "Tirar o prato da lista"], 1, "O guia completo evita que cada pessoa monte diferente."),
    ]),
  ]),

  pratos("p-coz-conhecer", "cozinha", 150, "Conhecer os pratos", "Todos os pratos da cozinha, com o que vai em cada um.", "cozinha", "conhecer"),
  pratos("p-coz-montar", "cozinha", 160, "Como montar cada prato", "Ingredientes, guia de montagem e foto. O líder confirma quando você monta sozinho.", "cozinha", "montar"),
  pratos("p-coz-preparar", "cozinha", 170, "Como cozinhar cada prato", "Modo de preparo de cada ficha. O líder confirma quando você faz sozinho.", "cozinha", "preparar"),
];
