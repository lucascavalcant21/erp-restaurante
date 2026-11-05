"use client";

// A primeira coisa da marmitaria: o que foi feito, vendido e quanto resta hoje.
// Lançar uma venda leva dois toques; o formulário completo continua no Financeiro.

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ClipboardCopy, Minus, Plus, ShoppingBag } from "lucide-react";
import { useMarmitaria } from "./contexto";
import { Aviso, Botao, CampoNumero, Secao, brl, lerNumero, markupTxt, num } from "./ui";
import { fetchPedidosDoDia, fetchProducoesDoDia, fetchVendas, importarVendas, salvarVenda } from "../../lib/marmitaria/dados";
import { canaisDisponiveis, markupDaMarmita, panoramaDoDia, precoNoCanal, textoDoCardapio, vendaRapida, vendasDoCardapioOnline } from "../../lib/marmitaria/dia.mjs";

const hojeIso = () => new Date().toLocaleDateString("sv-SE");
const CHIP = "min-h-[44px] rounded-full border px-4 text-sm font-bold transition";

function Numero({ rotulo, valor, alerta }) {
  return (
    <div>
      <p className={`text-lg font-black tabular-nums ${alerta ? "text-hf-warning" : "text-hf-text"}`}>{valor}</p>
      <p className="text-xs font-semibold text-hf-muted">{rotulo}</p>
    </div>
  );
}

