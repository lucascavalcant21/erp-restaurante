"use client";

// Painel → Promoções e descontos (protótipo PainelPromocoes, 9K.2). Lê o
// cardápio + o custo de cada prato pela ficha técnica e grava a lista de
// promoções na vitrine do dono (cardapio-painel-dados.js). O cliente vê na
// próxima atualização do cardápio (até 2 minutos) e o servidor já cobra assim.

import { useCallback, useEffect, useMemo, useState } from "react";
import { useERP } from "../../../../context/ERPContext";
import { TemaCardapio } from "../../../../components/cardapio-digital/ui";
import PainelPromocoes from "../../../../components/cardapio-digital/painel/PainelPromocoes";
import { normalizarConfigCardapio, normalizarPromocao } from "../../../../lib/cardapio-digital.mjs";
import { montarPainelCardapio } from "../../../../lib/cardapio-painel.mjs";
import { linhasDaLista, promocaoEmBranco, resumoDaLista } from "../../../../lib/cardapio-promocoes-painel.mjs";
import { carregarPainelPromocoes, salvarPromocoes } from "../../../../lib/cardapio-painel-dados";

const fotoDaFicha = (unidade) => (produtoId) => `/api/public/cardapio/${encodeURIComponent(unidade)}/foto/${encodeURIComponent(produtoId)}`;

export default function PainelPromocoesPage() {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState("");
  const [form, setForm] = useState(promocaoEmBranco);
  const [editando, setEditando] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    if (!unidadeAtiva) return;
    const r = await carregarPainelPromocoes(unidadeAtiva);
    if (r.erro) { setErro(r.erro); setDados(null); return; }
    setErro("");
    setDados(r);
  }, [unidadeAtiva]);
  useEffect(() => { setDados(null); carregar(); }, [carregar]);

  const tela = useMemo(() => (dados && unidadeAtiva ? montarPainelCardapio({ ...dados, fotoDaFicha: fotoDaFicha(unidadeAtiva) }) : null), [dados, unidadeAtiva]);
  const promocoes = useMemo(() => (dados ? normalizarConfigCardapio(dados.config).promocoes : []), [dados]);
  const taxaEntrega = Number(unidadeInfo?.taxa_entrega_padrao) || 0;
  const lista = useMemo(() => {
    if (!tela) return [];
    const produtosPorId = new Map(tela.linhas.map((l) => [l.id, { id: l.id, nome: l.nome, preco: l.preco }]));
    return linhasDaLista(promocoes, { produtosPorId, custos: dados.custos, metaPct: dados.metaPct, taxaEntrega });
  }, [tela, promocoes, dados, taxaEntrega]);

  const gravar = useCallback(async (nova, depois) => {
    setSalvando(true);
    const r = await salvarPromocoes(unidadeAtiva, nova);
    setSalvando(false);
    if (r.erro) { setErro(r.erro); return false; }
    setErro("");
    setDados((d) => ({ ...d, config: r.config }));
    depois?.();
    return true;
  }, [unidadeAtiva]);

  const nova = () => { setEditando(null); setForm(promocaoEmBranco()); };
  const editar = (id) => {
    const p = promocoes.find((x) => x.id === id);
    if (!p) return;
    setEditando(id);
    setForm({ ...promocaoEmBranco(), ...p, desconto_valor: p.desconto_valor ?? "", preco_promocional: p.preco_promocional ?? "", frete_minimo: p.frete_minimo || "" });
  };
  const salvar = () => {
    const p = normalizarPromocao(form);
    const lista2 = editando ? promocoes.map((x) => (x.id === editando ? p : x)) : [...promocoes, p];
    gravar(lista2, () => { setEditando(p.id); setForm((f) => ({ ...f, id: p.id })); });
  };
  const ativar = (id, ativa) => gravar(promocoes.map((x) => (x.id === id ? { ...x, ativa } : x)));
  const excluir = () => {
    if (!editando || !window.confirm("Excluir esta promoção? Ela sai do cardápio na hora.")) return;
    gravar(promocoes.filter((x) => x.id !== editando), nova);
  };

  if (!unidadeAtiva || unidadeAtiva === "todas") {
    return <TemaCardapio><p style={{ padding: 24 }}>Escolha uma unidade no topo para ver as promoções dela.</p></TemaCardapio>;
  }
  if (!tela) {
    return <TemaCardapio><p role={erro ? "alert" : undefined} style={{ padding: 24 }}>{erro || "Carregando as promoções…"}</p></TemaCardapio>;
  }
  const foto = new Map(tela.linhas.map((l) => [l.id, l.foto]));
  return (
    <TemaCardapio style={{ display: "flex", minHeight: "calc(100vh - 64px)" }}>
      <PainelPromocoes
        nomeLoja={unidadeInfo?.nome_fantasia || unidadeInfo?.nome || ""}
        lista={lista}
        resumo={resumoDaLista(lista)}
        form={form}
        setForm={setForm}
        editando={editando}
        produtos={tela.linhas}
        categorias={tela.categorias}
        custos={dados.custos}
        metaPct={dados.metaPct}
        taxaEntrega={taxaEntrega}
        fotoDe={(id) => foto.get(id) || ""}
        salvando={salvando}
        erro={erro}
        onNova={nova}
        onEditar={editar}
        onAtivar={ativar}
        onSalvar={salvar}
        onExcluir={excluir}
        linkCombos="/dashboard/operacao/cardapio?aba=combos"
      />
    </TemaCardapio>
  );
}
