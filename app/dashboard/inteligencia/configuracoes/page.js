"use client";

// INTELIGÊNCIA > CONFIGURAÇÕES — poucas opções, de propósito. Sem mexer em
// nada, o Héfisto já funciona: todos os alertas ligados, sensibilidade normal
// e sem meta (a Central mostra "DADOS INSUFICIENTES" na meta até alguém
// digitar uma). Quem pode alterar é decidido no servidor
// (dashboard.intelligence.settings); a tela só mostra o que o servidor diz.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, Check } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { buscarPreferencias, salvarPreferencias } from "../../../lib/intelligence/client/api";
import { brl } from "../../../components/intelligence/Blocos";

const ROTULO_SENS = { baixa: "Baixa", normal: "Normal", alta: "Alta" };
const AJUDA_SENS = {
  baixa: "Só avisa desvios grandes.",
  normal: "Recomendado para a maioria das casas.",
  alta: "Avisa antes, inclusive desvios menores.",
};

/** "120.000,50" / "120000.5" → 120000.5; vazio → null; inválido → NaN */
function lerReais(txt) {
  const t = String(txt || "").replace(/[R$\s]/g, "");
  if (!t) return null;
  const n = Number(t.includes(",") ? t.replace(/\./g, "").replace(",", ".") : t);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : NaN;
}
const mostrar = (v) => (v == null ? "" : Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 2 }));

function CampoMeta({ id, rotulo, ajuda, valor, onChange, desabilitado }) {
  return (
    <label htmlFor={id} className="block">
      <span className="text-[13px] font-bold text-slate-800">{rotulo}</span>
      <div className="mt-1 flex items-center rounded-xl border border-slate-300 bg-white focus-within:border-slate-600">
        <span className="pl-3 text-[15px] font-bold text-slate-500">R$</span>
        <input id={id} inputMode="decimal" autoComplete="off" value={valor} disabled={desabilitado} onChange={(e) => onChange(e.target.value)}
          placeholder="—" className="h-12 w-full rounded-xl bg-transparent px-2 text-[16px] font-bold tabular-nums text-slate-900 outline-none disabled:opacity-60" />
      </div>
      {ajuda && <span className="mt-1 block text-[12px] text-slate-500">{ajuda}</span>}
    </label>
  );
}

