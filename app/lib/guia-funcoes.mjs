// GUIA DE FUNÇÕES — o que cada função faz, e a que horas.
//
// A escala diz quem trabalha; este guia diz o que a pessoa faz às 15h40. São
// perguntas diferentes, e a segunda vivia na cabeça de quem já está na casa há
// tempo — o que cobra caro todo dia de treino e toda vez que alguém falta.
//
// O guia é por FUNÇÃO, nunca por pessoa: quem cobre o turno do outro lê a
// mesma linha e sabe o que fazer, sem depender de quem escreveu.

export const chaveGuiaFuncoes = (unidadeId) => `erp_guia_funcoes_${unidadeId || "sem-unidade"}`;

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
      { hora: "15:40", fim: "15:50", atividade: "Uniforme completo: avental, touca e calçado fechado. Guardar celular e pertences no armário." },
      { hora: "15:50", fim: "16:10", atividade: "Higienizar bancadas e utensílios. Conferir temperatura das geladeiras e anotar no controle." },
      { hora: "16:10", fim: "16:40", atividade: "Separar mise en place do dia conforme o memorando de amanhã." },
      { hora: "16:40", fim: "17:30", atividade: "Pré-preparos: cortes, molhos e porcionamento das fichas do dia." },
      { hora: "17:30", fim: "17:50", atividade: "Abastecer a praça: potes, temperos e descartáveis nas posições." },
      { hora: "17:50", atividade: "Praça montada e pronta para o primeiro pedido." },
      { hora: "19:30", fim: "20:00", atividade: "Intervalo", intervalo: true },
      { hora: "22:30", fim: "23:00", atividade: "Higienização final, guardar insumos e registrar sobras." },
    ],
  },
  {
    id: "cozinheiro",
    funcao: "Cozinheiro",
    cor: "#d97706",
    setor: "Cozinha",
    blocos: [
      { hora: "15:40", fim: "15:50", atividade: "Uniforme completo e conferência da praça." },
      { hora: "15:50", fim: "16:20", atividade: "Conferir produção do dia anterior, validades e o que precisa ser reposto." },
      { hora: "16:20", fim: "17:20", atividade: "Produção das bases e molhos conforme ficha técnica." },
      { hora: "17:20", fim: "17:50", atividade: "Provar, ajustar tempero e liberar a praça para o serviço." },
      { hora: "17:50", atividade: "Fogão ligado e praça liberada para pedidos." },
      { hora: "20:00", fim: "20:30", atividade: "Intervalo", intervalo: true },
      { hora: "22:40", fim: "23:10", atividade: "Fechamento: desligar equipamentos, guardar produção e passar pendências." },
    ],
  },
  {
    id: "lava-louca",
    funcao: "Lava-louça",
    cor: "#0284c7",
    setor: "Cozinha",
    blocos: [
      { hora: "15:40", fim: "15:50", atividade: "Uniforme completo: avental impermeável, touca e luvas." },
      { hora: "15:50", fim: "16:20", atividade: "Preparar a área: detergente, sanitizante e panos limpos. Conferir a máquina." },
      { hora: "16:20", fim: "17:50", atividade: "Lavar utensílios do pré-preparo conforme a cozinha libera." },
      { hora: "17:50", atividade: "Área limpa e pronta para o movimento." },
      { hora: "19:00", fim: "19:30", atividade: "Intervalo", intervalo: true },
      { hora: "22:30", fim: "23:20", atividade: "Louça do salão, higienização do piso da cozinha e retirada do lixo." },
    ],
  },
  {
    id: "garcom",
    funcao: "Garçom",
    cor: "#7c3aed",
    setor: "Salão",
    blocos: [
      { hora: "16:00", fim: "16:15", atividade: "Uniforme completo e conferência da comanda e do maquininha." },
      { hora: "16:15", fim: "16:40", atividade: "Montagem do salão: mesas, cadeiras, saleiros e cardápios." },
      { hora: "16:40", atividade: "Ligar a TV e o som do salão no volume da casa." },
      { hora: "16:40", fim: "17:40", atividade: "Polir taças e talheres. Repor guardanapos e descartáveis." },
      { hora: "17:40", fim: "17:50", atividade: "Alinhamento rápido: pratos do dia, o que faltou e observações da cozinha." },
      { hora: "17:50", atividade: "Um garçom já posicionado para atendimento." },
      { hora: "20:30", fim: "21:00", atividade: "Intervalo", intervalo: true },
      { hora: "23:00", fim: "23:30", atividade: "Fechamento das mesas, conferência de comandas e organização do salão." },
    ],
  },
  {
    id: "bartender",
    funcao: "Bartender",
    cor: "#9333ea",
    setor: "Bar",
    blocos: [
      { hora: "16:00", fim: "16:15", atividade: "Uniforme completo e conferência do bar." },
      { hora: "16:15", fim: "16:50", atividade: "Repor gelo, frutas, xaropes e garnishes. Conferir validade dos preparos." },
      { hora: "16:50", fim: "17:30", atividade: "Montar a estação: copos, doseadores, coqueteleiras e tábua de corte." },
      { hora: "17:30", fim: "17:50", atividade: "Conferir bebidas em falta e avisar a gerência antes da abertura." },
      { hora: "17:50", atividade: "Bar aberto e pronto para pedidos." },
      { hora: "20:30", fim: "21:00", atividade: "Intervalo", intervalo: true },
      { hora: "23:10", fim: "23:40", atividade: "Fechamento: guardar perecíveis, higienizar a estação e contar o estoque do bar." },
    ],
  },
  {
    id: "caixa",
    funcao: "Caixa",
    cor: "#e11d48",
    setor: "Salão",
    blocos: [
      { hora: "16:00", fim: "16:15", atividade: "Uniforme completo e login no sistema." },
      { hora: "16:15", fim: "16:40", atividade: "Abertura de caixa: conferir fundo de troco e registrar o valor inicial." },
      { hora: "16:40", fim: "17:30", atividade: "Testar maquininhas, impressora de cupom e leitor. Conferir bobinas." },
      { hora: "17:30", fim: "17:50", atividade: "Conferir cardápio e preços do dia no sistema." },
      { hora: "17:50", atividade: "Caixa aberto e pronto para o atendimento." },
      { hora: "21:00", fim: "21:30", atividade: "Intervalo", intervalo: true },
      { hora: "23:20", fim: "23:50", atividade: "Fechamento de caixa, sangria, conferência de recebimentos e relatório do dia." },
    ],
  },
];

// Ordena por horário e mantém a pausa no lugar certo da sequência. Quem edita
// digita o horário fora de ordem o tempo todo, e a folha impressa não pode
// sair com 22h antes das 16h.
export function ordenarBlocos(blocos = []) {
  const minutos = (hora) => {
    const [h, m] = String(hora || "").split(":").map(n => Number(n));
    return Number.isFinite(h) ? h * 60 + (Number.isFinite(m) ? m : 0) : 24 * 60 + 1;
  };
  return [...blocos].sort((a, b) => minutos(a.hora) - minutos(b.hora));
}

export function periodoDoBloco(bloco) {
  const inicio = String(bloco?.hora || "").trim();
  const fim = String(bloco?.fim || "").trim();
  if (!inicio) return "—";
  return fim ? `${inicio} às ${fim}` : `a partir de ${inicio}`;
}
