// Permissões que o caixa liga ou desliga para cada garçom (07/11/2026).
// Usado pela rota /api/salao/equipe e pela tela Equipe do salão.
export const PERMISSOES_DO_GARCOM = Object.freeze({
  move: { chave: "salao.tables.move", rotulo: "Trocar e juntar mesas", ajuda: "Mudar a comanda de mesa, juntar duas mesas e passar item de uma para outra." },
  cancel: { chave: "salao.tables.cancel", rotulo: "Cancelar item enviado", ajuda: "Cancelar item já enviado à cozinha ou ao bar, com motivo." },
});
export const PERFIL_GARCOM = "conta-garcom";
