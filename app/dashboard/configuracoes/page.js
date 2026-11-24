"use client";

// CONFIGURAÇÕES (refeita em 24/11/2026: o dono achou "antiga, longa, complexa e
// nada objetiva"). Agora é uma lista curta em grupos, como os ajustes do
// celular: cada linha mostra o que vale hoje e abre só aquele assunto
// (?s=empresa, ?s=ponto…). Em cima, "Falta ajustar" mostra o que está
// incompleto ou inseguro. Grupos e regras: app/lib/configuracoes-hub.mjs.

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ChevronRight } from "lucide-react";
import { useERP } from "../../context/ERPContext";
import CabecalhoTela from "../../components/ui/CabecalhoTela";
import IconeModulo from "../../components/ui/IconeModulo";
import { canAccessRoute } from "../../lib/permissions-catalog.mjs";
import { gruposVisiveis, pendenciasConfig, resumoDoItem, SECOES_CONFIG } from "../../lib/configuracoes-hub.mjs";
import { fetchPins } from "../../lib/seguranca";
import { fetchParams, fetchValidadesEtiqueta } from "../../lib/parametros";
import { fetchCargos } from "../../lib/rh";
import Empresa from "./_secoes/Empresa";
import Unidades from "./_secoes/Unidades";
import Cargos from "./_secoes/Cargos";
import Pin from "./_secoes/Pin";
import Parametros from "./_secoes/Parametros";
import Validades from "./_secoes/Validades";
import Instalar from "./_secoes/Instalar";

const BASE = "/dashboard/configuracoes";

function Linha({ item, resumo, onAbrir }) {
  const corpo = (
    <>
      <IconeModulo item={{ icone: item.icone, cor: item.cor }} tamanho="sm" />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-hf-text">{item.titulo}</span>
        {resumo && <span className="block truncate text-[13px] text-hf-muted">{resumo}</span>}
      </span>
      <ChevronRight size={18} className="shrink-0 text-hf-muted" />
    </>
  );
  const cls = "flex min-h-[64px] w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-hf-elevated";
  return item.href
    ? <Link href={item.href} className={cls}>{corpo}</Link>
    : <button type="button" onClick={() => onAbrir(item.secao)} className={cls}>{corpo}</button>;
}

function Hub({ abrir }) {
  const { sessao, unidadeAtiva, unidades, unidadeInfo } = useERP();
  const real = unidadeAtiva && unidadeAtiva !== "todas";
  const [dados, setDados] = useState({});

  useEffect(() => {
    if (!real) { setDados({}); return; }
    let vivo = true;
    const por = (k) => (r) => vivo && setDados((d) => ({ ...d, [k]: r?.data ?? null }));
    fetchPins(unidadeAtiva).then(por("pins"));
    fetchParams(unidadeAtiva).then(por("params"));
    fetchCargos(unidadeAtiva).then((r) => vivo && setDados((d) => ({ ...d, cargos: r?.data || [] })));
    fetchValidadesEtiqueta(unidadeAtiva).then(por("validades"));
    return () => { vivo = false; };
  }, [unidadeAtiva, real]);

  const grupos = useMemo(() => gruposVisiveis((rota) => canAccessRoute(sessao, rota, "")), [sessao]);
  const info = { ...dados, unidade: real ? unidadeInfo : null, unidades: (unidades || []).filter((u) => u.id !== "todas") };
  const pendencias = pendenciasConfig({ unidade: info.unidade, pins: dados.pins });

  return (
    <div className="mx-auto w-full max-w-2xl px-4 pb-24 sm:px-6">
      <CabecalhoTela titulo="Configurações" subtitulo={real ? unidadeInfo?.nome : "Escolha uma unidade"} embutido />

      {pendencias.length > 0 && (
        <section className="mt-4 rounded-2xl border border-hf-warning/40 bg-hf-warning/10 p-4">
          <h2 className="mb-2 flex items-center gap-2 text-[14px] font-semibold text-hf-text"><AlertTriangle size={17} className="text-hf-warning" /> Falta ajustar</h2>
          <ul className="space-y-1">
            {pendencias.map((p) => (
              <li key={p.texto}>
                <button type="button" onClick={() => abrir(p.secao)} className="flex min-h-[40px] w-full items-center justify-between gap-2 text-left text-[14px] text-hf-text">
                  {p.texto} <ChevronRight size={16} className="shrink-0 text-hf-muted" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {grupos.map((g) => (
        <section key={g.id} className="mt-6">
          <h2 className="mb-2 px-1 text-[13px] font-medium text-hf-muted">{g.titulo}</h2>
          <div className="overflow-hidden rounded-2xl border border-hf-border bg-hf-surface divide-y divide-hf-border">
            {g.itens.map((i) => <Linha key={i.id} item={i} resumo={i.resumoFixo || resumoDoItem(i.id, info)} onAbrir={abrir} />)}
          </div>
        </section>
      ))}
    </div>
  );
}

function Configuracoes() {
  const router = useRouter();
  const busca = useSearchParams();
  const secao = SECOES_CONFIG.includes(busca.get("s")) ? busca.get("s") : null;
  const abrir = (s) => { router.push(`${BASE}?s=${s}`); window.scrollTo(0, 0); };
  const voltar = () => { router.push(BASE); window.scrollTo(0, 0); };

  switch (secao) {
    case "empresa": return <Empresa onVoltar={voltar} />;
    case "unidades": return <Unidades onVoltar={voltar} />;
    case "cargos": return <Cargos onVoltar={voltar} />;
    case "pin": return <Pin onVoltar={voltar} />;
    case "ponto": return <Parametros grupo="ponto" onVoltar={voltar} />;
    case "metas": return <Parametros grupo="metas" onVoltar={voltar} />;
    case "validades": return <Validades onVoltar={voltar} />;
    case "instalar": return <Instalar onVoltar={voltar} />;
    default: return <Hub abrir={abrir} />;
  }
}

export default function ConfiguracoesPage() {
  return <Suspense fallback={null}><Configuracoes /></Suspense>;
}
