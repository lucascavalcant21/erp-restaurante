import { aula, modulo, prova, situacao, FONTE_RDC } from "./base.mjs";

export const GERAL = [
  modulo("g-casa", "geral", 10, "Bem-vindo à casa", "Quem somos, como é o seu primeiro dia e como usar o Héfisto.", [
    aula("g-casa-1", "Nossa casa", 5, `
[PREENCHER: conte a história do restaurante, o que a casa serve e por que ela existe.]

[PREENCHER: escreva o que nunca pode faltar no atendimento e na comida da casa.]

[PREENCHER: dias e horários de funcionamento, e quem são os líderes de cada área.]

Quando tiver dúvida sobre o jeito da casa, pergunte ao seu líder. Perguntar nunca é erro. Errado é adivinhar quando o cliente ou a segurança dependem da resposta.`, [
      prova("Você não sabe como a casa faz uma coisa. O que fazer?", ["Fazer do seu jeito", "Perguntar ao líder", "Esperar alguém perceber"], 1, "Perguntar evita o erro. Ninguém espera que você saiba tudo no começo."),
    ]),
    aula("g-casa-2", "Seu primeiro dia", 5, `
Chegue antes do horário, com tempo para se trocar e estar pronto na hora de começar.

Antes de começar:
- bata o ponto no Héfisto;
- vista o uniforme limpo e completo;
- procure o seu líder e diga que chegou.

Nos primeiros dias, sua função é observar, perguntar e repetir. Anote o que aprender. Se não entendeu, peça para mostrarem de novo.

Se for faltar ou atrasar, avise o líder o quanto antes. Quem avisa dá tempo de reorganizar a equipe.`, [
      prova("Qual é a primeira coisa a fazer ao chegar?", ["Ir direto para a sua área", "Bater o ponto e se preparar", "Tomar café antes de tudo"], 1, "O ponto registra sua chegada. Depois vêm uniforme e apresentação ao líder."),
      situacao("O ônibus quebrou e você vai chegar 40 minutos atrasado.", ["Chegar e explicar depois", "Avisar o líder agora", "Faltar para não passar vergonha"], 1, "Avisar agora dá tempo para o líder reorganizar a equipe."),
    ]),
    aula("g-casa-3", "O Héfisto no seu dia", 5, `
O Héfisto é o sistema do restaurante. Entre sempre com a sua conta e nunca use a de outra pessoa: tudo que você registra fica com o seu nome.

Com ele você pode, conforme a sua função:
- bater o ponto;
- fazer este treinamento;
- consultar fichas técnicas;
- lançar entrada e retirada no estoque;
- imprimir etiquetas;
- preencher checklists.

Se uma tela não abrir, sua conta talvez não tenha essa permissão. Fale com o líder. Não peça a senha de um colega.`, [
      prova("Um colega oferece a senha dele para você usar. O que fazer?", ["Usar só desta vez", "Anotar para depois", "Recusar e falar com o líder"], 2, "Cada registro fica no nome de quem entrou. A sua conta é só sua."),
    ]),
  ]),

  modulo("g-comportamento", "geral", 20, "Postura e convivência", "Como trabalhamos juntos, em qualquer área.", [
    aula("g-comp-1", "Trabalho em equipe", 5, `
Restaurante funciona em cadeia: quando uma pessoa falha, o cliente sente lá na frente.

No dia a dia:
- fale com clareza e confirme o que entendeu;
- ofereça ajuda quando terminar a sua parte;
- avise antes de faltar um item, não depois;
- resolva o problema primeiro e procure o motivo depois;
- leve desentendimentos ao líder, nunca para a frente do cliente.

Respeito é regra: nada de apelido ofensivo, grito, piada sobre o corpo, cor, origem, religião ou orientação de alguém. Assédio de qualquer tipo deve ser levado ao líder ou ao dono.`, [
      prova("Você percebeu que um ingrediente vai acabar durante o serviço. Quando avisar?", ["Agora, antes de faltar", "Quando acabar", "No fim do turno"], 0, "Avisar antes dá tempo de buscar, trocar ou combinar com o salão."),
      situacao("Um colega fez uma piada ofensiva sobre outra pessoa da equipe.", ["Rir para não criar clima", "Não participar e avisar o líder", "Responder com outra piada"], 1, "Respeito é regra da casa. O líder precisa saber para resolver."),
    ]),
    aula("g-comp-2", "Celular, aparência e horários", 4, `
Durante o trabalho, o celular fica guardado. Use-o na pausa, fora da área de trabalho.

Aparência faz parte do serviço: uniforme limpo, cabelo preso, higiene em dia.

Respeite os horários de intervalo. Pausa combinada é direito seu e faz diferença para a equipe saber quando contar com você.

Não comente problemas da casa, de clientes ou de colegas nas redes sociais.`, [
      prova("Onde usar o celular?", ["Na bancada, com a tela virada", "Na pausa, fora da área de trabalho", "No banheiro do cliente"], 1, "Celular tira a atenção e leva sujeira para perto da comida."),
      situacao("Um cliente famoso entrou na casa e um colega quer postar uma foto dele.", ["Postar só nos stories", "Fotografar de longe", "Não postar e respeitar a privacidade"], 2, "O cliente veio comer em paz. A privacidade dele vem primeiro."),
    ]),
  ]),

  modulo("g-higiene", "geral", 30, "Higiene e segurança dos alimentos", "As regras que protegem o cliente, a equipe e a casa. Vale para todas as áreas.", [
    aula("g-hig-1", "Sua higiene pessoal", 6, `
Quem toca em alimento segue estas regras:
- cabelo preso e coberto com touca ou rede;
- sem barba;
- unhas curtas, sem esmalte ou base;
- sem anel, brinco, relógio, pulseira e maquiagem durante o preparo;
- uniforme limpo e compatível com a função.

Lave bem as mãos:
- ao chegar ao trabalho;
- antes e depois de mexer com alimento;
- depois de qualquer interrupção;
- depois de tocar em lixo, dinheiro, celular ou outro material sujo;
- depois de usar o banheiro.

Perto do alimento, não fume, não coma, não cante, não assobie, não fale sem necessidade, não tussa nem espirre sobre a comida e não mexa em dinheiro.

Se estiver doente, com diarreia, vômito, ferida ou corte, avise o líder antes de começar. Quem tem problema de saúde que possa contaminar o alimento sai do preparo até melhorar.`, [
      prova("Quando lavar as mãos?", ["Só ao chegar e ao sair", "Ao chegar, antes e depois de mexer com alimento, depois de interrupções e do banheiro", "Só quando estiverem visivelmente sujas"], 1, "Mão limpa não é só a que parece limpa. A regra vale para cada um desses momentos."),
      prova("O que pode ser usado por quem prepara alimento?", ["Touca e unhas curtas sem esmalte", "Aliança lisa", "Relógio com pulseira de silicone"], 0, "Adornos saem durante o preparo, inclusive aliança e relógio."),
      situacao("Você acordou com diarreia, mas está escalado para a cozinha.", ["Ir e não contar a ninguém", "Tomar remédio e seguir normalmente", "Avisar o líder antes de começar"], 2, "Sintoma assim pode contaminar a comida. O líder decide como fica o seu turno."),
    ], FONTE_RDC),
    aula("g-hig-2", "Temperaturas que protegem", 7, `
Bactéria cresce no calor morno. Decore estes números da regra sanitária:

- Cozinhar: todas as partes do alimento chegam a 70 °C ou mais.
- Óleo de fritura: no máximo 180 °C. Troque quando mudar o cheiro ou o sabor, ou quando formar muita espuma ou fumaça.
- Manter quente: acima de 60 °C, por no máximo 6 horas.
- Resfriar comida pronta: de 60 °C até 10 °C em no máximo 2 horas.
- Guardar na geladeira: abaixo de 5 °C. Comida pronta a 4 °C ou menos dura no máximo 5 dias.
- Congelar: a -18 °C ou menos.
- Descongelar: na geladeira, abaixo de 5 °C. Nunca em cima da bancada.
- Alimento descongelado e não usado fica na geladeira e não volta ao freezer.

Perecível só fica fora da geladeira o tempo mínimo do preparo. Se o prazo da casa for menor que o da regra, vale o da casa.`, [
      prova("Até que temperatura o alimento precisa chegar na cocção?", ["50 °C", "60 °C", "70 °C em todas as partes"], 2, "70 °C em todas as partes, inclusive no meio da peça."),
      prova("Como descongelar uma carne?", ["Na bancada, desde cedo", "Na geladeira, abaixo de 5 °C", "De molho em água morna"], 1, "O descongelamento é feito sob refrigeração."),
      prova("Por quanto tempo a comida pode ficar quente acima de 60 °C?", ["No máximo 6 horas", "O dia inteiro", "No máximo 12 horas"], 0, "Depois de 6 horas, a regra não permite manter o alimento exposto."),
      prova("Em quanto tempo a comida pronta deve ir de 60 °C a 10 °C?", ["Em até 8 horas", "Em até 2 horas", "Não há limite se estiver tampada"], 1, "Quanto mais rápido passar pela faixa morna, mais seguro."),
      situacao("Sobrou carne descongelada e não vai ser usada hoje.", ["Devolver ao freezer", "Deixar na bancada até amanhã", "Manter na geladeira, identificada, sem recongelar"], 2, "Descongelado não volta ao freezer."),
    ], FONTE_RDC),
    aula("g-hig-3", "Contaminação cruzada e alérgenos", 6, `
Contaminação cruzada é levar sujeira ou bactéria de um lugar para outro, como de um alimento cru para um pronto.

Para evitar:
- separe cru de pronto na bancada e na geladeira;
- troque ou higienize tábua, faca e utensílio entre um alimento e outro;
- lave as mãos ao trocar de tarefa;
- deixe o pronto sempre protegido.

Alergia pode matar. Um traço de camarão, leite, amendoim ou glúten basta para causar reação grave. Quando houver pedido de cliente com alergia:
- confirme o ingrediente na ficha;
- avise o líder;
- use utensílio e superfície limpos;
- se não houver certeza, diga que não há certeza. Nunca chute.

Alimento cru consumido sem cozimento, como salada e fruta, precisa ser higienizado com produto regularizado, seguindo a instrução dele.`, [
      prova("O que é contaminação cruzada?", ["Levar contaminação de um alimento ou superfície para outro", "Misturar dois temperos", "Cozinhar duas coisas juntas"], 0, "A tábua da carne crua usada na salada é o exemplo clássico."),
      situacao("Um cliente com alergia a camarão pede um prato. A panela acabou de ser usada com camarão.", ["Usar a mesma panela, passando um pano", "Usar panela e utensílios limpos e avisar o líder", "Retirar o camarão do prato pronto"], 1, "Traços bastam para causar reação. Comece limpo."),
      situacao("Perguntam se um prato tem amendoim e você não sabe.", ["Dizer que não tem", "Dizer que acha que não tem", "Dizer que vai confirmar e checar a ficha"], 2, "Nunca chute sobre alergia."),
    ], FONTE_RDC),
    aula("g-hig-4", "Limpeza, lixo e identificação", 5, `
Limpeza faz parte do preparo. Limpe enquanto trabalha.

Lixo:
- recipientes identificados, íntegros e fáceis de lavar;
- nas áreas de preparo e estoque, tampa que abre sem usar a mão;
- retire com frequência e leve para o local fechado, longe do preparo.

Identificação:
Todo alimento preparado que vai para geladeira ou freezer leva etiqueta com nome, data de preparo e validade. Produto aberto ou fracionado leva nome, data do fracionamento e nova validade.

No estoque, respeite a validade: o que vence primeiro sai primeiro. Produto vencido não fica junto dos demais: separe, identifique e avise o líder.

Use as etiquetas do Héfisto. Pote sem etiqueta é pote sem história.`, [
      prova("O que a etiqueta precisa ter, no mínimo?", ["Nome do produto, data de preparo e validade", "Só o nome do produto", "Nome de quem preparou"], 0, "Esses três dados são o mínimo."),
      situacao("Você encontra um pote na geladeira sem etiqueta.", ["Colocar uma etiqueta com a data de hoje", "Usar e não comentar", "Separar e chamar o líder"], 2, "Sem saber quando foi feito, ninguém pode garantir a validade."),
      prova("Em que ordem usar os produtos?", ["O mais novo primeiro", "O que vence primeiro sai primeiro", "O que estiver mais à mão"], 1, "Assim nada vence esquecido no fundo."),
    ], FONTE_RDC),
  ]),

  modulo("g-seguranca", "geral", 40, "Segurança e emergências", "Como evitar acidentes e o que fazer quando eles acontecem.", [
    aula("g-seg-1", "Prevenir acidentes", 5, `
Os acidentes mais comuns em restaurante são corte, queimadura, queda e fogo.

- Piso molhado: seque na hora ou sinalize.
- Facas: use a faca certa e afiada, nunca a deixe dentro da pia, e não tente pegar uma faca que está caindo.
- Panela quente: use pano seco e avise "quente, passando".
- Atrás de alguém: avise "atrás".
- Equipamento: só use depois de aprender. Desligue antes de limpar.
- Sapato: fechado e antiderrapante.`, [
      prova("Uma faca está caindo da bancada. O que fazer?", ["Tentar segurar", "Deixar cair e se afastar", "Chutar para o lado"], 1, "Tentar segurar uma faca caindo causa cortes graves."),
      prova("Antes de limpar um equipamento elétrico:", ["Desligue-o da energia", "Reduza a velocidade", "Peça para alguém segurar"], 0, "Equipamento ligado é risco de corte e choque."),
    ]),
    aula("g-seg-2", "Quando algo dá errado", 6, `
Corte: pare, lave, comprima com pano limpo e chame o líder. Se o corte for fundo ou não parar de sangrar, chame ajuda médica. Alimento que recebeu sangue é descartado.

Queimadura: coloque em água corrente fria. Não use gelo, pasta de dente, manteiga ou pomada caseira. Não estoure bolhas. Avise o líder.

Fogo em panela com óleo: desligue o fogo se for seguro e abafe com a tampa. Nunca jogue água.

Cheiro de gás: não acenda nada, não mexa em interruptor, feche o registro se souber onde fica, abra portas e janelas, tire as pessoas do local e avise o líder.

Emergência:
- SAMU: 192;
- Bombeiros: 193.

[PREENCHER: onde ficam o extintor, o registro de gás, a caixa de primeiros socorros e a saída de emergência.]`, [
      prova("Fogo no óleo da panela. O que fazer?", ["Jogar água", "Abafar com a tampa e desligar o fogo, se for seguro", "Levar a panela para a pia"], 1, "Água em óleo quente espalha o fogo."),
      prova("Qual é o primeiro cuidado em uma queimadura?", ["Passar manteiga", "Colocar pasta de dente", "Colocar em água corrente fria"], 2, "Água corrente fria. Nada de receita caseira."),
      situacao("Você sente forte cheiro de gás ao abrir a cozinha.", ["Acender a luz para procurar o vazamento", "Não acender nada, ventilar, tirar as pessoas e avisar", "Ligar o exaustor"], 1, "Qualquer faísca, até de interruptor, é perigosa."),
      situacao("Um colega se cortou e sangrou em cima de uma preparação.", ["Descartar o alimento e cuidar do colega", "Tirar só a parte de cima", "Servir, pois vai ao fogo depois"], 0, "Alimento com sangue não pode ser aproveitado."),
    ]),
  ]),
];
