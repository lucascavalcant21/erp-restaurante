import { aula, modulo, prova, situacao } from "./base.mjs";

export const LIDERANCA = [
  modulo("l-lideranca", "gestao", 410, "Liderança de equipe", "Conduzir pessoas na correria.", [
    aula("l-lid-1", "Liderar pelo exemplo", 6, `
A equipe faz o que vê, não o que ouve.

- Chegue antes, siga as regras e use o padrão que você cobra.
- Dê instruções claras: o que fazer, até quando e como saber que ficou certo.
- Elogie em público e corrija em particular.
- Assuma os erros da sua área diante do dono e do cliente.
- Decida com calma na correria. Equipe nervosa copia o líder nervoso.

Liderar não é fazer tudo: é garantir que tudo seja bem feito. Se você faz tudo sozinho, a equipe não aprende e nada funciona sem você.`, [
      prova("Como corrigir um erro de alguém da equipe?", ["Em particular, com clareza", "Na frente de todos, para servir de exemplo", "Não corrigir, para evitar conflito"], 0, "Correção em público humilha e não ensina."),
      situacao("Um cozinheiro experiente ignora a ficha e diz que sempre fez assim.", ["Deixar, pois ele é experiente", "Conversar em particular, explicar o motivo e cobrar o padrão", "Gritar no meio do serviço"], 1, "O padrão vale para todos. Explique o motivo."),
    ]),
    aula("l-lid-2", "Formar pessoas", 6, `
Você é responsável por formar quem chega.

O método é simples:
1. Mostre fazendo e explique por quê.
2. Faça junto.
3. Deixe a pessoa fazer e observe.
4. Corrija na hora, com respeito.
5. Quando ela fizer sozinha, com qualidade, várias vezes, aprove no Héfisto.

Aprove o que você viu. Marcar sem ter visto coloca o cliente e a equipe em risco.

Acompanhe a sua equipe em Treinamento > Equipe. Faça pequenas conversas de retorno: o que foi bem, o que melhorar e o próximo passo.`, [
      prova("Quando aprovar um item prático?", ["Quando a pessoa disser que sabe", "Quando você viu a pessoa fazer sozinha e com qualidade", "Depois de 30 dias"], 1, "O sistema confia na sua avaliação."),
      situacao("Um novato tirou nota alta na prova, mas ainda erra na prática.", ["Aprovar por causa da nota", "Não aprovar, treinar e reavaliar", "Tirar da área sem conversar"], 1, "A prática é onde o cliente sente a diferença."),
    ]),
    aula("l-lid-3", "Conflitos e conversas difíceis", 6, `
Conflito ignorado cresce.

1. Converse logo, em particular.
2. Fale do fato, não da pessoa: "ontem você chegou 30 minutos depois", não "você é irresponsável".
3. Ouça o outro lado.
4. Combine o que muda.
5. Registre e acompanhe.

Assédio, agressão, furto e desrespeito grave não são resolvidos entre colegas. Leve ao gerente ou ao dono no mesmo dia e registre o que aconteceu.`, [
      prova("Como começar uma conversa difícil?", ["Falando do fato", "Falando do caráter da pessoa", "Com uma indireta no grupo"], 0, "Fato se resolve. Rótulo gera defesa."),
      situacao("Dois funcionários discutem na frente de clientes.", ["Separar, retomar o serviço e conversar em particular depois", "Dar razão a um deles na hora", "Ignorar"], 0, "Primeiro o serviço, depois a conversa."),
      situacao("Uma funcionária relata assédio de um colega.", ["Pedir que ela resolva sozinha", "Ouvir, proteger e levar ao dono no mesmo dia", "Comentar com a equipe"], 1, "É caso sério, com sigilo e rapidez."),
    ]),
  ]),

  modulo("l-organizacao", "gestao", 420, "Organização da área", "Rotina, escala, compras e números.", [
    aula("l-org-1", "A rotina do líder", 6, `
Um dia organizado tem antes, durante e depois.

Antes do serviço:
- confira equipe, escala e ausências;
- veja reservas, eventos e previsão de movimento;
- confira checklists, validades e controles;
- faça uma reunião rápida com a equipe: o que tem hoje, o que acabou, o que vender.

Durante:
- fique onde o gargalo está;
- olhe a qualidade antes de sair;
- resolva problemas sem parar a operação.

Depois:
- confira fechamento, limpeza e perdas;
- deixe o Memorando de amanhã pronto;
- anote o que deu errado para resolver a causa.`, [
      prova("Onde o líder deve ficar no pico?", ["Onde está o gargalo", "No escritório", "No estoque"], 0, "A maior ajuda é onde o serviço trava."),
      situacao("Dois funcionários faltaram e a casa tem reservas cheias.", ["Esperar o serviço para ver", "Redistribuir funções, simplificar o que puder e avisar o gerente antes de abrir", "Cancelar todas as reservas"], 1, "Decida antes de abrir e ajuste a equipe."),
    ]),
    aula("l-org-2", "Estoque, compras e perdas", 7, `
Quem lidera a área responde pelo que entra, sai e se perde.

- Mantenha mínimos de estoque definidos no Héfisto.
- Faça a contagem no dia combinado.
- Veja o que está abaixo do mínimo antes de pedir.
- Confira a compra quando chegar: quantidade, qualidade, validade e preço.
- Registre as perdas com o motivo.
- Veja o que vence primeiro e planeje o uso.

CMV é o custo da mercadoria vendida. Em percentual, é o custo dividido pelo que foi vendido. Se o CMV sobe, procure a causa: porção maior, desperdício, preço de compra, furto ou erro de lançamento.

No Héfisto, esse número depende de faturamento lançado, ficha correta e estoque lançado. Número ruim na entrada dá decisão ruim na saída.`, [
      prova("Como se calcula o CMV em percentual?", ["Custo da mercadoria vendida dividido pelas vendas", "Vendas menos salários", "Preço de venda dividido pelo número de pratos"], 0, "O resultado mostra quanto da venda virou custo de mercadoria."),
      situacao("O CMV subiu e ninguém sabe por quê.", ["Aumentar todos os preços", "Conferir porções, perdas, compras e lançamentos", "Ignorar até o próximo mês"], 1, "Procure a causa antes de agir."),
    ]),
  ]),

  modulo("l-ficha", "gestao", 430, "Elaboração de ficha técnica", "Como criar a ficha que forma a equipe e controla o custo.", [
    aula("l-fic-1", "O que uma boa ficha tem", 7, `
Uma ficha completa responde a tudo que alguém novo precisaria saber:

- nome, categoria e área;
- ingredientes com quantidade e unidade;
- rendimento e tamanho da porção;
- modo de preparo em passos numerados;
- montagem, foto do prato pronto e guarnição;
- no bar: copo, gelo, método e guarnição;
- validade e como conservar;
- alérgenos.

Atenção: o treinamento da equipe puxa esses dados direto da ficha. Prato sem modo de preparo aparece como pendência. Ficha completa é o treinamento pronto.

Teste a ficha: peça para outra pessoa fazer o prato só lendo. Onde ela travar, a ficha precisa melhorar.`, [
      prova("Como saber se a ficha está clara?", ["Outra pessoa consegue fazer o prato só lendo", "Ela tem muitas páginas", "Foi feita pelo chefe"], 0, "A ficha precisa funcionar sem você por perto."),
      prova("O que acontece com um prato sem modo de preparo no treinamento?", ["O sistema inventa os passos", "Aparece como pendência", "É apagado"], 1, "O Héfisto não inventa receita."),
      situacao("O novato pergunta como fazer um prato cuja ficha só tem ingredientes.", ["Mandar perguntar a um colega", "Ensinar e completar a ficha com passos e foto", "Mandar adivinhar"], 1, "Ao escrever, você ensina todos os próximos."),
    ]),
    aula("l-fic-2", "Quantidade, perda e custo", 7, `
Dois pesos importam:

- Peso bruto: como o ingrediente chega.
- Peso líquido: o que sobra depois de limpar.

Fator de correção = peso bruto ÷ peso líquido.

Exemplo: 1 kg de peixe que rende 800 g depois de limpo tem fator 1,25. Para servir 800 g, você precisa comprar 1 kg.

Sem esse fator, o custo do prato fica menor do que o real.

Custo da ficha: soma do custo de cada ingrediente, usando a quantidade certa. Custo da porção: custo total dividido pelo rendimento.

CMV do prato: custo da porção dividido pelo preço de venda. Compare com a meta da casa.

Use as unidades certas: gramas e quilos, mililitros e litros. Um erro de unidade muda o custo inteiro. Sempre confira o resultado: se um prato deu um custo estranho, olhe as unidades antes de tudo.`, [
      prova("1 kg de um produto rende 500 g limpo. Qual é o fator de correção?", ["0,5", "1,5", "2"], 2, "1000 ÷ 500 = 2."),
      prova("Uma ficha custa R$ 40 e rende 8 porções. Qual é o custo da porção?", ["R$ 5", "R$ 8", "R$ 32"], 0, "R$ 40 ÷ 8 = R$ 5."),
      prova("A porção custa R$ 10 e o prato é vendido a R$ 40. Qual é o CMV do prato?", ["10%", "25%", "40%"], 1, "10 ÷ 40 = 25%."),
      situacao("Uma ficha mostra um prato simples com custo de R$ 900.", ["Publicar assim", "Conferir unidades e quantidades", "Aumentar o preço de venda"], 1, "Custo absurdo costuma ser erro de unidade, como gramas lançadas como quilos."),
    ]),
    aula("l-fic-3", "Criar e manter fichas no Héfisto", 6, `
Passos:
1. Abra Fichas técnicas na sua área.
2. Crie a ficha ou abra a existente.
3. Lance os ingredientes do cadastro, com quantidade e unidade.
4. Informe rendimento e porção.
5. Escreva o preparo em passos curtos.
6. Complete a montagem e coloque a foto.
7. Faça o prato seguindo a ficha, ajuste e só então libere.

Revise a ficha sempre que a receita, o fornecedor ou o preço mudar.

Quando a receita muda, avise a equipe. O que muda na ficha aparece no treinamento, mas quem já foi validado precisa aprender a mudança.`, [
      prova("Quando revisar uma ficha?", ["Quando a receita, o fornecedor ou o preço mudar", "Só uma vez por ano", "Nunca"], 0, "Ficha velha ensina errado e custa errado."),
    ]),
  ]),

  modulo("l-salao", "gestao", 440, "Comando do salão", "Para chefe de fila e maître.", [
    aula("l-sal-1", "Distribuir o salão", 6, `
Antes de abrir, defina setores e responsáveis com base nas reservas e na equipe.

- Distribua as mesas para que nenhum setor fique pesado.
- Controle a fila e informe tempos reais.
- Reserve tempo para arrumar a mesa entre um cliente e outro.
- Avise a cozinha sobre grupos grandes antes do pedido.
- Circule pelo salão: veja copos vazios, pratos parados e clientes procurando alguém.

Fale com as mesas. Uma pergunta simples, "como está tudo?", descobre problemas antes da reclamação.`, [
      prova("O que fazer quando chega um grupo grande?", ["Avisar a cozinha antes do pedido", "Esperar o pedido sair", "Colocar o grupo no bar"], 0, "A cozinha se prepara, e a saída não trava."),
      situacao("A fila está longa e um cliente pergunta quanto vai demorar.", ["Dizer 5 minutos para acalmar", "Dar o tempo real e oferecer algo do bar enquanto espera", "Dizer que não sabe"], 1, "Tempo falso gera a pior reclamação."),
    ]),
    aula("l-sal-2", "Recuperar um cliente", 6, `
Quando a equipe chama você, o cliente já está insatisfeito. Sua função é mudar o rumo.

1. Vá até a mesa logo. Apresente-se.
2. Ouça até o fim, sem justificar.
3. Peça desculpas pelo que ele viveu.
4. Pergunte o que seria justo ou proponha uma solução.
5. Resolva dentro do que a casa permite.
6. Volte à mesa antes de ele sair.
7. Registre e trate a causa com a equipe.

[PREENCHER: até quanto o líder pode dar de cortesia ou desconto sem falar com o dono.]`, [
      prova("Qual é o primeiro passo ao ser chamado para uma reclamação?", ["Justificar o erro", "Ouvir até o fim", "Oferecer desconto"], 1, "Quem se sente ouvido já está mais calmo."),
      situacao("Um cliente insatisfeito ameaça fazer uma avaliação ruim.", ["Responder que ele pode fazer", "Ouvir, resolver o problema real e registrar o caso", "Oferecer cortesia em troca de não avaliar"], 1, "Resolva o problema. Não negocie avaliações."),
    ]),
  ]),

  modulo("l-gerente", "gestao", 450, "Gestão da casa", "Para o gerente: abertura, fechamento e crise.", [
    aula("l-ger-1", "Abrir e fechar a casa", 6, `
O gerente garante o conjunto.

Abertura:
- equipe completa e nos postos;
- checklists de cada área;
- estoque crítico e contas do dia;
- reservas e eventos;
- caixa e meios de pagamento funcionando.

Fechamento:
- conferência do caixa;
- faturamento lançado no Héfisto;
- checklists de fechamento;
- gás, energia, geladeiras, portas e alarmes;
- recado para o turno seguinte.

Sem o faturamento lançado, os indicadores da casa ficam sem dado.

[PREENCHER: como funciona o caixa da casa e quem pode fazer sangria.]`, [
      prova("O que precisa ser lançado todos os dias para os indicadores funcionarem?", ["O faturamento do dia", "A música tocada", "O nome dos clientes"], 0, "Sem faturamento, não há CMV nem resultado do dia."),
      situacao("O caixa fechou com diferença.", ["Ajustar o número para bater", "Conferir, registrar a diferença e tratar a causa", "Deixar para o mês seguinte"], 1, "Diferença se registra. Nunca se esconde."),
    ]),
    aula("l-ger-2", "Quando dá tudo errado", 6, `
Em uma crise, o gerente é quem mantém a calma.

1. Garanta primeiro a segurança das pessoas.
2. Avalie e decida em poucos minutos.
3. Fale com a equipe de forma clara.
4. Diga a verdade aos clientes.
5. Registre tudo e avise o dono.

Vigilância sanitária ou fiscal na casa: receba com educação, acompanhe, não esconda nada e avise o dono na hora.

Suspeita de intoxicação alimentar: ouça o cliente, registre os dados, guarde o que puder ser guardado do alimento e avise o dono no mesmo dia.`, [
      prova("O que vem primeiro em uma crise?", ["A segurança das pessoas", "A venda do dia", "A avaliação na internet"], 0, "Pessoas primeiro, sempre."),
      situacao("Chega a vigilância sanitária no meio do serviço.", ["Esconder produtos", "Receber com educação, acompanhar e avisar o dono", "Dizer que o dono não permite"], 1, "Transparência e acompanhamento."),
      situacao("Um cliente liga dizendo que passou mal depois de comer na casa.", ["Dizer que é impossível", "Ouvir, registrar, guardar o que puder do alimento e avisar o dono", "Oferecer um voucher e encerrar"], 1, "Trate como sério e registre."),
    ]),
  ]),
];
