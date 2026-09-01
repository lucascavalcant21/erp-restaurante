// GUIA DE FUNÇÕES — o que cada função faz, e a que horas.
//
// A escala diz quem trabalha; este guia diz o que a pessoa faz às 15h40. São
// perguntas diferentes, e a segunda vivia na cabeça de quem já está na casa há
// tempo — o que cobra caro todo dia de treino e toda vez que alguém falta.
//
// O guia é por FUNÇÃO, nunca por pessoa: quem cobre o turno do outro lê a
// mesma linha e sabe o que fazer, sem depender de quem escreveu.

// Cada função tem uma cor para achar a coluna certa de relance na parede, e
// blocos com horário + atividade. `intervalo: true` marca a pausa, que aparece
// destacada porque é o que mais gera dúvida e discussão no fim do mês.
export const GUIA_FUNCOES_PADRAO = [
  {
    id: "auxiliar-cozinha",
    funcao: "Auxiliar de Cozinha",
    cor: "#059669",
    setor: "Cozinha",
    blocos: [
      { hora: "15:40", fim: "15:50", atividade: "Bater o ponto e vestir o uniforme completo: avental, touca cobrindo todo o cabelo e calçado fechado antiderrapante. Celular, bolsa e casaco ficam no armário — nada de pertence pessoal na área de manipulação. Unhas curtas, sem esmalte e sem anel, relógio ou pulseira." },
      { hora: "15:50", fim: "16:10", atividade: "Higienizar bancadas, tábuas e utensílios com detergente e depois sanitizante, deixando agir o tempo do rótulo. Medir a temperatura das geladeiras e do freezer e anotar no controle: refrigerado até 5 °C, congelado até -18 °C. Fora disso, avisar o cozinheiro ANTES de guardar qualquer coisa." },
      { hora: "16:10", fim: "16:40", atividade: "Ler o memorando de produção de amanhã e separar o que ele pede: tirar do freezer para descongelar na geladeira (nunca na pia), conferir se há quantidade suficiente e avisar o que estiver faltando enquanto ainda dá tempo de comprar." },
      { hora: "16:40", fim: "17:30", atividade: "Pré-preparos seguindo a ficha técnica de cada item — corte, tempero e peso. Etiquetar tudo com nome, data de produção e validade antes de guardar. O que sobrar de ontem vai na frente para sair primeiro." },
      { hora: "17:30", fim: "17:50", atividade: "Abastecer a praça nas posições de sempre: potes de molho cheios, temperos completos, papel e descartáveis à mão. Repor o que está pela metade agora — no meio do movimento não dá tempo." },
      { hora: "17:50", atividade: "Praça montada: bancada limpa, mise en place completo, lixeira vazia e pano higienizado. A partir daqui é serviço — o que faltar vai ser sentido no primeiro pedido." },
      { hora: "19:30", fim: "20:00", atividade: "Intervalo", intervalo: true },
      { hora: "22:30", fim: "23:00", atividade: "Higienização final: bancadas, equipamentos, piso e ralos. Guardar insumos etiquetados, registrar as sobras no sistema e separar o que não serve mais. Deixar a praça como você gostaria de encontrar amanhã." },
    ],
  },
  {
    id: "cozinheiro",
    funcao: "Cozinheiro",
    cor: "#d97706",
    setor: "Cozinha",
    blocos: [
      { hora: "15:40", fim: "15:50", atividade: "Bater o ponto, uniforme completo e uma volta na praça: equipamentos funcionando, gás aberto, faca amolada e nada quebrado. Achou problema, avisa a gerência agora — não às 19h." },
      { hora: "15:50", fim: "16:20", atividade: "Conferir a produção de ontem: cheiro, aparência, etiqueta e validade. O que vence hoje sai primeiro; o que passou vai fora, com registro da perda. Listar o que precisa ser reposto e passar para quem faz a compra." },
      { hora: "16:20", fim: "17:20", atividade: "Produzir as bases e molhos do dia seguindo a ficha técnica — peso, tempo e temperatura são os da ficha, não os da memória. Anotar o rendimento real: é ele que diz se a ficha está certa ou se está saindo dinheiro sem ninguém ver." },
      { hora: "17:20", fim: "17:50", atividade: "Provar tudo antes de liberar: sal, acidez e ponto. Ajustar enquanto ainda dá. Passar para o auxiliar o que muda hoje — item em falta, substituição, prato que vai sair diferente." },
      { hora: "17:50", atividade: "Fogão ligado, praça liberada e a equipe sabendo o que muda hoje." },
      { hora: "20:00", fim: "20:30", atividade: "Intervalo", intervalo: true },
      { hora: "22:40", fim: "23:10", atividade: "Fechamento: desligar e limpar os equipamentos, guardar a produção etiquetada, registrar sobras e perdas. Deixar por escrito o que ficou pendente para amanhã — recado de boca se perde na troca de turno." },
    ],
  },
  {
    id: "lava-louca",
    funcao: "Lava-louça",
    cor: "#0284c7",
    setor: "Cozinha",
    blocos: [
      { hora: "15:40", fim: "15:50", atividade: "Bater o ponto e vestir o uniforme: avental impermeável, touca, calçado fechado antiderrapante e luvas. Cabelo todo preso — a área é molhada e escorrega." },
      { hora: "15:50", fim: "16:20", atividade: "Preparar a área: detergente e sanitizante nos dosadores, panos limpos separados por uso (um para louça, outro para bancada — nunca o mesmo). Ligar a máquina e conferir se aquece; sem temperatura ela não higieniza, só molha." },
      { hora: "16:20", fim: "17:50", atividade: "Lavar o que o pré-preparo vai liberando, sem deixar acumular na pia. Ordem: pré-lavagem para tirar o grosso, lavagem, enxágue e secagem ao ar no escorredor. Panela suja de molho vai de molho antes, senão volta." },
      { hora: "17:50", atividade: "Pia vazia, louça guardada e área seca para o movimento começar." },
      { hora: "19:00", fim: "19:30", atividade: "Intervalo", intervalo: true },
      { hora: "22:30", fim: "23:20", atividade: "Louça do salão, higienização do piso da cozinha (incluindo debaixo das bancadas) e limpeza dos ralos. Retirar o lixo, trocar os sacos e lavar as lixeiras. Fechar a máquina limpa e aberta para secar." },
    ],
  },
  {
    id: "garcom",
    funcao: "Garçom",
    cor: "#7c3aed",
    setor: "Salão",
    blocos: [
      { hora: "16:00", fim: "16:15", atividade: "Bater o ponto, uniforme limpo e passado, calçado fechado. Conferir se a maquininha está carregada e com papel, e se a comanda funciona. Sem isso, o primeiro cliente vira problema." },
      { hora: "16:15", fim: "16:40", atividade: "Montar o salão: mesas alinhadas e niveladas, cadeiras limpas por baixo também, saleiro e paliteiro completos, cardápio sem mancha nem página faltando. Cardápio sujo é o primeiro contato do cliente com a casa." },
      { hora: "16:40", atividade: "Ligar TV e som no volume da casa — alto o suficiente para o ambiente, baixo o suficiente para a mesa conversar sem gritar." },
      { hora: "16:40", fim: "17:40", atividade: "Polir taças e talheres contra a luz, com pano limpo e seco, segurando pela base. Repor guardanapos, canudos e descartáveis nos apoios." },
      { hora: "17:40", fim: "17:50", atividade: "Alinhamento com a cozinha: pratos do dia, o que está em falta, tempo de preparo do que demora e observações do chef. Anote — o cliente vai perguntar e \"vou verificar\" toda vez custa a venda." },
      { hora: "17:50", atividade: "Pelo menos um garçom posicionado, salão montado e a equipe sabendo o que tem e o que falta." },
      { hora: "20:30", fim: "21:00", atividade: "Intervalo", intervalo: true },
      { hora: "23:00", fim: "23:30", atividade: "Fechar as mesas, conferir se toda comanda foi lançada e recolher o que ficou. Repor o básico para amanhã e passar ao caixa o que ficou pendente." },
    ],
  },
  {
    id: "bartender",
    funcao: "Bartender",
    cor: "#9333ea",
    setor: "Bar",
    blocos: [
      { hora: "16:00", fim: "16:15", atividade: "Bater o ponto, uniforme completo e conferir o bar: bancada limpa, pia funcionando, geladeira na temperatura e nada quebrado desde ontem." },
      { hora: "16:15", fim: "16:50", atividade: "Repor gelo, frutas cortadas na hora, xaropes e garnishes. Conferir a etiqueta de cada preparo: xarope e infusão têm validade curta e vencido muda o gosto do drink antes de fazer mal a alguém. O que venceu vai fora, com registro." },
      { hora: "16:50", fim: "17:30", atividade: "Montar a estação no lugar de sempre: copos por tipo, doseador, coqueteleira, mixing glass, peneira e tábua. Tudo ao alcance da mão — no movimento não dá para procurar." },
      { hora: "17:30", fim: "17:50", atividade: "Conferir o estoque do bar e avisar a gerência do que está acabando ANTES de abrir. Bebida que falta às 21h não chega mais hoje, e o drink sai do cardápio na frente do cliente." },
      { hora: "17:50", atividade: "Bar aberto: estação montada, gelo farto, garnish pronto e o que falta já comunicado." },
      { hora: "20:30", fim: "21:00", atividade: "Intervalo", intervalo: true },
      { hora: "23:10", fim: "23:40", atividade: "Fechamento: guardar perecíveis etiquetados, higienizar estação, bicos e a pia. Contar o estoque do bar e lançar no sistema — é a contagem de hoje que diz o que comprar amanhã." },
    ],
  },
  {
    id: "caixa",
    funcao: "Caixa",
    cor: "#e11d48",
    setor: "Salão",
    blocos: [
      { hora: "16:00", fim: "16:15", atividade: "Bater o ponto, uniforme completo e entrar no sistema com o SEU login. Caixa aberto no login de outra pessoa embaralha a conferência e a responsabilidade no fim do dia." },
      { hora: "16:15", fim: "16:40", atividade: "Abertura de caixa: contar o fundo de troco nota por nota, conferir se bate com o valor combinado e registrar no sistema. Diferença encontrada agora se resolve; encontrada às 23h vira discussão." },
      { hora: "16:40", fim: "17:30", atividade: "Testar cada maquininha com uma transação de teste, conferir a impressora de cupom e o leitor. Ver se há bobina sobrando — acabar bobina no movimento trava a fila inteira." },
      { hora: "17:30", fim: "17:50", atividade: "Conferir cardápio e preços no sistema contra o cardápio impresso. Preço divergente é prejuízo silencioso ou cliente irritado, e os dois aparecem só depois." },
      { hora: "17:50", atividade: "Caixa aberto, maquininhas testadas e preços conferidos." },
      { hora: "21:00", fim: "21:30", atividade: "Intervalo", intervalo: true },
      { hora: "23:20", fim: "23:50", atividade: "Fechamento: sangria, conferência dos recebimentos por forma de pagamento (dinheiro, débito, crédito, Pix) e relatório do dia. Anotar toda diferença com a explicação — caixa que fecha \"mais ou menos\" não fecha." },
    ],
  },
];

