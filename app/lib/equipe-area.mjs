// Quem pode aparecer como responsável em cada área.
//
// Regra da casa:
//  · Só entra quem é da equipe contratada — EXTRAS não assinam etiqueta,
//    movimentação de estoque nem ponto de outra pessoa.
//  · Cada um aparece na SUA área (cozinha, bar, salão, limpeza).
//  · Quem é liderança (supervisor, gerente, coordenador, chefe, CEO/diretoria)
//    aparece em TODAS as áreas, porque cobre qualquer setor.

const semAcento = (v) => {
  const d = String(v || "").normalize("NFD");
  let out = "";
  for (const ch of d) { const c = ch.charCodeAt(0); if (c < 0x300 || c > 0x36f) out += ch; }
  return out.toLowerCase().trim();
};

export const ehExtra = (c) => String(c?.tipo_contrato || "") === "Freelancer";

export const ehInativo = (c) =>
  c?.ativo === false || ["inativo", "desligado"].includes(semAcento(c?.status));

// Liderança circula por todos os setores.
export const ehLideranca = (c) => {
  const alvo = `${semAcento(c?.cargo)} ${semAcento(c?.setor)}`;
  return /(supervisor|gerente|coordenad|encarregad|chefe|\bceo\b|diretor|socio|proprietari|dono|administrador|responsavel geral)/.test(alvo);
};

const PADROES_AREA = {
  cozinha: /(cozinh|chapeir|confeit|pizzai|sushi|salgad|padeir|churrasqueir|acougue|copa|auxiliar de cozinha|prepar)/,
  bar: /(\bbar\b|barman|bartender|barista|copeir|drink|adega)/,
  salao: /(gar[cç]|atendente|sal[ao]|hostess|maitre|recep|comand|caixa|cumim|chefe? de fila)/,
  limpeza: /(limpeza|higien|steward|zelador|faxin)/,
};

// Descobre a área a partir de um nome livre ("Embalagens da Cozinha", "bar").
export function areaDe(nome) {
  const alvo = semAcento(nome);
  if (!alvo) return "";
  if (/pre-?preparo/.test(alvo) && /bar/.test(alvo)) return "bar";
  if (/bar|bebida|adega/.test(alvo)) return "bar";
  if (/cozinha|aliment|pre-?preparo/.test(alvo)) return "cozinha";
  if (/salao|salon|atendimento/.test(alvo)) return "salao";
  if (/limpeza|higien/.test(alvo)) return "limpeza";
  return "";
}

// Lista de responsáveis para uma área. Sem área definida (ex.: Depósito),
// devolve toda a equipe contratada.
// O cargo (ou o setor) já nomeia alguma área?
export function ehDeAlgumSetor(c) {
  const alvo = `${semAcento(c?.cargo)} ${semAcento(c?.setor)}`;
  return Object.values(PADROES_AREA).some(padrao => padrao.test(alvo));
}

export function equipeDaArea(colaboradores, area) {
  const ativos = (colaboradores || []).filter(c => c && !ehInativo(c) && !ehExtra(c));
  const chave = areaDe(area) || semAcento(area);
  const padrao = PADROES_AREA[chave];
  if (!padrao) return ativos;

  const doSetor = ativos.filter(c => {
    if (padrao.test(`${semAcento(c.cargo)} ${semAcento(c.setor)}`)) return true;
    // Marcado no cadastro para circular por tudo: é o caso de quem cobre
    // qualquer setor mas TEM setor próprio no cargo, como a chefia de salão.
    // Sem a marca explícita, a regra de liderança sozinha não alcança essas
    // pessoas — e alcançar por nome quebraria no primeiro cadastro corrigido.
    if (c?.acesso_todas_areas) return true;
    // Liderança entra em qualquer área — mas só a genérica. Quem já tem setor
    // no próprio cargo pertence AO setor, mesmo sendo chefia: "Chefe de
    // Cozinha" casava com /chefe/ e aparecia também no bar e no salão.
    return ehLideranca(c) && !ehDeAlgumSetor(c);
  });

  // Ninguém casou com a área: melhor mostrar a equipe inteira do que uma
  // lista vazia que trava o lançamento.
  return doSetor.length ? doSetor : ativos;
}
