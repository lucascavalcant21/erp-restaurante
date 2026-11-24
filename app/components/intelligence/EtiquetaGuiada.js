"use client";

// ETIQUETA PELO NICO (dono, 24/11/2026): "etiqueta" → quem está etiquetando →
// o produto é aberto ou fechado → quais produtos → a validade → imprime.
// Tudo por toque. No fim abre a tela de Etiquetas com a prévia pronta: um
// toque em Imprimir (a impressora Bluetooth/USB só aceita comando de um toque).

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, Loader2, Minus, Plus, Printer, Search, X } from "lucide-react";
import { useERP } from "../../context/ERPContext";
import { fetchColaboradores } from "../../lib/rh";
import { fetchValidadesEtiqueta } from "../../lib/parametros";
import { equipeParaEtiquetar } from "../../lib/equipe-area.mjs";
import { carregarCatalogoEtiquetas } from "../../lib/etiquetas-catalogo";
import { VALIDADES_RAPIDAS, urlEtiquetaGuiada, validadePadraoEtiqueta } from "../../lib/etiquetas-pedido.mjs";

const VERDE = "var(--wa-verde-escuro, #005A49)";
const META = "var(--wa-meta, #667781)";
const semAcento = (v) => String(v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const primeiro = (n) => String(n || "").trim().split(/\s+/)[0];
const chip = (on) => `min-h-[48px] rounded-full px-4 text-[15.5px] font-bold ${on ? "text-white" : "bg-white"}`;

export default function EtiquetaGuiada() {
  const router = useRouter();
  const { unidadeAtiva } = useERP();
  const [passo, setPasso] = useState("quem");
  const [equipe, setEquipe] = useState(null);
  const [catalogo, setCatalogo] = useState(null);
  const [categorias, setCategorias] = useState([]);
  const [quem, setQuem] = useState(null);
  const [tipo, setTipo] = useState(null);
  const [busca, setBusca] = useState("");
  const [itens, setItens] = useState([]); // { nome, dias, copias }

  useEffect(() => {
    if (!unidadeAtiva || unidadeAtiva === "todas") return;
    let vivo = true;
    fetchColaboradores(unidadeAtiva).then((r) => { if (vivo) setEquipe(equipeParaEtiquetar(r.data).sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR"))); });
    fetchValidadesEtiqueta(unidadeAtiva).then((r) => { if (vivo) setCategorias(r.data || []); });
    carregarCatalogoEtiquetas(unidadeAtiva).then((l) => { if (vivo) setCatalogo(l); }).catch(() => { if (vivo) setCatalogo([]); });
    return () => { vivo = false; };
  }, [unidadeAtiva]);

  const achados = useMemo(() => {
    const q = semAcento(busca).trim();
    const lista = catalogo || [];
    return (q ? lista.filter((p) => semAcento(p.nome).includes(q)) : lista).slice(0, 40);
  }, [catalogo, busca]);

  const marcado = (nome) => itens.some((i) => i.nome === nome);
  const alternar = (nome) => setItens((xs) => (xs.some((i) => i.nome === nome) ? xs.filter((i) => i.nome !== nome) : [...xs, { nome, dias: validadePadraoEtiqueta(nome, categorias), copias: 1 }]));
  const mudar = (nome, campo, valor) => setItens((xs) => xs.map((i) => (i.nome === nome ? { ...i, [campo]: valor } : i)));
  const total = itens.reduce((t, i) => t + i.copias, 0);

  const Titulo = ({ n, texto }) => (
    <p className="mb-2 flex items-center gap-2 text-[16px] font-extrabold">
      <span className="grid h-7 w-7 place-items-center rounded-full text-[13px] text-white" style={{ background: VERDE }}>{n}</span>{texto}
    </p>
  );
  const Voltar = ({ para }) => (
    <button type="button" onClick={() => setPasso(para)} className="mb-2 inline-flex min-h-[40px] items-center gap-1 text-[14px] font-bold" style={{ color: META }}><ChevronLeft size={16} /> Voltar</button>
  );
  const Resumo = () => (
    <p className="mb-3 text-[14px]" style={{ color: META }}>
      {quem ? <b>{primeiro(quem.nome)}</b> : null}{tipo ? ` · produto ${tipo}` : ""}{itens.length ? ` · ${itens.length} produto(s)` : ""}
    </p>
  );

  if (passo === "quem") {
    return (
      <div className="w-full">
        <Titulo n={1} texto="Quem está etiquetando?" />
        {equipe === null ? <p className="text-[15px]" style={{ color: META }}><Loader2 size={16} className="mr-1 inline animate-spin" />Carregando a equipe…</p> : (
          <div className="flex flex-wrap gap-2">
            {equipe.map((c) => (
              <button key={c.id} type="button" onClick={() => { setQuem(c); setPasso("tipo"); }} className={chip(quem?.id === c.id)} style={quem?.id === c.id ? { background: VERDE } : undefined}>{primeiro(c.nome)}</button>
            ))}
            {!equipe.length && <p className="text-[15px]" style={{ color: META }}>Ninguém da equipe cadastrado no RH.</p>}
          </div>
        )}
      </div>
    );
  }

  if (passo === "tipo") {
    return (
      <div className="w-full">
        <Voltar para="quem" /><Resumo />
        <Titulo n={2} texto="O produto é aberto ou fechado?" />
        <div className="grid grid-cols-2 gap-2">
          {[["aberto", "Aberto", "Usar primeiro (faixa preta)"], ["fechado", "Fechado", "Embalagem lacrada"]].map(([id, rot, sub]) => (
            <button key={id} type="button" onClick={() => { setTipo(id); setPasso("produtos"); }} className="min-h-[76px] rounded-2xl bg-white px-3 py-3 text-left">
              <span className="block text-[17px] font-extrabold">{rot}</span><span className="text-[13px]" style={{ color: META }}>{sub}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (passo === "produtos") {
    return (
      <div className="w-full">
        <Voltar para="tipo" /><Resumo />
        <Titulo n={3} texto="Quais produtos?" />
        <label className="mb-2 flex h-12 items-center gap-2 rounded-full bg-white px-4">
          <Search size={16} style={{ color: META }} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Procurar (ex.: vatapá)" aria-label="Procurar produto" className="min-w-0 flex-1 bg-transparent text-[16px] outline-none" />
          {busca && <button type="button" onClick={() => setBusca("")} aria-label="Limpar"><X size={16} /></button>}
        </label>
        {catalogo === null ? <p className="text-[15px]" style={{ color: META }}><Loader2 size={16} className="mr-1 inline animate-spin" />Carregando os produtos…</p> : (
          <ul className="max-h-[320px] space-y-1.5 overflow-y-auto">
            {achados.map((p) => (
              <li key={p.id}>
                <button type="button" onClick={() => alternar(p.nome)} className="flex min-h-[48px] w-full items-center gap-3 rounded-2xl bg-white px-3 text-left">
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md border-2 ${marcado(p.nome) ? "border-transparent text-white" : "border-black/20"}`} style={marcado(p.nome) ? { background: VERDE } : undefined}>{marcado(p.nome) && <Check size={14} />}</span>
                  <span className="min-w-0 flex-1 text-[15.5px] font-semibold">{p.nome}</span>
                  <span className="text-[12px]" style={{ color: META }}>{p.origem}</span>
                </button>
              </li>
            ))}
            {!achados.length && <li className="text-[15px]" style={{ color: META }}>Nenhum produto com esse nome.</li>}
          </ul>
        )}
        <button type="button" disabled={!itens.length} onClick={() => setPasso("validade")} className="mt-3 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-full text-[16px] font-extrabold text-white disabled:opacity-40" style={{ background: VERDE }}>
          Continuar{itens.length ? ` (${itens.length})` : ""}
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      <Voltar para="produtos" /><Resumo />
      <Titulo n={4} texto="Validade e quantidade" />
      <ul className="space-y-2">
        {itens.map((i) => (
          <li key={i.nome} className="rounded-2xl bg-white p-3">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 text-[16px] font-bold">{i.nome}</span>
              <button type="button" aria-label="Menos uma etiqueta" onClick={() => mudar(i.nome, "copias", Math.max(1, i.copias - 1))} className="grid h-10 w-10 place-items-center rounded-full border border-black/10"><Minus size={16} /></button>
              <span className="w-8 text-center text-[17px] font-extrabold tabular-nums">{i.copias}</span>
              <button type="button" aria-label="Mais uma etiqueta" onClick={() => mudar(i.nome, "copias", Math.min(100, i.copias + 1))} className="grid h-10 w-10 place-items-center rounded-full border border-black/10"><Plus size={16} /></button>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {[...new Set([...VALIDADES_RAPIDAS, i.dias])].sort((a, b) => a - b).map((d) => (
                <button key={d} type="button" onClick={() => mudar(i.nome, "dias", d)} className={`min-h-[40px] rounded-full px-3 text-[14px] font-bold ${i.dias === d ? "text-white" : "border border-black/10"}`} style={i.dias === d ? { background: VERDE } : undefined}>
                  {d === 1 ? "1 dia" : `${d} dias`}
                </button>
              ))}
            </div>
          </li>
        ))}
      </ul>
      <button type="button" onClick={() => router.push(urlEtiquetaGuiada({ itens, responsavelId: quem?.id, tipo }))}
        className="mt-3 inline-flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full text-[17px] font-extrabold text-white" style={{ background: VERDE }}>
        <Printer size={18} /> Imprimir {total} etiqueta{total === 1 ? "" : "s"}
      </button>
      <p className="mt-1.5 text-center text-[12.5px]" style={{ color: META }}>Abre a prévia: confira e toque em Imprimir.</p>
    </div>
  );
}