// Ordena por horário e mantém a pausa no lugar certo da sequência. Quem edita
// digita o horário fora de ordem o tempo todo, e a folha impressa não pode
// sair com 22h antes das 16h.
const minutos = (hora) => {
  const [h, m] = String(hora || "").split(":").map(n => Number(n));
  return Number.isFinite(h) ? h * 60 + (Number.isFinite(m) ? m : 0) : 24 * 60 + 1;
};

// Um período maior (ex.: Abertura do Salão) contém vários horários menores.
// Cada horário menor pode ter uma ou mais tarefas e pode ser uma faixa ou um
// horário único.
export function tarefasDoHorario(horario = {}) {
  if (Array.isArray(horario.tarefas)) {
    return horario.tarefas.map(tarefa => String(tarefa ?? ""));
  }
  const atividadeAntiga = String(horario.atividade || "").trim();
  if (horario.intervalo && /^intervalo$/i.test(atividadeAntiga)) return [];
  return atividadeAntiga ? [atividadeAntiga] : [""];
}

export function normalizarHorario(horario = {}) {
  const normalizado = {
    ...horario,
    tarefas: tarefasDoHorario(horario),
  };
  delete normalizado.atividade;
  delete normalizado.titulo;
  delete normalizado.horarios;
  return normalizado;
}

