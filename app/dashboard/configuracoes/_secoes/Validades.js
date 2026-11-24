"use client";

// Validade das etiquetas: as opções que a cozinha e o bar escolhem ao imprimir.

import { useEffect, useMemo, useState } from "react";
import { useERP } from "../../../context/ERPContext";
import { fetchValidadesEtiqueta, salvarValidadesEtiqueta } from "../../../lib/parametros";
import { Minus, Plus, Trash2 } from "lucide-react";
import { Painel, BotaoSalvar, SemUnidade, avisarSalvo } from "./ui";

export default function Validades({ onVoltar }) {
  const { unidadeAtiva } = useERP();
  const real = unidadeAtiva && unidadeAtiva !== "todas";
  const [orig, setOrig] = useState(null);
  const [lista, setLista] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => { if (real) fetchValidadesEtiqueta(unidadeAtiva).then((r) => { setOrig(r.data); setLista(r.data); }); }, [unidadeAtiva, real]);
  const mudou = useMemo(() => JSON.stringify(lista) !== JSON.stringify(orig), [lista, orig]);
  const alterar = (i, campo, v) => setLista((l) => l.map((x, j) => (j === i ? { ...x, [campo]: v } : x)));

  const salvar = async () => {
    setErro("");
    const limpas = lista.map((x) => ({ ...x, nome: String(x.nome || "").trim(), dias: Number(x.dias) }));
    if (!limpas.length) return setErro("Deixe pelo menos uma validade.");
    if (limpas.some((x) => !x.nome || !Number.isFinite(x.dias) || x.dias < 0)) return setErro("Cada linha precisa de nome e dias.");
    setSalvando(true);
    const { error, data } = await salvarValidadesEtiqueta(unidadeAtiva, limpas);
    setSalvando(false);
    if (error) return setErro(`Não salvou: ${error}`);
    setOrig(data); setLista(data);
    avisarSalvo(setOk);
  };

  if (!real) return <Painel titulo="Validade das etiquetas" onVoltar={onVoltar}><SemUnidade /></Painel>;

  return (
    <Painel titulo="Validade das etiquetas" descricao="Opções que a cozinha e o bar escolhem ao imprimir a etiqueta." onVoltar={onVoltar}
      rodape={<><BotaoSalvar onClick={salvar} salvando={salvando} ok={ok} desabilitado={!mudou} />{erro && <span className="text-[13px] font-medium text-hf-danger">{erro}</span>}</>}>
      {!lista ? <p className="text-[14px] text-hf-muted">Carregando…</p> : (
        <div className="overflow-hidden rounded-2xl border border-hf-border bg-hf-surface divide-y divide-hf-border">
          {lista.map((x, i) => (
            <div key={x.id} className="flex items-center gap-2 px-3 py-2.5">
              <input value={x.nome} onChange={(e) => alterar(i, "nome", e.target.value)} placeholder="Ex.: Molhos"
                className="h-11 min-w-0 flex-1 rounded-lg bg-transparent px-2 text-[15px] font-medium text-hf-text outline-none focus:bg-hf-elevated" />
              <div className="flex h-11 shrink-0 items-center rounded-xl border border-hf-border">
                <button type="button" aria-label="Menos um dia" onClick={() => alterar(i, "dias", Math.max(0, Number(x.dias || 0) - 1))} className="flex h-full w-10 items-center justify-center text-hf-muted"><Minus size={16} /></button>
                <input type="number" inputMode="numeric" min="0" value={x.dias} onChange={(e) => alterar(i, "dias", e.target.value)} className="h-full w-10 bg-transparent text-center text-[15px] font-semibold text-hf-text outline-none" />
                <button type="button" aria-label="Mais um dia" onClick={() => alterar(i, "dias", Number(x.dias || 0) + 1)} className="flex h-full w-10 items-center justify-center text-hf-muted"><Plus size={16} /></button>
              </div>
              <span className="w-8 text-[13px] text-hf-muted">dias</span>
              <button type="button" aria-label={`Tirar ${x.nome}`} onClick={() => setLista((l) => l.filter((_, j) => j !== i))} className="flex h-11 w-9 items-center justify-center text-hf-muted hover:text-hf-danger"><Trash2 size={16} /></button>
            </div>
          ))}
          <button type="button" onClick={() => setLista((l) => [...l, { id: `categoria-${Date.now()}`, nome: "", dias: 1 }])}
            className="flex h-12 w-full items-center gap-2 px-4 text-[14px] font-medium text-hf-text"><Plus size={16} /> Adicionar validade</button>
        </div>
      )}
    </Painel>
  );
}
