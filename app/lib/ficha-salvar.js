import { salvarFicha } from "./operacao";
import { fetchProdutos, salvarProduto } from "./vendas";
import { fetchEstoques, vincularItemEstoque, garantirFichaNoEstoquePreparo } from "./estoques-multiplos";
import { registrarCustoFicha } from "./ficha-custos";
import {
  fetchEtapas, fetchEquipamentos, fetchAlergenicos, fetchArmazenamento, fetchMontagemPassos,
  salvarArmazenamento, salvarEquipamentos, salvarAlergenicos, garantirCodigoFicha,
} from "./ficha-tecnica";
import {
  camposParaGravar, validarEditor, armazenamentoParaGravar, quantidadeParaGravar,
} from "./ficha-modelo.mjs";
import { custoDosItens } from "./ficha-editor.mjs";
import { parseNumero, pesoTotalDaFicha } from "./ficha-calculos.mjs";

// Leitura e gravação do editor de fichas (prato e pré-preparo).
//
// A ficha em si continua indo por salvarFicha (lib/operacao.js), que também
// sincroniza o Guia de Montagem. Aqui fica o que depende do tipo: seções do
// pré-preparo, vínculo do prato com o cardápio, estoque de preparos e histórico
// de custo.

// Complementos de UMA ficha, dizendo se a leitura falhou.
//
// A diferença importa: "a ficha não tem equipamentos" e "não consegui ler os
// equipamentos" parecem iguais (lista vazia), mas gravar no segundo caso
// apagaria o que existe. Com `falhou`, o editor não grava essas seções.
export async function carregarComplementosDaFicha(fichaId) {
  const [etapas, equipamentos, alergenicos, armazenamento, montagem] = await Promise.all([
    fetchEtapas(fichaId), fetchEquipamentos(fichaId), fetchAlergenicos(fichaId),
    fetchArmazenamento(fichaId), fetchMontagemPassos(fichaId),
  ]);
  const todas = [etapas, equipamentos, alergenicos, armazenamento, montagem];
  return {
    data: {
      etapas: etapas.data || [],
      equipamentos: equipamentos.data || [],
      alergenicos: alergenicos.data || [],
      armazenamento: armazenamento.data || null,
      montagem: montagem.data || [],
    },
    falhou: todas.some(r => r.error && r.error !== "sem_tabela"),
    semTabela: todas.some(r => r.error === "sem_tabela"),
  };
}

// Prato vendido precisa existir no Cardápio, e o preço mora lá.
//
// O editor mostra o preço do Cardápio; se a pessoa mudar, o Cardápio tem de
// receber a mudança — senão o card volta a exibir o preço antigo e ficha e
// cardápio passam a discordar. Preço vazio ou zero NÃO sobrescreve: campo em
// branco é "não mexi nisso", não "cobrar R$ 0,00".
async function vincularPratoAoCardapio({ unidadeId, fichaId, campos, precoVenda = 0 }) {
  const { data: produtos } = await fetchProdutos(unidadeId, campos.departamento);
  const nome = String(campos.nome_receita || "").trim().toLowerCase();
  const existente = (produtos || []).find(p => p.ficha_id === fichaId)
    || (produtos || []).find(p => String(p.nome_produto || "").trim().toLowerCase() === nome);
  const preco = parseNumero(precoVenda);
  if (existente) {
    const mudancas = {};
    if (existente.ficha_id !== fichaId) mudancas.ficha_id = fichaId;
    if (preco > 0 && preco !== parseNumero(existente.preco_venda)) mudancas.preco_venda = preco;
    if (!Object.keys(mudancas).length) return { error: null };
    return salvarProduto({ id: existente.id, ...mudancas });
  }
  return salvarProduto({
    unidade_id: unidadeId,
    ficha_id: fichaId,
    nome_produto: campos.nome_receita,
    preco_venda: preco,
    categoria: campos.departamento === "bar" ? "Drinks" : "Pratos Principais",
    departamento: campos.departamento,
    observacoes: "Criado automaticamente pela Ficha Técnica.",
  });
}

// Embalagem usada como ingrediente entra no estoque de embalagens do setor.
async function vincularEmbalagensAoEstoque({ unidadeId, departamento, itens, idsEmbalagem }) {
  const embalagens = itens.filter(i => i.tipo === "insumo" && idsEmbalagem.has(i.insumo_id));
  if (!embalagens.length) return;
  const { data: estoques } = await fetchEstoques(unidadeId);
  const slug = departamento === "bar" ? "embalagens-bar" : "embalagens-cozinha";
  const estoque = (estoques || []).find(e => String(e.slug || "").toLowerCase() === slug);
  if (!estoque) return;
  for (const item of embalagens) {
    await vincularItemEstoque({ unidadeId, estoqueId: estoque.id, insumoId: item.insumo_id, custoUnitario: item.custo_unitario });
  }
}