export function normalizarBloco(bloco = {}) {
  const horarios = Array.isArray(bloco.horarios)
    ? bloco.horarios.map(normalizarHorario)
    : [normalizarHorario(bloco)];
  return {
    titulo: String(bloco.titulo || ""),
    hora: String(bloco.hora || horarios[0]?.hora || ""),
    fim: String(bloco.fim || horarios[horarios.length - 1]?.fim || horarios[horarios.length - 1]?.hora || ""),
    horarios,
  };
}

// Compatibilidade: os guias já cadastrados tinham uma linha por atividade.
// Na primeira leitura, todas essas linhas entram dentro de um único período
// "Rotina do turno", mantendo exatamente os horários e textos antigos.
export function normalizarConteudo(blocos = []) {
  if (!Array.isArray(blocos) || !blocos.length) return [];
  if (blocos.some(bloco => Array.isArray(bloco.horarios))) {
    return blocos.map(normalizarBloco);
  }
  const horarios = blocos.map(normalizarHorario);
  return [{
    titulo: "Rotina do turno",
    hora: horarios[0]?.hora || "",
    fim: horarios[horarios.length - 1]?.fim || horarios[horarios.length - 1]?.hora || "",
    horarios,
  }];
}

export function ordenarBlocos(blocos = []) {
  return normalizarConteudo(blocos)
    .sort((a, b) => minutos(a.hora) - minutos(b.hora))
    .map(bloco => ({
      ...bloco,
      horarios: [...bloco.horarios].sort((a, b) => minutos(a.hora) - minutos(b.hora)),
    }));
}

export function periodoDoBloco(bloco) {
  const inicio = String(bloco?.hora || "").trim();
  const fim = String(bloco?.fim || "").trim();
  if (!inicio) return "—";
  return fim ? `${inicio} às ${fim}` : `a partir de ${inicio}`;
}

export function periodoDoHorario(horario) {
  const inicio = String(horario?.hora || "").trim();
  const fim = String(horario?.fim || "").trim();
  if (!inicio) return "—";
  return fim ? `${inicio} às ${fim}` : `às ${inicio}`;
}
