import { aula, modulo, pratos, prova, situacao } from "./base.mjs";

export const SALAO = [
  modulo("s-conhecer", "salao", 310, "Conhecendo o salão", "Mesas, setores e rotina.", [
    aula("s-con-1", "O salão e a rotina", 6, `
Seu líder vai apresentar o salão. Aprenda:
- número de cada mesa e setor;
- onde ficam talheres, guardanapos, cardápios e materiais;
- como chegar à cozinha e ao bar sem atrapalhar o cliente;
- quem atende cada setor.

Antes de abrir, siga o checklist: mesas limpas e alinhadas, cadeiras firmes, cardápios limpos, banheiro conferido, som e luz ajustados.

Depois que o cliente sai, a mesa volta ao padrão o mais rápido possível.

[PREENCHER: mapa das mesas e setores da casa.]`, [
      prova("Por que decorar o número das mesas?", ["Para entregar o pedido certo sem perguntar", "Para limpar menos", "Não é necessário"], 0, "Saber a mesa evita erro e demora."),
      prova("O que fazer antes de abrir o salão?", ["Seguir o checklist de abertura", "Esperar o primeiro cliente", "Só acender as luzes"], 0, "O checklist garante que nada foi esquecido."),
      situacao("Faltando 5 minutos para abrir, você vê uma cadeira quebrada em uma mesa reservada.", ["Deixar como está", "Trocar a cadeira e avisar o líder", "Esconder o defeito com uma almofada"], 1, "Segurança do cliente primeiro. O líder precisa saber do defeito."),
    ]),
  ]),

  modulo("s-apoio", "salao", 315, "Apoio ao salão", "O trabalho do cumim, que sustenta o serviço.", [
    aula("s-apo-1", "Mesa, talheres e retirada", 6, `
O cumim mantém o salão funcionando.

- Pegue talheres pelo cabo e taças pela haste ou pela base.
- Polir é tirar marcas com pano limpo e seco.
- Retire pratos só quando todos à mesa terminarem, salvo pedido do cliente.
- Pergunte com discrição: "posso retirar?"
- Mantenha as praças abastecidas.
- Ajude o garçom sem interromper a conversa do cliente.`, [
      prova("Como segurar uma taça limpa?", ["Pela boca", "Pela haste ou pela base", "Com os dedos dentro"], 1, "Ninguém quer beber onde um dedo tocou."),
      prova("Quando retirar os pratos da mesa?", ["Assim que o primeiro terminar", "Quando todos terminarem, salvo pedido do cliente", "No momento da conta"], 1, "Retirar cedo apressa quem ainda está comendo."),
      situacao("Um cliente pede a você um prato do cardápio, e o garçom dele está longe.", ["Dizer que não é sua função", "Avisar o garçom na hora, com gentileza", "Anotar e esquecer"], 1, "Para o cliente, todos somos a casa."),
    ]),
  ]),

  modulo("s-atendimento", "salao", 320, "A sequência do atendimento", "Do bom-dia ao até logo.", [
    aula("s-ate-1", "Receber e apresentar", 6, `
A primeira impressão acontece nos primeiros segundos.

1. Receba com sorriso e contato visual.
2. Conduza até a mesa, sem andar rápido demais.
3. Entregue o cardápio e apresente-se.
4. Ofereça água e bebidas.
5. Conte as sugestões do dia e o que acabou.
6. Dê tempo para escolher, mas fique por perto.

Nunca deixe a mesa sem atendimento porque "não é do seu setor". Avise o colega ou atenda.`, [
      prova("O que informar logo ao chegar à mesa?", ["Os pratos do dia e o que acabou", "O salário da equipe", "Só o preço mais alto"], 0, "Evita a frustração de pedir o que não tem."),
      situacao("Uma mesa chega no meio da correria e seu setor está cheio.", ["Ignorar até ter tempo", "Cumprimentar, deixar o cardápio e dizer que já volta", "Pedir que voltem depois"], 1, "Reconhecer a mesa acalma a espera."),
    ]),
    aula("s-ate-2", "Pedido, entrega e acompanhamento", 7, `
Pedido:
- anote e repita para confirmar;
- pergunte sobre alergias ou restrições;
- confirme ponto, acompanhamento e bebida;
- lance imediatamente no sistema, na mesa certa.

Entrega:
- leve os pratos juntos;
- sirva sem perguntar "de quem é";
- diga o nome do prato ao colocar na mesa.

Acompanhamento:
- em até dois minutos, veja se está tudo certo;
- ofereça mais bebida antes de o copo esvaziar;
- retire o que não está em uso;
- ofereça sobremesa e café.

Conta:
- leve quando pedirem, sem deixar o cliente esperando;
- confira a conta antes de levar;
- agradeça e convide para voltar.`, [
      prova("Quando lançar o pedido no sistema?", ["Imediatamente", "Quando a cozinha pedir", "No fim do turno"], 0, "Cada minuto de atraso é um minuto na espera do cliente."),
      prova("O que perguntar sempre ao anotar o pedido?", ["Sobre alergias e restrições", "A idade do cliente", "Quanto ele pretende gastar"], 0, "Essa pergunta pode salvar uma vida."),
      situacao("O cliente pede o bife ao ponto e você esqueceu de anotar o ponto.", ["Deixar a cozinha decidir", "Voltar à mesa e confirmar antes de lançar", "Lançar como bem passado"], 1, "Confirmar custa um minuto. Refazer custa muito mais."),
    ]),
  ]),

  modulo("s-comportamento", "salao", 330, "Comportamento do garçom", "Como se portar diante do cliente.", [
    aula("s-com-1", "Postura e aparência", 5, `
O garçom é a cara da casa. O cliente lê tudo em você.

- Uniforme limpo e completo, sapato limpo, cabelo arrumado, unhas limpas e sem perfume forte.
- Coluna reta, mãos livres, nada de encostar em paredes ou mesas.
- Não mexa no celular.
- Não coma nem masque chiclete à vista.
- Não converse alto com colegas nem fale de cliente perto de outro cliente.
- Olhe sempre para o salão: a mesa não deve precisar chamar você.

Nunca toque no cliente, sente-se à mesa ou entre na conversa dele sem ser convidado.`, [
      prova("Como saber que uma mesa precisa de algo?", ["Esperar chamar", "Olhar sempre para o salão", "Perguntar a cada minuto"], 1, "Serviço bom se antecipa."),
      prova("O que não se faz diante do cliente?", ["Sorrir", "Falar de outro cliente", "Agradecer"], 1, "O que você diz de um cliente perto de outro afasta os dois."),
    ]),
    aula("s-com-2", "Como falar com o cliente", 5, `
Linguagem:
- diga "senhor" e "senhora" até o cliente pedir outro tratamento;
- não use gírias nem apelidos, como "amigão" ou "querida";
- fale "acabou por hoje", nunca "sei lá";
- nunca diga "não é comigo";
- nunca discuta nem responda com ironia.

Trate todas as mesas com a mesma atenção, não importa a roupa, a cor, a idade, a conta ou quem acompanha o cliente.

Se o cliente for mal-educado, mantenha o tom, respire e, se for preciso, chame o líder. Não responda no mesmo nível.`, [
      prova("Qual frase é adequada?", ["Isso não é comigo", "Vou verificar e já retorno", "Sei lá"], 1, "Mostre que vai resolver, mesmo sem saber a resposta."),
      situacao("Um cliente fala de forma grosseira com você.", ["Responder no mesmo tom", "Manter a calma, resolver o que puder e chamar o líder se preciso", "Ignorar a mesa"], 1, "Você representa a casa. O líder ajuda quando passar do limite."),
      situacao("Um cliente faz uma cantada ou comentário que deixa você desconfortável.", ["Aguentar calado", "Sair da situação e avisar o líder, que assume a mesa", "Xingar o cliente"], 1, "Ninguém precisa aceitar assédio. O líder assume."),
    ]),
  ]),

  modulo("s-mesas", "salao", 318, "Como montar as mesas", "A mesa pronta para receber o cliente.", [
    aula("s-mes-1", "A mesa padrão", 6, `
Uma mesa bem montada mostra cuidado antes do primeiro pedido.

Antes de montar:
- limpe e seque o tampo;
- confira se a mesa não balança;
- alinhe as cadeiras;
- confira toalha ou jogo americano, sem manchas.

A posição clássica dos itens:
- garfo à esquerda do prato;
- faca à direita, com o fio voltado para o prato;
- colher, quando houver, à direita da faca;
- copo de água acima da ponta da faca;
- taça de vinho ao lado do copo de água, quando fizer parte do serviço;
- guardanapo limpo e dobrado.

Talheres e taças são pegos pelo cabo e pela haste. Confira contra a luz antes de colocar na mesa.

[PREENCHER: o padrão de mesa da casa: louça, guardanapo, itens fixos e foto da mesa pronta.]`, [
      prova("Onde fica o garfo na posição clássica?", ["À esquerda do prato", "À direita do prato", "Em cima do prato"], 0, "Garfo à esquerda, faca e colher à direita."),
      prova("Para que lado fica o fio da faca?", ["Para fora", "Para o prato", "Para cima"], 1, "O fio fica voltado para o prato."),
      situacao("A mesa está pronta, mas a taça tem uma marca de dedo.", ["Deixar assim", "Trocar ou polir antes de abrir", "Virar a marca para o outro lado"], 1, "A taça é a primeira coisa que o cliente vê de perto."),
    ]),
    aula("s-mes-2", "Reposição entre clientes", 5, `
Entre um cliente e outro, a mesa volta ao padrão.

1. Retire tudo da mesa.
2. Limpe tampo e cadeiras, inclusive os farelos do assento.
3. Remonte a mesa com itens limpos.
4. Alinhe as cadeiras.
5. Avise que a mesa está liberada.

Faça isso rápido e sem barulho. Quem está nas outras mesas não precisa ouvir talheres caindo.

Em mesa para mais pessoas, confira o número de lugares da reserva antes de montar.`, [
      prova("O que limpar além do tampo?", ["Nada", "As cadeiras, inclusive o assento", "Só o chão"], 1, "Farelo no assento é a primeira coisa que o próximo cliente sente."),
    ]),
  ]),

  modulo("s-bebidas", "salao", 335, "Como servir vinho e outras bebidas", "O serviço correto de cada bebida à mesa.", [
    aula("s-beb-1", "Servir vinho", 7, `
Sequência do serviço de vinho:
1. Apresente a garrafa a quem pediu, com o rótulo à vista, e confirme nome e safra.
2. Sobre o aparador ou a mesa, corte a cápsula abaixo da borda do gargalo.
3. Use o saca-rolhas sem girar a garrafa e tire a rolha sem barulho.
4. Limpe o gargalo com um guardanapo.
5. Sirva uma pequena dose para quem pediu provar.
6. Com a aprovação, sirva as outras pessoas e termine em quem provou.
7. Sirva sem encher a taça: cerca de um terço, para o vinho poder respirar.
8. Ao terminar, gire de leve a garrafa para não pingar.

Segure a garrafa pelo corpo, sem cobrir o rótulo, e não encoste o gargalo na taça.

Temperaturas de referência:
- espumantes: de 6 °C a 8 °C;
- brancos e rosés: de 8 °C a 12 °C;
- tintos leves: de 12 °C a 14 °C;
- tintos encorpados: de 16 °C a 18 °C.

Se o cliente disser que o vinho está com defeito ou cheiro ruim, não discuta. Chame o líder.`, [
      prova("Quem prova o vinho primeiro?", ["A pessoa mais velha", "Quem pediu o vinho", "Quem estiver mais perto"], 1, "Quem pediu aprova, e por último completa a própria taça."),
      prova("Quanto servir na taça?", ["Até a borda", "Cerca de um terço", "Apenas uma gota"], 1, "Taça com espaço deixa o aroma aparecer."),
      prova("Qual é a temperatura de referência para espumantes?", ["De 6 °C a 8 °C", "De 16 °C a 18 °C", "Temperatura ambiente"], 0, "Espumantes são servidos bem gelados."),
      situacao("O cliente prova e diz que o vinho está com gosto de mofo.", ["Explicar que vinho é assim mesmo", "Retirar, pedir desculpas e chamar o líder", "Provar na frente dele para discordar"], 1, "O líder conduz a troca. Não discuta."),
    ]),
    aula("s-beb-2", "Abrir espumante com segurança", 4, `
Rolha de espumante sob pressão pode machucar.

1. Mantenha a garrafa bem gelada e sem agitar.
2. Tire a cápsula e solte a gaiola, sempre com o polegar sobre a rolha.
3. Incline a garrafa e nunca aponte para ninguém.
4. Segure a rolha e gire a garrafa devagar.
5. Deixe a rolha sair com um suspiro, sem estouro.
6. Sirva aos poucos, em duas etapas, para a espuma não transbordar.`, [
      prova("O que girar ao abrir o espumante?", ["A garrafa, segurando a rolha", "Só a rolha, com força", "Nada: basta puxar"], 0, "Assim você controla a saída da rolha."),
      situacao("Um colega quer estourar o espumante para animar a mesa.", ["Deixar", "Abrir com controle, sem apontar para ninguém", "Sacudir antes"], 1, "A rolha pode ferir alguém."),
    ]),
    aula("s-beb-3", "Água, refrigerante, cerveja e café", 5, `
Água e refrigerante:
- abra na mesa ou traga com o lacre à vista;
- pergunte se quer gelo e limão;
- sirva pela direita do cliente, com o copo na mesa.

Cerveja:
- use copo limpo e seco;
- incline o copo e endireite no final para formar colarinho;
- ofereça a segunda antes de a garrafa acabar.

Café:
- sirva quente, com a asa da xícara à direita do cliente;
- leve açúcar e adoçante sem precisar pedir.

Não encha o copo até a boca. Reponha antes de esvaziar. Bebida alcoólica segue as regras de serviço responsável.

[PREENCHER: as bebidas da casa que têm serviço especial, como cachaças e bebidas regionais.]`, [
      prova("Como servir cerveja no copo?", ["Com o copo inclinado, endireitando no final", "Com o copo reto desde o início", "De bem alto, para fazer espuma"], 0, "Assim o colarinho fica no ponto."),
      prova("De que lado fica a asa da xícara?", ["À direita do cliente", "À esquerda do cliente", "Para a frente"], 0, "A maioria pega com a direita."),
      situacao("Você percebe que o copo de água de um cliente está quase vazio.", ["Esperar ele chamar", "Oferecer mais antes de esvaziar", "Trocar a mesa de setor"], 1, "Serviço bom se antecipa."),
    ]),
  ]),

  modulo("s-cardapio", "salao", 340, "Cardápio e venda", "Conhecer e sugerir, sem empurrar.", [
    aula("s-car-1", "Vender é ajudar a escolher", 6, `
Você vende melhor quando sabe do que está falando.

- Prove os pratos e drinks quando a casa oferecer.
- Saiba explicar cada prato em uma frase: o que é, como vem, para quem combina.
- Saiba o que tem pimenta, glúten, leite, camarão e outros alérgenos, consultando a ficha quando tiver dúvida.
- Sugira com base no que o cliente disse.
- Ofereça a bebida que combina, a entrada para dividir e a sobremesa no fim.

Nunca empurre o item mais caro. Cliente que se sente enganado não volta.`, [
      prova("O que você precisa saber sobre cada prato?", ["Só o preço", "O que é, como vem e para quem combina", "Só o nome"], 1, "Com isso, você ajuda o cliente a escolher."),
      prova("Qual é a melhor sugestão?", ["A do prato mais caro, sempre", "A que combina com o que o cliente disse", "A que sobrou na cozinha"], 1, "Boa sugestão parte do cliente."),
      situacao("O cliente pergunta sobre um prato que você nunca provou.", ["Inventar uma descrição", "Dizer o que sabe pela ficha e pedir ajuda se preciso", "Dizer para escolher outro"], 1, "Nunca invente. Use a ficha ou chame quem sabe."),
    ]),
  ]),

  modulo("s-situacoes", "salao", 350, "Situações inesperadas", "O método para resolver qualquer problema na mesa.", [
    aula("s-sit-1", "O método: OUVIR", 6, `
Quando algo sai errado, siga cinco passos:

O: Ouça sem interromper. Olhe para o cliente.
U: Use palavras de cuidado: "peço desculpas, vou resolver agora".
V: Verifique o que aconteceu.
I: Informe o líder e diga ao cliente o que será feito e quanto tempo levará.
R: Resolva e volte à mesa para conferir.

Regras:
- não culpe a cozinha, o bar ou um colega;
- não discuta quem tem razão;
- não prometa o que você não pode cumprir;
- descontos e cortesias só com o líder;
- quanto mais cedo o líder souber, mais fácil é resolver.

Cliente com problema bem resolvido costuma confiar mais na casa do que cliente que nunca teve problema nenhum.`, [
      prova("Quem pode dar desconto ou cortesia?", ["Qualquer garçom", "O líder", "O cumim"], 1, "Você chama o líder. Ele decide."),
      prova("O que evitar ao ouvir uma reclamação?", ["Olhar para o cliente", "Pedir desculpas", "Culpar a cozinha"], 2, "Para o cliente, a casa é uma só."),
      situacao("O cliente reclama da demora e está irritado.", ["Dizer que a cozinha está lenta", "Ouvir, pedir desculpas, verificar o pedido e informar o tempo real", "Evitar passar perto da mesa"], 1, "O silêncio piora tudo. Informe o tempo real."),
      situacao("Você levou o prato errado para a mesa.", ["Convencer o cliente a aceitar", "Pedir desculpas, retirar, avisar a cozinha e priorizar o certo", "Trocar sem dizer nada"], 1, "Assuma, peça prioridade e avise o líder."),
    ]),
    aula("s-sit-2", "Comida, bebida e acidentes", 7, `
Cabelo ou objeto no prato: peça desculpas, retire na hora, avise o líder e leve para a cozinha sem descartar.

Comida fria, passada ou diferente: ofereça refazer ou trocar e avise o líder.

Derramou algo no cliente: peça desculpas, ofereça guardanapo limpo sem tocar nele e chame o líder.

Quebrou algo: afaste as pessoas, limpe bem, com vassoura e pá, e cuide para que não sobrem cacos.

Cliente passou mal: chame o líder na hora, não dê remédio e, se for grave, ligue 192.

Reação alérgica (coceira, inchaço no rosto, falta de ar): chame o líder, ligue 192 imediatamente e guarde o prato. Não espere passar.

Engasgo ou desmaio: chame ajuda e ligue 192. Quem tiver treinamento presta os primeiros socorros.`, [
      situacao("Um cliente encontra um cabelo no prato.", ["Dizer que não é da casa", "Pedir desculpas, retirar, chamar o líder e refazer", "Tirar o cabelo com um garfo"], 1, "Retire e leve o prato para o líder ver."),
      situacao("Você derrubou vinho na roupa de uma cliente.", ["Esfregar a roupa dela", "Pedir desculpas, oferecer guardanapo e chamar o líder", "Fingir que não foi você"], 1, "O líder conduz a solução. Não toque na cliente."),
      situacao("Depois de comer, um cliente fica com o rosto inchado e com falta de ar.", ["Dar um antialérgico", "Esperar melhorar", "Chamar o líder, ligar 192 e guardar o prato"], 2, "Reação alérgica grave é emergência."),
      situacao("Um cliente passa mal e pede um remédio para você.", ["Oferecer o seu remédio", "Não dar remédio e chamar o líder", "Mandar ir ao banheiro"], 1, "Funcionário não dá remédio."),
    ]),
    aula("s-sit-3", "Conta, conflitos e imprevistos da casa", 7, `
Conta errada: peça desculpas, leve de volta, confira e corrija com o líder.

Taxa de serviço: é opcional. Se o cliente não quiser pagar, leve o pedido ao caixa ou ao líder sem discutir.

Cliente saiu sem pagar: não corra atrás nem o enfrente. Avise o líder imediatamente.

Mesa pede para dividir a conta de um jeito difícil: confirme com calma e peça ajuda ao caixa.

Briga entre clientes: não entre no meio. Chame o líder e proteja as outras mesas.

Criança correndo no salão: fale com os pais com gentileza, explicando o perigo das bandejas.

Reserva não encontrada: peça desculpas, chame o líder e não discuta.

Sistema ou internet caiu: anote os pedidos em papel, com mesa e hora, e leve ao líder. Lance tudo quando voltar.

Faltou luz: mantenha a calma, tranquilize as mesas, peça que fiquem nos lugares e aguarde o líder. Na cozinha, o líder decide o que fazer.

Pedido fora do cardápio: pergunte à cozinha ou ao líder antes de prometer.`, [
      situacao("O cliente saiu sem pagar e já está na calçada.", ["Correr atrás e segurá-lo", "Avisar o líder imediatamente, sem enfrentar", "Pagar do próprio bolso em silêncio"], 1, "Sua segurança vem primeiro."),
      situacao("O sistema caiu no pico do jantar.", ["Parar de atender", "Anotar no papel com mesa e hora e avisar o líder", "Mandar os pedidos de cabeça"], 1, "Papel com mesa e hora mantém tudo funcionando."),
      situacao("Dois clientes começam a discutir de forma agressiva.", ["Entrar no meio", "Chamar o líder e afastar as outras mesas", "Filmar"], 1, "Não entre no meio. O líder conduz."),
      situacao("O cliente não quer pagar a taxa de serviço.", ["Explicar que é obrigatória", "Retirar sem discutir, com o caixa ou o líder", "Insistir até ele pagar"], 1, "A taxa é opcional. Sem discussão."),
      situacao("Uma mesa pede um prato que não está no cardápio.", ["Prometer que sim", "Dizer não na hora", "Verificar com a cozinha ou o líder antes de responder"], 2, "Só prometa o que a casa pode entregar."),
      situacao("Faltou luz no meio do jantar.", ["Mandar todos embora", "Manter a calma, tranquilizar as mesas e aguardar o líder", "Sair para ver o que aconteceu"], 1, "Sua calma acalma o salão."),
    ]),
  ]),

  pratos("p-sal-pratos", "salao", 360, "Os pratos que você vende", "O que vai em cada prato, para explicar ao cliente.", "cozinha", "conhecer"),
  pratos("p-sal-drinks", "salao", 370, "Os drinks que você vende", "O que vai em cada drink, para explicar ao cliente.", "bar", "conhecer"),
];
