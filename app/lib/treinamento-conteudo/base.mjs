// Forma do conteúdo do treinamento. É RASCUNHO: entra no banco sem aprovação e
// só chega à equipe depois que o dono revisa e aprova cada módulo.
//
// Regra: nada aqui descreve receita, número ou fato da casa que não foi
// conferido. O que só a casa sabe fica marcado com [PREENCHER: ...], e o banco
// recusa aprovar o módulo enquanto a marca existir.

export const FONTE_RDC = "Anvisa, RDC 216/2004 (Boas Práticas para Serviços de Alimentação). Confira também as regras da vigilância sanitária da sua cidade.";
export const FONTE_ECA = "Estatuto da Criança e do Adolescente, art. 243 (Lei 13.106/2015).";

export const prova = (enunciado, opcoes, correta, explicacao) => ({ tipo: "prova", enunciado, opcoes, correta, explicacao });
export const situacao = (enunciado, opcoes, correta, explicacao) => ({ tipo: "situacao", enunciado, opcoes, correta, explicacao });
export const aula = (chave, titulo, duracao_minutos, conteudo, questoes, fontes = "") => ({
  chave, titulo, duracao_minutos, conteudo: conteudo.trim(), questoes, fontes,
});
export const modulo = (chave, area, ordem, titulo, descricao, aulas) => ({ chave, area, ordem, titulo, descricao, tipo: "aulas", aulas });
export const pratos = (chave, area, ordem, titulo, descricao, departamento, etapa) => ({ chave, area, ordem, titulo, descricao, tipo: "pratos", departamento, etapa });