export default function ConfiguracoesInteligencia() {
  const { unidadeAtiva, unidadeInfo } = useERP() || {};
  const semUnidade = !unidadeAtiva || unidadeAtiva === "todas";
  const [dados, setDados] = useState(null);
  const [erro, setErro] = useState(null);
  const [form, setForm] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState(null);
  const [verManual, setVerManual] = useState(false);

  const aplicar = (d) => {
    setDados(d);
    setForm({
      mensal: mostrar(d.preferencias.metas.mensal), semanal: mostrar(d.preferencias.metas.semanal), diaria: mostrar(d.preferencias.metas.diaria),
      alertas: { ...d.preferencias.alertas }, sensibilidade: d.preferencias.sensibilidade,
    });
    setVerManual(!!(d.preferencias.metas.semanal || d.preferencias.metas.diaria));
  };

  const carregar = useCallback(async () => {
    if (semUnidade) return;
    setErro(null);
    const r = await buscarPreferencias(unidadeAtiva);
    if (r.ok) aplicar(r.dados); else setErro(r.dados?.erro || "Não foi possível carregar as configurações.");
  }, [unidadeAtiva, semUnidade]);
  useEffect(() => { setDados(null); setForm(null); carregar(); }, [carregar]);

  const pode = !!dados?.podeConfigurar;
  const metas = form ? { mensal: lerReais(form.mensal), semanal: lerReais(form.semanal), diaria: lerReais(form.diaria) } : {};
  const invalida = Object.values(metas).some((v) => Number.isNaN(v));

  async function salvar() {
    if (!pode || invalida || salvando) return;
    setSalvando(true); setAviso(null);
    const r = await salvarPreferencias(unidadeAtiva, {
      metas: { mensal: metas.mensal, semanal: verManual ? metas.semanal : null, diaria: verManual ? metas.diaria : null },
      alertas: form.alertas, sensibilidade: form.sensibilidade,
    });
    setSalvando(false);
    if (r.ok) { aplicar(r.dados); setAviso({ tipo: "ok", texto: "Configurações salvas. A Central já usa os novos valores." }); }
    else setAviso({ tipo: "erro", texto: r.dados?.erro || "Não foi possível salvar." });
  }

  const sug = dados?.sugestao;
  const metodo = sug?.metodo === "historico_dia_semana"
    ? "pelo histórico de vendas desta unidade por dia da semana (últimas 8 semanas)"
    : "igualmente pelos dias (ainda não há histórico suficiente por dia da semana)";

  return (
    <div className="mx-auto w-full max-w-3xl px-4 pb-24 pt-5 sm:px-6 lg:pt-8">
      <Link href="/dashboard/inteligencia" className="inline-flex min-h-[44px] items-center gap-2 text-[13px] font-bold text-slate-600 hover:text-slate-900">
        <ArrowLeft size={16} /> Central de Inteligência
      </Link>
      <p className="mt-2 text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700">Héfisto</p>
      <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-3xl">Configurações da inteligência</h1>
      <p className="mt-1 text-[14px] text-slate-600">{unidadeInfo?.nome || unidadeAtiva || ""}{" · "}Sem configurar nada, tudo já funciona com o padrão.</p>

      {semUnidade ? (
        <p className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 text-[15px] text-slate-700">Selecione uma unidade: metas e alertas são de cada unidade.</p>
      ) : erro ? (
        <p className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-[15px] text-amber-900">{erro}</p>
      ) : !form ? (
        <p className="mt-6 flex items-center gap-2 text-[14px] text-slate-600"><Loader2 size={16} className="animate-spin" /> Carregando…</p>
      ) : (
        <div className="mt-6 space-y-8">
          {!pode && (
            <p className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-[14px] text-slate-700">
              Você pode ver estas configurações, mas não alterá-las. Peça a quem administra os acessos a permissão <strong>Central de Inteligência → Alterar configurações</strong>.
            </p>
          )}

          <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <h2 className="text-[13px] font-black uppercase tracking-[0.14em] text-slate-500">Meta de faturamento</h2>
            <CampoMeta id="meta-mensal" rotulo="Meta mensal" valor={form.mensal} desabilitado={!pode}
              onChange={(v) => setForm({ ...form, mensal: v })}
              ajuda="Vale para todos os meses até você mudar. Deixe em branco para ficar sem meta." />

            {sug?.hoje && (
              <div className="rounded-xl bg-violet-50 p-3 ring-1 ring-violet-200">
                <p className="text-[11px] font-black uppercase tracking-wide text-violet-800">Sugestão — não é realizado</p>
                <p className="mt-1 text-[14px] text-slate-800">
                  Hoje: <strong>{brl(sug.hoje.valor)}</strong>{sug.semana ? <> · Esta semana: <strong>{brl(sug.semana.valor)}</strong></> : null}
                </p>
                <p className="mt-1 text-[12px] text-slate-600">Distribuída {metodo}.</p>
                {sug.porDiaDaSemana?.length > 0 && (
                  <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-0.5 text-[12px] text-slate-700 sm:grid-cols-4">
                    {sug.porDiaDaSemana.map((d) => <li key={d.dia} className="flex justify-between gap-2"><span>{d.dia}</span><span className="tabular-nums">{brl(d.valor)}</span></li>)}
                  </ul>
                )}
              </div>
            )}

            <button type="button" onClick={() => setVerManual((v) => !v)} className="min-h-[44px] text-[13px] font-bold text-slate-700 underline">
              {verManual ? "Usar só a meta mensal" : "Definir meta semanal ou diária manualmente"}
            </button>
            {verManual && (
              <div className="grid gap-4 sm:grid-cols-2">
                <CampoMeta id="meta-semanal" rotulo="Meta semanal" valor={form.semanal} desabilitado={!pode} onChange={(v) => setForm({ ...form, semanal: v })} ajuda="Substitui a sugestão da semana." />
                <CampoMeta id="meta-diaria" rotulo="Meta diária" valor={form.diaria} desabilitado={!pode} onChange={(v) => setForm({ ...form, diaria: v })} ajuda="Substitui a sugestão do dia." />
              </div>
            )}
            {invalida && <p className="text-[13px] font-semibold text-amber-700">Digite valores em reais maiores que zero (ex.: 120.000,00).</p>}
          </section>

          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <h2 className="text-[13px] font-black uppercase tracking-[0.14em] text-slate-500">Alertas</h2>
            <p className="text-[13px] text-slate-600">Categorias que o Héfisto vigia na Central.</p>
            <div className="grid gap-2 sm:grid-cols-2">
              {dados.opcoes.categorias.map((c) => (
                <label key={c.id} className="flex min-h-[48px] items-center gap-3 rounded-xl border border-slate-200 px-3">
                  <input type="checkbox" className="h-5 w-5 accent-slate-900" disabled={!pode} checked={form.alertas[c.id] !== false}
                    onChange={(e) => setForm({ ...form, alertas: { ...form.alertas, [c.id]: e.target.checked } })} />
                  <span className="text-[15px] font-semibold text-slate-800">{c.rotulo}</span>
                </label>
              ))}
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <h2 className="text-[13px] font-black uppercase tracking-[0.14em] text-slate-500">Sensibilidade</h2>
            <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Sensibilidade dos alertas">
              {dados.opcoes.sensibilidades.map((sv) => (
                <label key={sv} className={`flex min-h-[64px] cursor-pointer flex-col justify-center rounded-xl border px-3 py-2 ${form.sensibilidade === sv ? "border-slate-900 ring-1 ring-slate-900" : "border-slate-200"}`}>
                  <span className="flex items-center gap-2">
                    <input type="radio" name="sensibilidade" className="h-4 w-4 accent-slate-900" disabled={!pode} checked={form.sensibilidade === sv} onChange={() => setForm({ ...form, sensibilidade: sv })} />
                    <span className="text-[15px] font-bold text-slate-800">{ROTULO_SENS[sv]}</span>
                  </span>
                  <span className="mt-0.5 text-[12px] text-slate-500">{AJUDA_SENS[sv]}</span>
                </label>
              ))}
            </div>
          </section>

          {aviso && <p className={`rounded-xl p-3 text-[14px] font-semibold ${aviso.tipo === "ok" ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-900"}`}>{aviso.tipo === "ok" && <Check size={15} className="mr-1 inline" />}{aviso.texto}</p>}

          {pode && (
            <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-[#F7F8F7] px-4 py-3 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
              <button type="button" onClick={salvar} disabled={salvando || invalida}
                className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-6 text-[15px] font-bold text-white hover:bg-slate-800 disabled:opacity-50 sm:w-auto">
                {salvando && <Loader2 size={16} className="animate-spin" />} Salvar configurações
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
