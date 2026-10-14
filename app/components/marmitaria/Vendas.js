"use client";

// Vendas da marmitaria por dia, canal e marmita — a fonte da receita do DRE.
// Enquanto não há integração com o iFood, o lançamento é manual. As taxas
// podem vir do repasse (real) ou ser estimadas pela configuração do canal;
// estimadas ficam marcadas e aparecem como ESTIMATIVA no resultado.

import { useCallback, useEffect, useState } from "react";
import { Trash2 } from "lucide-react";
import { useMarmitaria } from "./contexto";
import { Aviso, Botao, Campo, CampoNumero, Secao, SemDados, Selo, brl, inputCls, lerNumero, num } from "./ui";
import { fetchVendas, salvarVenda, excluirVenda } from "../../lib/marmitaria/dados";
import { resultadoPorCanal, resumoVendas } from "../../lib/marmitaria/nucleo.mjs";

const hoje = () => new Date().toLocaleDateString("sv-SE");
const vazia = (canal = "") => ({ data: hoje(), canal, ficha_id: "", quantidade: "", valor_bruto: "", descontos: "", cancelamentos: "", comissao: "", taxa_pagamento: "", entrega_subsidiada: "", promocoes: "", tributos: "", observacao: "", taxasDoRepasse: false });

export default function Vendas() {
  const { base, unidadeId } = useMarmitaria();
  const canais = base.config.canais.filter((c) => c.ativo);
  const [mes, setMes] = useState(hoje().slice(0, 7));
  const [lista, setLista] = useState([]);
  const [f, setF] = useState(() => vazia(canais[0]?.id || ""));
  const [msg, setMsg] = useState(null);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    const [a, m] = mes.split("-").map(Number);
    const fim = new Date(Date.UTC(a, m, 0)).getUTCDate();
    const r = await fetchVendas(unidadeId, `${mes}-01`, `${mes}-${String(fim).padStart(2, "0")}`);
    setLista(r.data || []);
    if (r.error) setMsg({ tipo: "alerta", texto: r.error });
  }, [unidadeId, mes]);
  useEffect(() => { if (unidadeId) carregar(); }, [carregar, unidadeId]);

  // pré-preenche valor e taxas a partir do preço e da configuração do canal
  function estimar() {
    const canal = canais.find((c) => c.id === f.canal);
    const m = base.marmitas.find((x) => x.id === f.ficha_id);
    const q = lerNumero(f.quantidade) || 0;
    if (!canal || !q) return setMsg({ tipo: "alerta", texto: "Escolha o canal e a quantidade para estimar." });
    const preco = m ? (m.precos[canal.id] ?? Number(m.preco_venda)) : null;
    const bruto = lerNumero(f.valor_bruto) || (preco ? preco * q : 0);
    if (!bruto) return setMsg({ tipo: "alerta", texto: "Informe o valor vendido ou escolha a marmita com preço." });
    const r = resultadoPorCanal({ preco: bruto / q, custoTecnico: 0, canal, tributosPct: null });
    const d = (v) => String(Math.round(v * q * 100) / 100).replace(".", ",");
    setF({ ...f, valor_bruto: String(Math.round(bruto * 100) / 100).replace(".", ","), comissao: d(r.comissao + r.taxaFixa), taxa_pagamento: d(r.taxaPagamento),
      entrega_subsidiada: d(r.entrega), promocoes: "", descontos: f.descontos || (r.promocao ? d(r.promocao) : ""), taxasDoRepasse: false });
    setMsg(null);
  }

  async function salvar() {
    if (salvando) return;
    setMsg(null);
    if (!f.data || !f.canal) return setMsg({ tipo: "alerta", texto: "Informe a data e o canal." });
    if (!(lerNumero(f.quantidade) > 0)) return setMsg({ tipo: "alerta", texto: "Informe quantas marmitas foram vendidas." });
    if (!(lerNumero(f.valor_bruto) > 0)) return setMsg({ tipo: "alerta", texto: "Informe o valor vendido." });
    setSalvando(true);
    try {
      const v = Object.fromEntries(Object.entries(f).map(([k, x]) => [k, ["data", "canal", "ficha_id", "observacao", "taxasDoRepasse"].includes(k) ? x : lerNumero(x)]));
      const r = await salvarVenda(unidadeId, { ...v, tributos: f.tributos === "" ? null : v.tributos, taxas_estimadas: !f.taxasDoRepasse && (v.comissao > 0 || v.taxa_pagamento > 0) });
      if (r.error) setMsg({ tipo: "alerta", texto: r.error });
      else { setF({ ...vazia(f.canal), data: f.data }); setMsg({ tipo: "info", texto: "Venda lançada." }); await carregar(); }
    } finally { setSalvando(false); }
  }

  async function excluir(id) {
    const r = await excluirVenda(id);
    if (r.error) setMsg({ tipo: "alerta", texto: r.error }); else carregar();
  }

  if (!canais.length) return <SemDados titulo="Configure os canais primeiro" motivo="As vendas são lançadas por canal (iFood, WhatsApp, Balcão)." href="/dashboard/marmitaria/configuracoes" acao="Configurar canais" />;
  const rv = resumoVendas(lista);
  const nomeCanal = (id) => canais.find((c) => c.id === id)?.nome || base.config.canais.find((c) => c.id === id)?.nome || id;

  return (
    <div className="space-y-4">
      <Aviso>Integração com o iFood ainda não conectada: lance as vendas do dia aqui (do relatório do iFood e do caixa). Não lance as vendas da marmitaria também no faturamento diário do restaurante.</Aviso>
      <Secao titulo="Lançar vendas">
        <div className="grid gap-3 sm:grid-cols-4">
          <Campo rotulo="Data"><input type="date" className={inputCls} value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></Campo>
          <Campo rotulo="Canal"><select className={inputCls} value={f.canal} onChange={(e) => setF({ ...f, canal: e.target.value })}>{canais.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></Campo>
          <Campo rotulo="Marmita" dica="Opcional; com ela aparecem as mais vendidas."><select className={inputCls} value={f.ficha_id} onChange={(e) => setF({ ...f, ficha_id: e.target.value })}><option value="">Várias / não separado</option>{base.marmitas.map((m) => <option key={m.id} value={m.id}>{m.nome_receita}</option>)}</select></Campo>
          <Campo rotulo="Marmitas vendidas"><CampoNumero valor={f.quantidade} onChange={(v) => setF({ ...f, quantidade: v })} /></Campo>
          <Campo rotulo="Valor vendido (R$)"><CampoNumero valor={f.valor_bruto} onChange={(v) => setF({ ...f, valor_bruto: v })} /></Campo>
          <Campo rotulo="Descontos (R$)"><CampoNumero valor={f.descontos} onChange={(v) => setF({ ...f, descontos: v })} /></Campo>
          <Campo rotulo="Cancelamentos e estornos (R$)"><CampoNumero valor={f.cancelamentos} onChange={(v) => setF({ ...f, cancelamentos: v })} /></Campo>
          <Campo rotulo="Tributos (R$)" dica="Vazio = estimado pela alíquota."><CampoNumero valor={f.tributos} onChange={(v) => setF({ ...f, tributos: v })} /></Campo>
          <Campo rotulo="Comissão / taxas do canal (R$)"><CampoNumero valor={f.comissao} onChange={(v) => setF({ ...f, comissao: v })} /></Campo>
          <Campo rotulo="Taxa de pagamento (R$)"><CampoNumero valor={f.taxa_pagamento} onChange={(v) => setF({ ...f, taxa_pagamento: v })} /></Campo>
          <Campo rotulo="Entrega paga pela empresa (R$)"><CampoNumero valor={f.entrega_subsidiada} onChange={(v) => setF({ ...f, entrega_subsidiada: v })} /></Campo>
          <Campo rotulo="Promoções cobradas da empresa (R$)"><CampoNumero valor={f.promocoes} onChange={(v) => setF({ ...f, promocoes: v })} /></Campo>
        </div>
        <label className="mt-3 flex min-h-[44px] items-center gap-2 text-sm text-hf-text-2">
          <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--hf-accent))]" checked={f.taxasDoRepasse} onChange={(e) => setF({ ...f, taxasDoRepasse: e.target.checked })} />
          Taxas conferidas no repasse/extrato (desmarcado = estimativa)
        </label>
        {msg && <Aviso tipo={msg.tipo} className="mt-2">{msg.texto}</Aviso>}
        <div className="mt-3 flex flex-wrap justify-end gap-2">
          <Botao variante="secundario" onClick={estimar}>Estimar taxas pelo canal</Botao>
          <Botao onClick={salvar} disabled={salvando}>{salvando ? "Salvando…" : "Lançar venda"}</Botao>
        </div>
      </Secao>

      <Secao titulo="Vendas do mês" direita={<input type="month" className={`${inputCls} w-[170px]`} value={mes} onChange={(e) => e.target.value && setMes(e.target.value)} aria-label="Mês" />}
        subtitulo={lista.length ? `${num(rv.quantidade, 0)} marmitas · receita ${brl(rv.receita)} · taxas ${brl(rv.comissao + rv.taxaPagamento + rv.outrasTaxas)}` : null}>
        {lista.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead><tr className="text-left text-xs uppercase tracking-wide text-hf-muted"><th className="py-2 pr-2">Data</th><th className="py-2 pr-2">Canal</th><th className="py-2 pr-2">Marmita</th><th className="py-2 pr-2 text-right">Qtd.</th><th className="py-2 pr-2 text-right">Vendido</th><th className="py-2 pr-2 text-right">Taxas</th><th className="py-2" /></tr></thead>
              <tbody className="divide-y divide-hf-border">
                {lista.map((v) => (
                  <tr key={v.id}>
                    <td className="py-2 pr-2">{new Date(`${String(v.data).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR")}</td>
                    <td className="py-2 pr-2">{nomeCanal(v.canal)}</td>
                    <td className="py-2 pr-2">{base.marmitas.find((m) => m.id === v.ficha_id)?.nome_receita || "—"}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{num(v.quantidade, 0)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{brl(v.valor_bruto - v.descontos - v.cancelamentos)}</td>
                    <td className="py-2 pr-2 text-right tabular-nums">{brl(v.comissao + v.taxa_pagamento + v.outras_taxas)} {v.taxas_estimadas && <Selo natureza="estimado" />}</td>
                    <td className="py-2 text-right">{v.fonte === "manual" && <button type="button" aria-label="Excluir lançamento" onClick={() => excluir(v.id)} className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-hf-muted hover:bg-hf-elevated hover:text-hf-danger"><Trash2 size={15} /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <SemDados titulo="Nenhuma venda lançada neste mês" />}
      </Secao>
    </div>
  );
}
