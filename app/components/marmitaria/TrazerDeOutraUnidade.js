"use client";

// Trazer fichas técnicas e pré-preparos de outra unidade da empresa (ex.: o
// arroz cozido do restaurante). Mostra ANTES o que vai acontecer — o que é
// reaproveitado, o que é criado e os conflitos — e só grava com confirmação.
// Regras em app/lib/marmitaria/copia-unidades.mjs.

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { useERP } from "../../context/ERPContext";
import { useMarmitaria } from "./contexto";
import { Aviso, Botao, Campo, Secao, inputCls } from "./ui";
import { carregarOrigemDeCopia, executarCopia, novaChave } from "../../lib/marmitaria/dados";
import { planoDeCopia } from "../../lib/marmitaria/copia-unidades.mjs";

export default function TrazerDeOutraUnidade({ onFechar }) {
  const { unidades } = useERP();
  const { base, unidadeId, recarregar } = useMarmitaria();
  const outras = (unidades || []).filter((u) => u.id !== unidadeId && u.id !== "todas");
  const [origemId, setOrigemId] = useState(outras[0]?.id || "");
  const [origem, setOrigem] = useState(null);
  const [busca, setBusca] = useState("");
  const [marcadas, setMarcadas] = useState([]);
  const [msg, setMsg] = useState(null);
  const [gravando, setGravando] = useState(false);

  useEffect(() => {
    if (!origemId) return;
    setOrigem(null); setMarcadas([]); setMsg(null);
    carregarOrigemDeCopia(origemId).then((r) => (r.error ? setMsg({ tipo: "alerta", texto: r.error }) : setOrigem(r)));
  }, [origemId]);

  const lista = useMemo(() => {
    const t = busca.trim().toLowerCase();
    return (origem?.fichas || []).filter((f) => !t || String(f.nome_receita).toLowerCase().includes(t))
      .sort((a, b) => Number(!!b.eh_base) - Number(!!a.eh_base) || String(a.nome_receita).localeCompare(String(b.nome_receita), "pt-BR"));
  }, [origem, busca]);

  const plano = useMemo(() => (origem && marcadas.length
    ? planoDeCopia({ origem, destino: { fichas: base.fichas, insumos: base.insumosLista }, escolhidas: marcadas, novaChave })
    : null), [origem, marcadas, base]);

  async function trazer() {
    if (!plano?.ok || gravando) return;
    setGravando(true); setMsg(null);
    try {
      const r = await executarCopia(unidadeId, plano);
      if (r.error) setMsg({ tipo: "alerta", texto: `${r.error}${r.parcial ? " — o que já foi criado fica; rode de novo para completar." : ""}` });
      else { setMsg({ tipo: "info", texto: `Pronto: ${r.fichas} ficha(s) e ${r.produtos} produto(s) novos. O que já existia foi reaproveitado.` }); setMarcadas([]); }
      await recarregar();
    } finally { setGravando(false); }
  }

  return (
    <Secao titulo="Trazer de outra unidade" subtitulo="Fichas e pré-preparos de outro negócio da empresa. O que esta unidade já tem é reaproveitado; estoque e custo continuam separados."
      direita={<button type="button" onClick={onFechar} aria-label="Fechar" className="flex h-11 w-11 items-center justify-center rounded-lg text-hf-muted hover:bg-hf-elevated"><X size={18} /></button>}>
      {!outras.length ? <p className="text-sm text-hf-muted">Não há outra unidade visível para você.</p> : (
        <div className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo rotulo="De qual unidade">
              <select className={inputCls} value={origemId} onChange={(e) => setOrigemId(e.target.value)}>{outras.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}</select>
            </Campo>
            <Campo rotulo="Buscar"><input className={inputCls} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Ex.: arroz" /></Campo>
          </div>
          {!origem ? <p className="text-sm text-hf-muted">Carregando…</p> : (
            <ul className="max-h-[320px] divide-y divide-hf-border overflow-y-auto rounded-xl border border-hf-border">
              {lista.map((f) => (
                <li key={f.id}>
                  <label className="flex min-h-[44px] cursor-pointer items-center gap-3 px-3 py-2 text-sm">
                    <input type="checkbox" className="h-5 w-5 accent-[rgb(var(--hf-accent))]" checked={marcadas.includes(f.id)}
                      onChange={(e) => setMarcadas(e.target.checked ? [...marcadas, f.id] : marcadas.filter((x) => x !== f.id))} />
                    <span className="min-w-0 flex-1 truncate">{f.nome_receita}</span>
                    <span className="text-xs text-hf-muted">{f.eh_base ? "pré-preparo" : "vira marmita"}</span>
                  </label>
                </li>
              ))}
              {!lista.length && <li className="p-3 text-sm text-hf-muted">Nenhuma ficha encontrada.</li>}
            </ul>
          )}
          {plano && (
            <div className="rounded-xl bg-hf-elevated/60 p-3 text-sm text-hf-text-2">
              <p><b className="text-hf-text">{plano.resumo.fichasNovas}</b> ficha(s) nova(s) · <b className="text-hf-text">{plano.resumo.fichasReaproveitadas}</b> já existem aqui · <b className="text-hf-text">{plano.resumo.insumosNovos}</b> produto(s) a criar · <b className="text-hf-text">{plano.resumo.insumosReaproveitados}</b> reaproveitado(s)</p>
              {plano.criarInsumos.length > 0 && <p className="mt-1 text-xs">A criar (com o preço de compra da origem, que você pode ajustar): {plano.criarInsumos.map((i) => i.nome).join(", ")}.</p>}
              {plano.conflitos.map((c) => <p key={c} className="mt-1 text-xs font-semibold text-hf-danger">{c}</p>)}
              {plano.avisos.map((a) => <p key={a} className="mt-1 text-xs text-hf-warning">{a}</p>)}
            </div>
          )}
          {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
          <div className="flex justify-end">
            <Botao onClick={trazer} disabled={!plano?.ok || gravando || !plano.resumo.fichasNovas}>{gravando ? "Trazendo…" : "Trazer para esta unidade"}</Botao>
          </div>
        </div>
      )}
    </Secao>
  );
}
