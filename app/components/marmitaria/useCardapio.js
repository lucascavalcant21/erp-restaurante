"use client";

// Os dados do Cardápio numa peça só: o Cardápio e o Painel de lucro precisam
// mostrar os mesmos números.

import { useEffect, useMemo, useState } from "react";
import { useMarmitaria } from "./contexto";
import { useCustosEmbutidos } from "./useCustosEmbutidos";
import { catalogoParaCombo, cardapioDeVendas, normalizarCombo, normalizarOferta } from "../../lib/marmitaria/promocoes.mjs";
import { canaisDoCardapio } from "../../lib/marmitaria/cardapio.mjs";
import { mudancasDeCusto } from "../../lib/marmitaria/painel-lucro.mjs";
import { fetchHistoricoPrecos } from "../../lib/marmitaria/dados";
import { custoPorcaoDaFicha } from "../../lib/evento-financeiro.mjs";
import { fetchCombosMarmitaria, fetchOfertasMarmitaria } from "../../lib/parametros";

export function useCardapio() {
  const { base, custos, unidadeId } = useMarmitaria();
  const canais = useMemo(() => canaisDoCardapio(base.config), [base]);
  const [canalId, setCanalId] = useState(canais[0].id);
  const canal = canais.find((c) => c.id === canalId) || canais[0];
  const embutidos = useCustosEmbutidos();
  const [combos, setCombos] = useState([]);
  const [ofertas, setOfertas] = useState([]);
  const [historico, setHistorico] = useState([]);
  const [metaPct, setMetaPct] = useState(base.config.margem_alvo_pct == null ? "" : String(base.config.margem_alvo_pct).replace(".", ","));

  useEffect(() => {
    if (!unidadeId) return;
    let vivo = true;
    fetchCombosMarmitaria(unidadeId).then((r) => { if (vivo) setCombos((r.data || []).map(normalizarCombo)); });
    fetchOfertasMarmitaria(unidadeId).then((r) => { if (vivo) setOfertas((r.data || []).map(normalizarOferta)); });
    const desde = new Date(Date.now() - 30 * 86400000).toISOString();
    fetchHistoricoPrecos(unidadeId, desde).then((r) => { if (vivo) setHistorico(r.data || []); });
    return () => { vivo = false; };
  }, [unidadeId]);

  const catalogo = useMemo(() => catalogoParaCombo({
    marmitas: base.marmitas, custos, fichas: base.fichas,
    custoFicha: (f) => { const c = custoPorcaoDaFicha(f, base.fichas); return c > 0 ? c : null; },
    canalId: canal.id,
  }), [base, custos, canal]);

  const tributosPct = base.config.tributos_pct;
  const comum = useMemo(() => ({ canal, tributosPct, embutidos }), [canal, tributosPct, embutidos]);
  const linhas = useMemo(() => cardapioDeVendas({ catalogo, marmitas: base.marmitas, ofertas, combos, ...comum, metaPct: metaPct === "" ? null : metaPct }),
    [catalogo, base.marmitas, ofertas, combos, comum, metaPct]);
  // Dono, 17/11/2026: o app escolhido fica dentro de cada card da Precificação,
  // então cada card precisa dos números de todos os apps.
  const porCanal = useMemo(() => new Map(canais.map((c) => {
    const cat = catalogoParaCombo({
      marmitas: base.marmitas, custos, fichas: base.fichas,
      custoFicha: (f) => { const v = custoPorcaoDaFicha(f, base.fichas); return v > 0 ? v : null; },
      canalId: c.id,
    });
    const cm = { canal: c, tributosPct, embutidos };
    return [c.id, { comum: cm, linhas: cardapioDeVendas({ catalogo: cat, marmitas: base.marmitas, ofertas, combos, ...cm, metaPct: metaPct === "" ? null : metaPct }) }];
  })), [canais, base, custos, tributosPct, embutidos, ofertas, combos, metaPct]);
  const mudancas = useMemo(() => mudancasDeCusto({ historico, marmitas: base.marmitas, fichas: base.fichas, insumos: base.insumos, linhas }),
    [historico, base, linhas]);

  return { canais, canal, setCanalId, embutidos, combos, setCombos, ofertas, setOfertas, metaPct, setMetaPct, catalogo, comum, linhas, mudancas, porCanal };
}
