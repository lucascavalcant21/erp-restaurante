"use client";

// Simulador de Rendimento por item (SÓ CONSULTA — não altera o estoque, não
// cria baixa, não abre embalagem). Bar: quantos drinks por dosagem. Cozinha:
// quantas porções/pratos por peso/volume. Mostra completos (floor) + sobra.
// Conversão g↔kg e ml↔L; peso↔volume só com densidade (g/ml) cadastrada.

import { useState } from "react";
import { Calculator, X } from "lucide-react";
import { useERP } from "../context/ERPContext";
import { fetchFichas, salvarInsumo } from "../lib/operacao";

const TIPOS_RENDIMENTO = ["drinks", "pratos", "porções", "copos", "doses", "unidades", "outro"];

// Converte uma quantidade para a unidade-base do item (ml/g/L/kg/un).
function paraBase(qtd, unUsr, unItem, densidade) {
  const g = ["g", "kg"], v = ["ml", "l"];
  const uu = String(unUsr).toLowerCase(), ui = String(unItem).toLowerCase();
  const grp = (u) => (g.includes(u) ? "peso" : v.includes(u) ? "vol" : "un");
  const gu = grp(uu), gi = grp(ui);
  const toCanon = (q, u) => (u === "kg" || u === "l" ? q * 1000 : q); // g ou ml
  const fromCanon = (q, u) => (u === "kg" || u === "l" ? q / 1000 : q);
  if (gu === "un" || gi === "un") return uu === ui ? qtd : null;
  if (gu === gi) return fromCanon(toCanon(qtd, uu), ui);
  const d = Number(densidade) || 0;
  if (!d) return null;
  if (gu === "peso") return fromCanon(toCanon(qtd, uu) / d, ui);
  return fromCanon(toCanon(qtd, uu) * d, ui);
}

const mostrarUn = (u) => (String(u || "").toLowerCase() === "l" ? "L" : (u || "un"));
const fmtQtd = (q, u) => `${(+Number(q || 0).toFixed(2)).toLocaleString("pt-BR")} ${mostrarUn(u)}`;

function medidaPadraoSugerida(item) {
  if (Number(item.medida_padrao) > 0) return Number(item.medida_padrao);
  const un = String(item.unidade_medida || "").toLowerCase();
  if (un === "ml") return 40;
  if (un === "l") return 0.04;
  if (un === "g") return 200;
  if (un === "kg") return 0.2;
  return 1;
}