// Grava a ficha do editor. Devolve { id, avisos, error }.
//
// `complementosCarregados` falso = a leitura das seções do pré-preparo falhou;
// nesse caso elas não são gravadas (senão sairiam apagadas).
export async function salvarFichaDoEditor({
  tipo, form, itens, armazenamento, armazenamentoOriginal, equipamentos, alergenicos,
  complementosCarregados = true, unidadeId, sessao, idsEmbalagem = new Set(),
}) {
  const erros = validarEditor(tipo, form, itens);
  if (erros.length) return { error: erros.join(" "), avisos: [] };

  const novo = !form.id;
  // Na edição vale a unidade da própria ficha (quem está na visão da matriz
  // não pode mover a ficha de unidade sem querer).
  const unidade = form.unidade_id || unidadeId;
  const validos = itens.filter(i => parseNumero(i.quantidade) > 0);
  const campos = camposParaGravar(tipo, { ...form, validade_dias: armazenamento?.validade_dias }, { novo, unidadeId: unidade });
  // salvarFicha sincroniza o Guia de Montagem pela unidade: ela vai junto,
  // com o mesmo valor que já está no banco.
  if (!novo) campos.unidade_id = unidade;

  const linhas = validos.map(i => ({
    insumo_id: i.tipo === "insumo" ? i.insumo_id : null,
    subficha_id: i.tipo === "base" ? i.subficha_id : null,
    quantidade: i.tipo === "insumo" ? quantidadeParaGravar(i.quantidade, i.unidade_insumo) : parseNumero(i.quantidade),
    fator_correcao: parseNumero(i.fator),
  }));

  const resposta = await salvarFicha(novo ? campos : { ...campos, id: form.id }, linhas);
  if (resposta?.error) return { error: resposta.error, avisos: [] };
  const fichaId = form.id || resposta.id;
  const avisos = [];
  const custoTotal = custoDosItens(validos);

  if (tipo === "pre_preparo") {
    if (complementosCarregados) {
      const resultados = await Promise.all([
        salvarArmazenamento(fichaId, unidade, armazenamentoParaGravar(armazenamentoOriginal, armazenamento)),
        salvarEquipamentos(fichaId, unidade, equipamentos),
        salvarAlergenicos(fichaId, unidade, alergenicos),
      ]);
      if (resultados.some(r => r.error === "sem_tabela")) {
        avisos.push("Armazenamento, equipamentos e alergênicos precisam da migração db/migracao_ficha_tecnica_completa.sql no Supabase para serem gravados.");
      }
      const falhas = resultados.filter(r => r.error && r.error !== "sem_tabela").map(r => r.error);
      if (falhas.length) avisos.push(`Parte das seções não foi gravada: ${falhas.join(" · ")}`);
    } else {
      avisos.push("Armazenamento, equipamentos e alergênicos não foram lidos do banco, então não foram regravados (para não apagar o que existe). Abra a ficha de novo para editá-los.");
    }

    // Mesma divisão de antes (e da função custo_total_ficha_preparo do banco):
    // rendimento abaixo de 1 conta como 1.
    const estoque = await garantirFichaNoEstoquePreparo({
      unidadeId: unidade,
      ficha: { ...campos, id: fichaId },
      departamento: campos.departamento,
      custoUnitario: custoTotal / Math.max(1, parseNumero(campos.rendimento_porcoes) || 1),
    });
    if (estoque?.error) avisos.push(`A ficha foi salva, mas não entrou no estoque de pré-preparos: ${estoque.error}`);
  } else {
    try {
      const r = await vincularPratoAoCardapio({ unidadeId: unidade, fichaId, campos, precoVenda: form.preco_venda });
      if (r?.error) avisos.push(`A ficha foi salva, mas o vínculo com o Cardápio falhou: ${r.error}`);
    } catch { /* o vínculo com o cardápio nunca derruba o salvar */ }
  }

  try {
    await vincularEmbalagensAoEstoque({ unidadeId: unidade, departamento: campos.departamento, itens: validos, idsEmbalagem });
  } catch { /* integração com estoque é acessória */ }

  // Retrato do custo no histórico (não bloqueia). Custo por porção usa o peso
  // da porção quando a ficha tem; senão a receita inteira é uma porção.
  const pesoTotal = pesoTotalDaFicha(campos.rendimento_porcoes, campos.rendimento_unidade, form.peso_porcao_g);
  const porcoes = parseNumero(form.peso_porcao_g) > 0 && pesoTotal > 0 ? pesoTotal / parseNumero(form.peso_porcao_g) : 1;
  registrarCustoFicha({
    unidadeId: unidade, fichaId, custoTotal, custoPorcao: custoTotal / porcoes, origem: "edicao_ficha",
    usuarioNome: sessao?.nome || sessao?.user?.email || "",
  }).catch(() => {});

  // Código FT-0001: toda ficha passa a ter um, gerado uma vez só.
  if (!form.codigo) {
    try { await garantirCodigoFicha(unidade, fichaId, ""); } catch { /* código é acessório */ }
  }

  return { id: fichaId, avisos, error: null };
}
