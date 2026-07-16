// Unidade usada para custo, preço e baixa de uma ficha.
// Sem peso/volume por porção, receitas medidas em massa vendem por kg e
// receitas medidas em volume vendem por litro. Com porção informada, vendem
// por porção. Esta regra precisa ser única em todo o ERP.
export function unidadeVendaDaFicha(ficha) {
  const rendimento = Number(ficha?.rendimento_porcoes) || 0;
  const unidade = String(ficha?.rendimento_unidade || "porcao").toLowerCase();
  const regraPersistida = String(ficha?.unidade_venda || "").toLowerCase();
  if (unidade === "porcao") return { quantidade: rendimento, rotulo: "porção", rotuloPlural: "porções" };
  if (unidade === "un") return { quantidade: rendimento, rotulo: "unidade", rotuloPlural: "unidades" };

  const tamanhoPorcao = Number(ficha?.peso_porcao_g) || 0;
  const totalEmMil = (unidade === "kg" || unidade === "l") ? rendimento * 1000 : rendimento;
  if (tamanhoPorcao > 0) {
    return { quantidade: totalEmMil / tamanhoPorcao, rotulo: "porção", rotuloPlural: "porções" };
  }
  // Antes da unificação, fichas em g/ml sem tamanho de porção eram tratadas
  // literalmente. Preservamos essa regra apenas enquanto `unidade_venda` for
  // nula, impedindo que dados antigos mudem de custo em 1.000 vezes.
  if (!regraPersistida && (unidade === "g" || unidade === "ml")) {
    return {
      quantidade: rendimento,
      rotulo: unidade,
      rotuloPlural: unidade,
      legado: true,
    };
  }
  if (unidade === "kg" || unidade === "g") {
    return { quantidade: totalEmMil / 1000, rotulo: "kg", rotuloPlural: "kg" };
  }
  if (unidade === "l" || unidade === "ml") {
    return { quantidade: totalEmMil / 1000, rotulo: "L", rotuloPlural: "L" };
  }
  return { quantidade: rendimento, rotulo: unidade || "unidade", rotuloPlural: unidade || "unidades" };
}

export function quantidadeVendaDaFicha(ficha) {
  return unidadeVendaDaFicha(ficha).quantidade;
}

export function custoEmbalagensDoProduto(produto, embalagens = []) {
  return (Array.isArray(produto?.embalagens) ? produto.embalagens : []).reduce((total, item) => {
    const embalagem = embalagens.find(registro => registro.id === item?.embalagem_id);
    if (!embalagem) return total;
    return total + (Number(embalagem.preco_unitario) || 0) * (Number(item?.qtd) || 1);
  }, 0);
}
