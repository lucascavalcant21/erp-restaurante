// GUIA DE USO — como usar e como higienizar.
//
// O que salva de acidente e de retrabalho não é saber que existe um produto de
// limpeza: é saber a diluição, a ordem dos passos e o que nunca se faz. Esse
// conhecimento costuma morar com quem está na casa há mais tempo, e some junto
// com a pessoa.
//
// Cada guia tem seções, e cada seção tem passos numerados. Uma seção pode ser
// marcada como `alerta`: é o "nunca faça", que sai destacado porque é onde
// mora o acidente — choque, queimadura, equipamento perdido, chão escorregadio.

export const MODELOS_GUIA_USO = [
  {
    tipo: "produto",
    titulo: "Limpeza do chão",
    setor: "Cozinha e Salão",
    cor: "#0284c7",
    conteudo: [
      {
        titulo: "Diluição",
        passos: [
          "Use o detergente desengordurante indicado para piso.",
          "200 ml do produto para 500 ml de água.",
          "Meça a quantidade. Diluição no olho ou não limpa, ou deixa resíduo escorregadio.",
        ],
      },
      {
        titulo: "Passo a passo",
        passos: [
          "Molhe o chão antes de aplicar.",
          "Jogue a solução no chão já molhado.",
          "Esfregue com a vassoura, do fundo para a saída.",
          "Enxágue com a mangueira laranja até sair todo o produto.",
          "Seque o chão com o rodo, sem deixar poça.",
        ],
      },
      {
        titulo: "Ao terminar",
        passos: [
          "Guarde o produto no armário de químicos, fechado.",
          "Lave e pendure rodo e vassoura no suporte, com o cabo para cima.",
        ],
      },
      {
        titulo: "Nunca faça",
        alerta: true,
        passos: [
          "Não deixe o produto secar no chão sem enxaguar: fica escorregadio e sobra resíduo químico onde se pisa e se cozinha.",
          "Não misture com outros produtos de limpeza.",
        ],
      },
    ],
  },
  {
    tipo: "equipamento",
    titulo: "Liquidificador Cadence",
    setor: "Cozinha",
    cor: "#7c3aed",
    conteudo: [
      {
        titulo: "Antes de ligar",
        passos: [
          "Ligue na tomada de 220 V.",
          "Confira se o copo está encaixado na base do motor.",
          "Confira se a tampa está travada.",
        ],
      },
      {
        titulo: "Durante o uso",
        passos: [
          "Nunca ligue o equipamento vazio.",
          "Comece na velocidade baixa e suba aos poucos.",
        ],
      },
      {
        titulo: "Ao terminar",
        passos: [
          "Desligue e tire da tomada antes de qualquer limpeza.",
        ],
      },
      {
        titulo: "Higienização",
        passos: [
          "Retire todos os resíduos do copo e da base.",
          "Use um pano verde limpo, só para equipamentos.",
          "Passe o produto primeiro no pano — nunca direto no equipamento elétrico.",
          "Seque bem antes de guardar ou de usar de novo.",
        ],
      },
      {
        titulo: "Nunca faça",
        alerta: true,
        passos: [
          "Não molhe a base do motor nem borrife produto nela: entra água no motor, e o resultado é choque ou equipamento queimado.",
          "Não deixe o copo de molho com a base acoplada.",
        ],
      },
    ],
  },
];

export const TIPOS_USO = [
  { id: "produto", rotulo: "Produto", descricao: "Químico, diluição e modo de uso" },
  { id: "equipamento", rotulo: "Equipamento", descricao: "Operação e higienização" },
];

export function totalPassos(conteudo = []) {
  return conteudo.reduce((soma, secao) => soma + (secao?.passos?.length || 0), 0);
}
