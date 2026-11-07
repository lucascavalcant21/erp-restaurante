"use client";

// Busca da equipe: fichas, montagem e cardápio da área, só para ver.

import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ChevronDown, Search, UtensilsCrossed } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { fetchConsultaDaArea } from "../../../lib/area-anotacoes";
import { AREAS_DA_EQUIPE, areaValida, buscarNaConsulta, montarConsulta } from "../../../lib/consulta-area.mjs";
import CabecalhoTela from "../../../components/ui/CabecalhoTela";

const brl = (v) => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const qtd = (v) => (v == null ? "" : String(Math.round(Number(v) * 1000) / 1000).replace(".", ","));

function Bloco({ titulo, children }) {
  return <div className="mt-3"><p className="text-xs font-bold uppercase tracking-wide text-hf-muted">{titulo}</p><div className="mt-1 whitespace-pre-line text-sm text-hf-text">{children}</div></div>;
}

function Item({ item }) {
  const [aberto, setAberto] = useState(false);
  return (
    <li className="overflow-hidden rounded-2xl border border-hf-border bg-hf-surface">
      <button type="button" aria-expanded={aberto} onClick={() => setAberto(!aberto)} className="flex min-h-[64px] w-full items-center gap-3 p-3 text-left">
        <span className="grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-hf-elevated text-hf-muted">
          {item.foto ? <img src={item.foto} alt="" className="h-full w-full object-cover" /> : <UtensilsCrossed size={20} aria-hidden="true" />}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block break-words font-bold text-hf-text">{item.nome}</span>
          <span className="block text-xs text-hf-muted">{[item.tipo, item.categoria].filter(Boolean).join(" · ")}</span>
        </span>
        {item.preco != null && <span className="shrink-0 text-sm font-bold text-hf-text">{brl(item.preco)}</span>}
        <ChevronDown size={18} className={`shrink-0 text-hf-muted transition-transform ${aberto ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      {aberto && (
        <div className="border-t border-hf-border px-3 pb-3">
          {item.foto && <img src={item.foto} alt={`Foto de ${item.nome}`} className="mt-3 max-h-72 w-full rounded-xl object-cover" />}
          {item.descricao && <Bloco titulo="Descrição">{item.descricao}</Bloco>}
          {item.ingredientes.length > 0 && <Bloco titulo="Ingredientes">
            <ul className="space-y-0.5">{item.ingredientes.map((i) => <li key={i.nome} className="flex justify-between gap-3"><span>{i.nome}</span><span className="shrink-0 tabular-nums text-hf-text-2">{qtd(i.quantidade)} {i.unidade}</span></li>)}</ul>
          </Bloco>}
          {item.rendimento && <Bloco titulo="Rendimento">{item.rendimento}</Bloco>}
          {item.preparo && <Bloco titulo="Como fazer">{item.preparo}</Bloco>}
          {item.montagem && <Bloco titulo="Montagem">{item.montagem}</Bloco>}
          {(item.copo || item.gelo || item.guarnicao) && <Bloco titulo="Serviço">{[item.copo && `Copo: ${item.copo}`, item.gelo && `Gelo: ${item.gelo}`, item.guarnicao && `Guarnição: ${item.guarnicao}`].filter(Boolean).join("\n")}</Bloco>}
          {item.alergenicos && <Bloco titulo="Pode conter">{item.alergenicos}</Bloco>}
          {item.validadeDias && <Bloco titulo="Validade">{item.validadeDias} dias</Bloco>}
          {item.tipo !== "Cardápio" && !item.preparo && !item.montagem && <p className="mt-3 text-sm text-hf-text-2">Esta ficha ainda está sem preparo e montagem.</p>}
        </div>
      )}
    </li>
  );
}

function Consulta() {
  const area = areaValida(useSearchParams().get("dept")) || "cozinha";
  const { unidadeAtiva } = useERP();
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    if (!unidadeAtiva) return undefined;
    let vivo = true;
    setDados(null); setErro(null);
    fetchConsultaDaArea(unidadeAtiva, area).then((r) => {
      if (!vivo) return;
      if (r.error) setErro("Não consegui carregar tudo. Tente de novo.");
      setDados(montarConsulta(r));
    });
    return () => { vivo = false; };
  }, [unidadeAtiva, area]);

  const lista = useMemo(() => buscarNaConsulta(dados || [], busca), [dados, busca]);

  return (
    <div className="mx-auto min-h-screen w-full max-w-3xl bg-hf-bg px-4 pb-16 pt-4">
      <CabecalhoTela embutido titulo={`Buscar na ${area === "bar" ? "carta do bar" : "cozinha"}`} subtitulo={`Fichas, montagem e cardápio ${area === "bar" ? "do Bar" : `da ${AREAS_DA_EQUIPE[area]}`}.`} />
      <label className="relative mt-3 block">
        <span className="sr-only">Buscar prato, drink ou ingrediente</span>
        <Search size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-hf-muted" aria-hidden="true" />
        <input type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Prato, drink ou ingrediente" className="h-12 w-full rounded-xl border border-hf-border bg-hf-surface pl-11 pr-3 text-base text-hf-text outline-none focus:border-hf-accent" />
      </label>
      {erro && <p role="alert" className="mt-3 text-sm font-bold text-hf-danger">{erro}</p>}
      {!dados ? <p className="mt-4 text-sm text-hf-muted">Carregando…</p>
        : lista.length === 0 ? <p className="mt-4 text-sm text-hf-text-2">{busca.trim() ? "Nada encontrado." : "Ainda não há nada cadastrado nesta área."}</p>
          : <ul className="mt-3 space-y-2">{lista.map((i) => <Item key={i.id} item={i} />)}</ul>}
    </div>
  );
}

export default function ConsultaPage() {
  return <Suspense fallback={<p className="p-8 text-center text-sm text-hf-muted">Carregando…</p>}><Consulta /></Suspense>;
}