export default function DiaDaMarmitaria({ aoMudar }) {
  const { base, unidadeId, custos } = useMarmitaria();
  const dia = hojeIso();
  const canais = useMemo(() => canaisDisponiveis(base.config), [base.config]);
  const [canalId, setCanalId] = useState(canais[0]?.id);
  const [lotes, setLotes] = useState([]);
  const [vendas, setVendas] = useState([]);
  const [aberta, setAberta] = useState(null);
  const [qtd, setQtd] = useState(1);
  const [valor, setValor] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [msg, setMsg] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [online, setOnline] = useState([]);

  const canal = canais.find((c) => c.id === canalId) || canais[0];
  const marmitas = useMemo(() => base.marmitas.filter((m) => m.ativo !== false), [base.marmitas]);
  const carregar = useCallback(async () => {
    const [l, v, o] = await Promise.all([fetchProducoesDoDia(unidadeId, dia), fetchVendas(unidadeId, dia, dia), fetchPedidosDoDia(unidadeId, dia)]);
    setLotes(l.data || []);
    setVendas(v.data || []);
    setOnline(vendasDoCardapioOnline({ ...o, marmitas, dia }));
    if (l.error || v.error) setMsg({ tipo: "alerta", texto: l.error || v.error });
  }, [unidadeId, dia, marmitas]);
  useEffect(() => { if (unidadeId) carregar(); }, [carregar, unidadeId]);

  const p = useMemo(() => panoramaDoDia({ marmitas, lotes, vendas, dia }), [marmitas, lotes, vendas, dia]);

  const abrir = (m, novoCanal = canal, quantidade = 1) => {
    const preco = precoNoCanal(m, novoCanal);
    setAberta(m.id); setQtd(quantidade); setMsg(null);
    setValor(preco ? String(preco * quantidade).replace(".", ",") : "");
  };
  const mudarQtd = (m, q) => {
    const nova = Math.max(1, q);
    const preco = precoNoCanal(m, canal);
    setQtd(nova);
    if (preco) setValor(String(preco * nova).replace(".", ","));
  };
  const trocarCanal = (c) => {
    setCanalId(c.id);
    const m = marmitas.find((x) => x.id === aberta);
    if (m) abrir(m, c, qtd);
  };

  async function vender(m) {
    if (salvando) return;
    const r = vendaRapida({ marmita: m, canal, quantidade: qtd, valor: lerNumero(valor), dia });
    if (r.erro) return setMsg({ tipo: "alerta", texto: r.erro });
    setSalvando(true);
    const g = await salvarVenda(unidadeId, r.venda);
    setSalvando(false);
    if (g.error) return setMsg({ tipo: "alerta", texto: g.error });
    setAberta(null);
    setMsg({ tipo: "info", texto: r.faltamTaxas ? `Venda lançada. Sem as taxas do canal ${canal.nome}, o lucro fica estimado até você configurar.` : "Venda lançada." });
    carregar();
    aoMudar?.();
  }

  async function trazerOnline() {
    if (salvando) return;
    setSalvando(true);
    const r = await importarVendas(unidadeId, online);
    setSalvando(false);
    if (r.error) return setMsg({ tipo: "alerta", texto: r.error });
    setMsg({ tipo: "info", texto: `${online.length} venda(s) do cardápio online lançada(s).` });
    carregar();
    aoMudar?.();
  }

  async function copiarCardapio() {
    const texto = textoDoCardapio({ marmitas, panorama: p, canal: canais.find((c) => c.id === "whatsapp") || canal, dataTexto: new Date().toLocaleDateString("pt-BR") });
    if (!texto) return setMsg({ tipo: "alerta", texto: "Nenhuma marmita com preço e disponível para o cardápio." });
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      setMsg({ tipo: "alerta", texto: "Não foi possível copiar neste aparelho." });
    }
  }

  if (!marmitas.length) return null;

  return (
    <Secao titulo="Hoje" subtitulo={new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
      direita={<Botao variante="secundario" onClick={copiarCardapio}>{copiado ? <><Check size={17} /> Copiado</> : <><ClipboardCopy size={17} /> Copiar cardápio</>}</Botao>}>
      <div className="grid grid-cols-3 gap-3 rounded-xl bg-hf-elevated p-3">
        <Numero rotulo="Feitas" valor={num(p.feitas, 0)} />
        <Numero rotulo="Vendidas" valor={num(p.vendidas, 0)} />
        <Numero rotulo="Vendido" valor={p.temVenda ? brl(p.receita) : "—"} />
      </div>

      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Canal da venda">
        {canais.map((c) => (
          <button key={c.id} type="button" aria-pressed={c.id === canal.id} onClick={() => trocarCanal(c)} className={`${CHIP} ${c.id === canal.id ? "border-hf-accent bg-hf-accent/10 text-hf-text" : "border-hf-border text-hf-text-2"}`}>{c.nome}</button>
        ))}
      </div>

      {online.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-hf-accent/40 bg-hf-accent/5 p-3">
          <p className="min-w-0 text-sm font-semibold text-hf-text">{num(online.reduce((s, v) => s + v.quantidade, 0), 0)} marmita(s) em pedidos online aceitos ainda não lançada(s).</p>
          <Botao onClick={trazerOnline} disabled={salvando}>Lançar nas vendas</Botao>
        </div>
      )}

      <ul className="mt-3 divide-y divide-hf-border">
        {p.linhas.map((l) => {
          const m = marmitas.find((x) => x.id === l.id);
          const preco = precoNoCanal(m, canal);
          const markup = markupDaMarmita(preco, custos.get(m.id));
          return (
            <li key={l.id} className="py-3">
              <div className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-hf-text">{l.nome}</p>
                  <p className="text-xs font-medium text-hf-text-2">
                    {l.vendidas ? `${num(l.vendidas, 0)} vendida(s)` : "Nenhuma venda"}
                    {l.restam !== null && ` · restam ${num(l.restam, 0)}`}
                    {!l.temProducao && " · produção não registrada"}
                    {preco ? ` · ${brl(preco)}` : " · sem preço"}
                    {markup !== null && ` · markup ${markupTxt(markup)}`}
                  </p>
                  {l.conferir && <p className="text-xs font-semibold text-hf-warning">Vendas acima da produção registrada: confira.</p>}
                </div>
                <Botao variante={aberta === l.id ? "secundario" : "primario"} onClick={() => (aberta === l.id ? setAberta(null) : abrir(m))}><ShoppingBag size={17} /> {aberta === l.id ? "Fechar" : "Vender"}</Botao>
              </div>
              {aberta === l.id && (
                <div className="mt-3 flex flex-wrap items-end gap-3 rounded-xl bg-hf-elevated p-3">
                  <div>
                    <p className="mb-1 text-xs font-semibold text-hf-text-2">Quantidade</p>
                    <div className="flex items-center gap-1">
                      <button type="button" aria-label="Menos uma" onClick={() => mudarQtd(m, qtd - 1)} className="grid h-11 w-11 place-items-center rounded-xl border border-hf-border bg-hf-surface text-hf-text"><Minus size={18} /></button>
                      <span aria-live="polite" className="w-10 text-center text-lg font-black tabular-nums text-hf-text">{qtd}</span>
                      <button type="button" aria-label="Mais uma" onClick={() => mudarQtd(m, qtd + 1)} className="grid h-11 w-11 place-items-center rounded-xl border border-hf-border bg-hf-surface text-hf-text"><Plus size={18} /></button>
                    </div>
                  </div>
                  <label className="min-w-32 flex-1 text-xs font-semibold text-hf-text-2">Valor recebido (R$)
                    <CampoNumero className="mt-1" valor={valor} onChange={setValor} aria-label="Valor recebido" />
                  </label>
                  <Botao onClick={() => vender(m)} disabled={salvando} className="flex-1 sm:flex-none">{salvando ? "Salvando…" : `Confirmar no ${canal.nome}`}</Botao>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {p.semMarmita > 0 && <p className="mt-2 text-xs font-medium text-hf-text-2">{num(p.semMarmita, 0)} marmita(s) vendida(s) hoje sem identificar qual.</p>}
      {msg && <Aviso tipo={msg.tipo} className="mt-2">{msg.texto}</Aviso>}
      <div className="mt-3 flex flex-wrap gap-2 text-sm font-bold">
        <Link href="/dashboard/marmitaria/estoque?aba=producao" className="inline-flex min-h-[44px] items-center rounded-xl border border-hf-border px-3 text-hf-text hover:bg-hf-elevated">Registrar produção</Link>
        <Link href="/dashboard/marmitaria/estoque" className="inline-flex min-h-[44px] items-center rounded-xl border border-hf-border px-3 text-hf-text hover:bg-hf-elevated">Planejar e comprar</Link>
        <Link href="/dashboard/marmitaria/financeiro?aba=vendas" className="inline-flex min-h-[44px] items-center rounded-xl border border-hf-border px-3 text-hf-text hover:bg-hf-elevated">Vendas detalhadas</Link>
      </div>
    </Secao>
  );
}