export default function SimuladorRendimento({ item, variant = "icon", onSaved }) {
  const { unidadeAtiva } = useERP();
  const [aberto, setAberto] = useState(false);
  const unItem = String(item.unidade_medida || "un").toLowerCase();
  const [medida, setMedida] = useState("");
  const [un, setUn] = useState(unItem);
  const [tipo, setTipo] = useState(item.tipo_rendimento || ((item.departamento || "").toLowerCase() === "bar" ? "drinks" : "porções"));
  const [fichas, setFichas] = useState([]);
  const [salvando, setSalvando] = useState(false);

  const insumoId = item.insumo_id || item.id;
  const ehVol = ["ml", "l"].includes(unItem), ehPeso = ["g", "kg"].includes(unItem);
  const chips = ehVol ? [10, 20, 30, 40, 50] : ehPeso ? [50, 100, 150, 200, 300] : [1, 2, 3, 4, 5];

  const abrir = async () => {
    setAberto(true);
    setUn(unItem);
    setMedida(String(medidaPadraoSugerida(item)).replace(".", ","));
    // Fichas que usam este item, para puxar a dosagem/porção automaticamente
    try {
      const { data } = await fetchFichas(unidadeAtiva, (item.departamento || "").toLowerCase() || undefined);
      const lista = [];
      (data || []).forEach((f) => (f.fichas_ingredientes || []).forEach((fi) => {
        if (fi.insumo_id === insumoId && Number(fi.quantidade) > 0) {
          lista.push({ nome: f.nome_receita || "Receita", quantidade: Number(fi.quantidade), unidade: fi.insumos?.unidade_medida || unItem });
        }
      }));
      setFichas(lista);
    } catch { setFichas([]); }
  };

  const saldoBase = Number(item.quantidade_atual) || 0;
  const medNum = parseFloat(String(medida).replace(",", ".")) || 0;
  const medBase = medNum > 0 ? paraBase(medNum, un, unItem, item.densidade) : 0;
  const invalido = medNum > 0 && medBase == null;
  const completos = medBase && medBase > 0 ? Math.floor(saldoBase / medBase) : 0;
  const sobra = medBase && medBase > 0 ? saldoBase - completos * medBase : saldoBase;

  const salvarPadrao = async () => {
    if (medBase == null || medBase <= 0) return;
    setSalvando(true);
    const { error } = await salvarInsumo({ id: insumoId, unidade_id: unidadeAtiva, nome: item.nome, medida_padrao: medBase, tipo_rendimento: tipo });
    setSalvando(false);
    if (error) return alert("Erro ao salvar: " + error);
    onSaved && onSaved();
    alert("Medida padrão salva.");
  };

  const gatilho = variant === "full"
    ? <button type="button" onClick={abrir} className="w-full rounded-xl bg-indigo-50 py-2 text-sm font-bold text-indigo-700">Simular rendimento</button>
    : <button type="button" onClick={abrir} title="Simular rendimento — não altera o estoque" className="grid h-9 w-9 place-items-center rounded-lg border border-indigo-200 text-indigo-600"><Calculator size={16} /></button>;

  return (
    <>
      {gatilho}
      {aberto && (
        <div className="fixed inset-0 z-[110] flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-sm sm:items-center sm:p-5" onClick={() => setAberto(false)}>
          <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl sm:max-w-md sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900">Simular rendimento</h2>
                <p className="text-sm text-slate-500">{item.nome}</p>
              </div>
              <button onClick={() => setAberto(false)} className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-500"><X size={16} /></button>
            </div>

            <div className="rounded-2xl bg-slate-50 p-3">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Saldo disponível</p>
              <p className="text-xl font-black text-slate-800">{fmtQtd(saldoBase, unItem)}</p>
            </div>

            {fichas.length > 0 && (
              <div className="mt-3">
                <label className="text-xs font-black uppercase tracking-widest text-slate-500">Usar receita</label>
                <select onChange={(e) => { const f = fichas[Number(e.target.value)]; if (f) { setMedida(String(f.quantidade).replace(".", ",")); setUn(String(f.unidade || unItem).toLowerCase()); } }}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white p-3 font-bold text-slate-700 outline-none">
                  <option value="">Dosagem manual</option>
                  {fichas.map((f, i) => <option key={i} value={i}>{f.nome} — {fmtQtd(f.quantidade, f.unidade || unItem)}</option>)}
                </select>
              </div>
            )}

            <div className="mt-3">
              <label className="text-xs font-black uppercase tracking-widest text-slate-500">Dosagem / porção por {tipo === "drinks" ? "drink" : "unidade"}</label>
              <div className="mt-1 flex gap-2">
                <input type="number" min="0" step="any" inputMode="decimal" value={medida} onChange={(e) => setMedida(e.target.value)} autoFocus
                  className="w-28 rounded-xl border-2 border-slate-200 p-3 font-black text-slate-800 outline-none focus:border-indigo-500" />
                <select value={un} onChange={(e) => setUn(e.target.value)} className="rounded-xl border-2 border-slate-200 p-3 font-bold text-slate-700 outline-none">
                  {["ml", "l", "g", "kg", "un"].map((u) => <option key={u} value={u}>{mostrarUn(u)}</option>)}
                </select>
                <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="flex-1 rounded-xl border-2 border-slate-200 p-3 font-bold text-slate-700 outline-none">
                  {TIPOS_RENDIMENTO.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {chips.map((c) => (
                  <button key={c} onClick={() => { setMedida(String(c)); setUn(unItem); }} className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-600">{c}{ehVol ? "ml" : ehPeso ? "g" : ""}</button>
                ))}
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-indigo-50 p-4 text-center">
              {invalido ? (
                <p className="font-bold text-red-500">Não é possível converter peso em volume para este ingrediente.</p>
              ) : medNum <= 0 ? (
                <p className="font-medium text-slate-500">Informe a dosagem/porção.</p>
              ) : (
                <>
                  <p className="text-lg font-black text-indigo-700">Com o saldo atual, dá para {completos} {tipo} {completos === 1 ? "completo" : "completos"} de {fmtQtd(medNum, un)}.</p>
                  <p className="mt-1 text-sm font-bold text-slate-600">Sobra estimada: {fmtQtd(sobra, unItem)}.</p>
                </>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <button onClick={salvarPadrao} disabled={salvando || medNum <= 0 || invalido} className="rounded-xl border border-indigo-200 px-4 py-2.5 text-sm font-black text-indigo-700 disabled:opacity-50">
                {salvando ? "..." : "Salvar como medida padrão"}
              </button>
              <button onClick={() => setAberto(false)} className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-bold text-slate-600">Fechar</button>
            </div>
            <p className="mt-3 text-[11px] text-slate-400">Apenas consulta — não altera o estoque, não cria baixa e não abre embalagem.</p>
          </div>
        </div>
      )}
    </>
  );
}
