"use client";

// AÇÕES RÁPIDAS DO RH (pedido do dono, 23/11/2026): "folga de domingo, feriados,
// o funcionário bateu o ponto errado, dar folga, o funcionário está doente —
// tudo mais prático e mais rápido". Uma tela, cinco abas, poucos toques.
// Regras em app/lib/rh-rapido.mjs; grava pelas funções de app/lib/rh.js (o
// banco confere a permissão de cada um).

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { CalendarDays, CalendarOff, Check, Clock, HeartPulse, Loader2, Minus, Plus, Sun, Trash2, X } from "lucide-react";
import CabecalhoTela from "../../../components/ui/CabecalhoTela";
import { useERP } from "../../../context/ERPContext";
import { usePermission } from "../../../components/access-control/PermissionGate";
import {
  fetchColaboradores, fetchAllFolgasDaUnidade, inserirFolgaEsporadica, removerFolgaEsporadica,
  fetchAtestadosUnidade, salvarAtestado, anexarArquivoAtestado, fetchFeriados, inserirFeriado, removerFeriado,
} from "../../../lib/rh";
import { fetchPontoDoDia } from "../../../lib/ponto";
import { avisosDaFolga, dataCurta, nomeDoMes } from "../../../lib/folgas-domingo.mjs";
import { ativo, conferirAtestado, diasDoPeriodo, domingosDaEscala, escalaDeDomingos, feriadosParaSugerir, planoDeFolgas, primeiroNome, somarDias } from "../../../lib/rh-rapido.mjs";

const hojeLocal = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
const pill = (on) => `min-h-[44px] shrink-0 rounded-full px-4 text-sm font-bold ${on ? "bg-hf-menu text-white" : "border border-hf-border bg-hf-surface text-hf-text-2"}`;
const inputCls = "h-12 w-full rounded-full border border-hf-border bg-hf-surface px-4 text-[16px] font-semibold text-hf-text outline-none focus:border-hf-accent";
const horaSP = (iso) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
const diaSemana = (iso) => new Date(`${iso}T12:00:00Z`).toLocaleDateString("pt-BR", { weekday: "short", timeZone: "UTC" }).replace(".", "");

const ABAS = [
  { id: "domingos", rotulo: "Domingos", Icone: Sun },
  { id: "folga", rotulo: "Folga", Icone: CalendarOff },
  { id: "doente", rotulo: "Doente", Icone: HeartPulse },
  { id: "feriados", rotulo: "Feriados", Icone: CalendarDays },
  { id: "ponto", rotulo: "Corrigir ponto", Icone: Clock },
];

function EscolherPessoas({ equipe, sel, setSel, varias = true }) {
  return (
    <div className="flex flex-wrap gap-2">
      {varias && equipe.length > 2 && (
        <button type="button" onClick={() => setSel(sel.length === equipe.length ? [] : equipe.map((c) => c.id))} className={pill(sel.length === equipe.length)}>Todos</button>
      )}
      {equipe.map((c) => {
        const on = sel.includes(c.id);
        return (
          <button key={c.id} type="button" aria-pressed={on} onClick={() => setSel(varias ? (on ? sel.filter((x) => x !== c.id) : [...sel, c.id]) : [c.id])} className={pill(on)}>
            {primeiroNome(c.nome)}
          </button>
        );
      })}
    </div>
  );
}

function EscolherDia({ valor, setValor, hoje, opcoes = ["hoje", "amanha"] }) {
  const rot = { ontem: ["Ontem", somarDias(hoje, -1)], hoje: ["Hoje", hoje], amanha: ["Amanhã", somarDias(hoje, 1)] };
  return (
    <div className="flex flex-wrap items-center gap-2">
      {opcoes.map((k) => <button key={k} type="button" onClick={() => setValor(rot[k][1])} className={pill(valor === rot[k][1])}>{rot[k][0]}</button>)}
      <input type="date" value={valor} onChange={(e) => setValor(e.target.value)} aria-label="Outra data" className="h-11 rounded-full border border-hf-border bg-hf-surface px-4 text-sm font-bold" />
    </div>
  );
}

export default function RhRapido() {
  const { unidadeAtiva } = useERP();
  const podeMexer = usePermission("rh.quick.edit");
  const hoje = hojeLocal();
  const [aba, setAba] = useState("domingos");
  const [equipeToda, setEquipeToda] = useState([]);
  const [folgas, setFolgas] = useState([]);
  const [atestados, setAtestados] = useState([]);
  const [feriados, setFeriados] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [aviso, setAviso] = useState("");
  const [ocupado, setOcupado] = useState(false);

  const avisar = (t) => { setAviso(t); setTimeout(() => setAviso(""), 4000); };

  const carregar = useCallback(async () => {
    if (!unidadeAtiva || unidadeAtiva === "todas") { setCarregando(false); return; }
    const ano = hoje.slice(0, 4);
    const [c, f, a, fe] = await Promise.all([
      fetchColaboradores(unidadeAtiva), fetchAllFolgasDaUnidade(unidadeAtiva),
      fetchAtestadosUnidade(unidadeAtiva, { desde: somarDias(hoje, -30) }), fetchFeriados(unidadeAtiva),
    ]);
    setEquipeToda(c.data || []);
    setFolgas(f.data || []);
    setAtestados(a.data || []);
    setFeriados((fe.data || []).filter((x) => String(x.data) >= `${ano}-01-01`));
    setCarregando(false);
  }, [unidadeAtiva, hoje]);
  useEffect(() => { setCarregando(true); carregar(); }, [carregar]);

  const equipe = useMemo(() => equipeToda.filter(ativo).sort((a, b) => String(a.nome).localeCompare(String(b.nome), "pt-BR")), [equipeToda]);
  const nomeDe = (id) => primeiroNome(equipeToda.find((c) => c.id === id)?.nome) || "?";

  // ─── Domingos ───
  const domingos = useMemo(() => domingosDaEscala(hoje), [hoje]);
  const grade = useMemo(() => escalaDeDomingos(equipeToda, folgas, domingos), [equipeToda, folgas, domingos]);
  const [soDomingo, setSoDomingo] = useState(true);

  async function alternarDomingo(linha, cel) {
    if (!podeMexer || ocupado) return;
    const colab = equipeToda.find((c) => c.id === linha.id);
    if (cel.folga) {
      if (!window.confirm(`Tirar a folga de domingo de ${linha.primeiro} em ${dataCurta(cel.data)}?`)) return;
      setOcupado(true);
      const { error } = await removerFolgaEsporadica(cel.folgaId);
      setOcupado(false);
      if (error) return avisar(`Não tirou: ${error}`);
      setFolgas((fs) => fs.filter((f) => f.id !== cel.folgaId));
      return avisar(`Folga de ${linha.primeiro} em ${dataCurta(cel.data)} tirada.`);
    }
    const { data: pontoDoDia } = cel.data <= hoje ? await fetchPontoDoDia(linha.id, cel.data) : { data: null };
    const avisos = avisosDaFolga({ data: cel.data, hoje, nome: colab?.nome, folgas: folgas.filter((f) => f.colaborador_id === linha.id), pontoDoDia, horaLocal: horaSP, genero: colab?.genero });
    if (avisos.length && !window.confirm(`${avisos.join("\n\n")}\n\nLançar mesmo assim?`)) return;
    setOcupado(true);
    const { error } = await inserirFolgaEsporadica(unidadeAtiva, linha.id, cel.data, "Domingo");
    setOcupado(false);
    if (error) return avisar(`Não lançou: ${error}`);
    await carregar();
    avisar(`Folga de domingo de ${linha.primeiro} em ${dataCurta(cel.data)}.`);
  }

  // ─── Folga ───
  const [folgaPessoas, setFolgaPessoas] = useState([]);
  const [folgaDe, setFolgaDe] = useState(hoje);
  const [folgaAte, setFolgaAte] = useState("");
  const [folgaMotivo, setFolgaMotivo] = useState("");
  async function darFolga() {
    const datas = diasDoPeriodo(folgaDe, folgaAte || folgaDe);
    const plano = planoDeFolgas({ colaboradores: equipe, ids: folgaPessoas, datas, folgas, motivo: folgaMotivo.trim() });
    if (!plano.gravar.length) return avisar(plano.pulados.length ? "Já estão de folga nesses dias." : "Escolha quem e quando.");
    const resumo = `${plano.gravar.length} folga(s): ${[...new Set(plano.gravar.map((g) => g.nome))].join(", ")} · ${datas.length === 1 ? dataCurta(datas[0]) : `${dataCurta(datas[0])} a ${dataCurta(datas[datas.length - 1])}`}`;
    if (folgaDe < hoje && !window.confirm(`${dataCurta(folgaDe)} já passou: folga retroativa (o espelho muda).\n\n${resumo}\n\nLançar?`)) return;
    setOcupado(true);
    const erros = [];
    for (const g of plano.gravar) {
      const { error } = await inserirFolgaEsporadica(unidadeAtiva, g.colaborador_id, g.data_folga, g.descricao);
      if (error) erros.push(`${g.nome} ${dataCurta(g.data_folga)}: ${error}`);
    }
    setOcupado(false);
    await carregar();
    setFolgaPessoas([]); setFolgaAte(""); setFolgaMotivo("");
    avisar(erros.length ? `Lançou com falhas: ${erros.join("; ")}` : `Pronto. ${resumo}${plano.pulados.length ? ` (${plano.pulados.length} já tinham folga)` : ""}.`);
  }
  const proximasFolgas = useMemo(() => folgas.filter((f) => String(f.data_folga).slice(0, 10) >= hoje && String(f.data_folga).slice(0, 10) <= somarDias(hoje, 21))
    .sort((a, b) => String(a.data_folga).localeCompare(String(b.data_folga))), [folgas, hoje]);

  // ─── Doente ───
  const [doentePessoa, setDoentePessoa] = useState([]);
  const [doenteInicio, setDoenteInicio] = useState(hoje);
  const [doenteDias, setDoenteDias] = useState(1);
  const [doenteFoto, setDoenteFoto] = useState(null);
  const [doenteParcial, setDoenteParcial] = useState(false);
  async function lancarAtestado() {
    const r = conferirAtestado({ colaboradorId: doentePessoa[0], inicio: doenteInicio, dias: doenteDias });
    if (r.erros.length) return avisar(r.erros.join(" "));
    setOcupado(true);
    let arquivo_url = null;
    if (doenteFoto) {
      const envio = await anexarArquivoAtestado(doentePessoa[0], doenteFoto);
      if (envio.error) { setOcupado(false); return avisar(`Não anexou a foto: ${envio.error}`); }
      arquivo_url = envio.url;
    }
    const { error } = await salvarAtestado({ unidade_id: unidadeAtiva, colaborador_id: doentePessoa[0], data_inicio: r.data_inicio, data_fim: r.data_fim, parcial: doenteParcial, arquivo_url });
    setOcupado(false);
    if (error) return avisar(`Não salvou: ${error}`);
    const nome = nomeDe(doentePessoa[0]);
    setDoentePessoa([]); setDoenteDias(1); setDoenteFoto(null); setDoenteParcial(false);
    await carregar();
    avisar(`Atestado de ${nome}: ${r.dias} dia(s), de ${dataCurta(r.data_inicio)} a ${dataCurta(r.data_fim)}. Não conta como falta.`);
  }

  // ─── Feriados ───
  const [ferData, setFerData] = useState("");
  const [ferNome, setFerNome] = useState("");
  const sugestoes = useMemo(() => feriadosParaSugerir(hoje, feriados), [hoje, feriados]);
  async function addFeriado(data, nome) {
    if (!data) return avisar("Escolha a data do feriado.");
    if (feriados.some((f) => String(f.data).slice(0, 10) === data)) return avisar(`${dataCurta(data)} já é feriado.`);
    setOcupado(true);
    const { error } = await inserirFeriado(unidadeAtiva, data, nome || null);
    setOcupado(false);
    if (error) return avisar(`Não salvou: ${error}`);
    setFerData(""); setFerNome("");
    await carregar();
    avisar(`Feriado em ${dataCurta(data)}${nome ? ` (${nome})` : ""}.`);
  }
  async function tirarFeriado(f) {
    if (!window.confirm(`Tirar o feriado de ${dataCurta(f.data)}${f.nome ? ` (${f.nome})` : ""}?`)) return;
    const { error } = await removerFeriado(f.id);
    if (error) return avisar(`Não tirou: ${error}`);
    await carregar();
  }

  // ─── Corrigir ponto ───
  const [pontoPessoa, setPontoPessoa] = useState([]);
  const [pontoDia, setPontoDia] = useState(hoje);

  if (!unidadeAtiva || unidadeAtiva === "todas") return <div className="p-8 text-center font-bold text-hf-text-2">Escolha uma unidade.</div>;

  const linhas = soDomingo ? grade.linhas.filter((l) => l.trabalhaDomingo) : grade.linhas;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-4 py-5 sm:px-6">
      <CabecalhoTela titulo="Ações rápidas do RH" subtitulo="Folga de domingo, folga, atestado, feriado e correção de ponto" />
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]">
        {ABAS.map(({ id, rotulo, Icone }) => (
          <button key={id} type="button" onClick={() => setAba(id)} className={`${pill(aba === id)} inline-flex items-center gap-1.5`}><Icone size={16} /> {rotulo}</button>
        ))}
      </div>
      {!podeMexer && <p className="rounded-2xl bg-hf-elevated px-4 py-2 text-sm font-semibold text-hf-text-2">Você só pode ver. Para lançar, peça ao dono a permissão “Ações rápidas do RH”.</p>}
      {aviso && <p role="status" className="rounded-2xl bg-hf-elevated px-4 py-2 text-sm font-bold text-hf-text">{aviso}</p>}

      {carregando ? (
        <p className="py-10 text-center font-bold text-hf-text-2"><Loader2 className="mr-2 inline animate-spin" size={18} />Carregando a equipe…</p>
      ) : aba === "domingos" ? (
        <section className="space-y-3">
          {grade.faltando.length > 0 && (
            <p className="rounded-2xl border border-hf-warning/40 bg-hf-elevated px-4 py-2 text-[14px] font-semibold text-hf-text">
              Sem folga de domingo: {grade.meses.map((m) => { const n = grade.faltando.filter((f) => f.anoMes === m).map((f) => f.nome); return n.length ? `${nomeDoMes(m)} — ${n.join(", ")}` : null; }).filter(Boolean).join(" · ")}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-hf-muted">
            <button type="button" onClick={() => setSoDomingo(!soDomingo)} className={pill(soDomingo)}>Só quem trabalha domingo</button>
            <span>Toque no domingo para dar ou tirar a folga. Regra: 1 por mês (2 para mulheres).</span>
          </div>
          <div className="overflow-x-auto rounded-3xl border border-hf-border bg-hf-surface">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 z-10 bg-hf-surface px-3 py-2 text-left text-[12px] font-black uppercase text-hf-muted">Funcionário</th>
                  {grade.colunas.map((d) => (
                    <th key={d.data} className={`px-1 py-2 text-center text-[12px] font-black ${d.passou ? "text-hf-muted" : "text-hf-text"}`}>
                      {d.rotulo}<span className="block text-[11px] font-semibold text-hf-muted">{d.deFolga.length ? `${d.deFolga.length} de folga` : "—"}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhas.map((l) => (
                  <tr key={l.id} className="border-t border-hf-border">
                    <td className="sticky left-0 z-10 min-w-[120px] bg-hf-surface px-3 py-2">
                      <p className="font-black text-hf-text">{l.primeiro}</p>
                      <p className="text-[11px] text-hf-muted">{l.porMes.map((m) => `${m.rotulo.slice(0, 3)} ${m.n}/${m.limite}`).join(" · ")}</p>
                    </td>
                    {l.celulas.map((c, i) => {
                      const passou = grade.colunas[i].passou;
                      const mes = l.porMes.find((m) => m.anoMes === grade.colunas[i].anoMes);
                      return (
                        <td key={c.data} className="px-1 py-1.5 text-center">
                          <button type="button" disabled={!podeMexer || ocupado} onClick={() => alternarDomingo(l, c)} aria-label={`${l.primeiro} ${c.data} ${c.folga ? "de folga" : "trabalha"}`}
                            className={`grid h-11 w-11 place-items-center rounded-2xl text-[12px] font-black ${c.folga ? "bg-hf-menu text-white" : mes?.situacao === "falta" && !passou ? "border-2 border-dashed border-hf-warning text-hf-muted" : "border border-hf-border text-hf-muted"} ${passou ? "opacity-60" : ""}`}>
                            {c.folga ? <Check size={18} /> : ""}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
                {!linhas.length && <tr><td colSpan={grade.colunas.length + 1} className="px-3 py-6 text-center text-hf-muted">Ninguém trabalha domingo pela ficha.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      ) : aba === "folga" ? (
        <section className="space-y-4">
          <div className="space-y-3 rounded-3xl border border-hf-border bg-hf-surface p-4">
            <p className="text-sm font-black text-hf-text">Quem?</p>
            <EscolherPessoas equipe={equipe} sel={folgaPessoas} setSel={setFolgaPessoas} />
            <p className="text-sm font-black text-hf-text">Quando?</p>
            <EscolherDia valor={folgaDe} setValor={setFolgaDe} hoje={hoje} />
            <label className="flex flex-wrap items-center gap-2 text-sm font-semibold text-hf-text-2">Até (vários dias):
              <input type="date" value={folgaAte} min={folgaDe} onChange={(e) => setFolgaAte(e.target.value)} className="h-11 rounded-full border border-hf-border bg-hf-surface px-4 text-sm font-bold" />
              {folgaAte && <button type="button" onClick={() => setFolgaAte("")} className="text-hf-danger"><X size={16} /></button>}
            </label>
            <input value={folgaMotivo} onChange={(e) => setFolgaMotivo(e.target.value)} placeholder="Motivo (opcional): troca, compensação…" className={inputCls} />
            <button type="button" disabled={!podeMexer || ocupado || !folgaPessoas.length} onClick={darFolga} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-hf-menu text-[15px] font-black text-white disabled:opacity-40">
              {ocupado ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Dar folga
            </button>
          </div>
          <div>
            <p className="mb-2 text-[13px] font-medium text-hf-muted">Próximas folgas (3 semanas)</p>
            <ul className="space-y-1.5">
              {proximasFolgas.map((f) => (
                <li key={f.id} className="flex items-center gap-3 rounded-2xl border border-hf-border bg-hf-surface px-4 py-2">
                  <span className="w-20 shrink-0 text-sm font-black text-hf-text">{diaSemana(String(f.data_folga).slice(0, 10))} {dataCurta(f.data_folga)}</span>
                  <span className="min-w-0 flex-1 text-sm font-bold text-hf-text">{nomeDe(f.colaborador_id)} <span className="font-medium text-hf-muted">{f.descricao || ""}</span></span>
                  {podeMexer && <button type="button" aria-label="Tirar folga" onClick={async () => { if (!window.confirm(`Tirar a folga de ${nomeDe(f.colaborador_id)} em ${dataCurta(f.data_folga)}?`)) return; const { error } = await removerFolgaEsporadica(f.id); if (error) avisar(error); else carregar(); }} className="grid h-10 w-10 place-items-center rounded-full text-hf-danger"><Trash2 size={16} /></button>}
                </li>
              ))}
              {!proximasFolgas.length && <li className="text-sm text-hf-muted">Nenhuma folga marcada.</li>}
            </ul>
          </div>
        </section>
      ) : aba === "doente" ? (
        <section className="space-y-4">
          <div className="space-y-3 rounded-3xl border border-hf-border bg-hf-surface p-4">
            <p className="text-sm font-black text-hf-text">Quem está doente?</p>
            <EscolherPessoas equipe={equipe} sel={doentePessoa} setSel={setDoentePessoa} varias={false} />
            <p className="text-sm font-black text-hf-text">Desde quando?</p>
            <EscolherDia valor={doenteInicio} setValor={setDoenteInicio} hoje={hoje} opcoes={["ontem", "hoje", "amanha"]} />
            <p className="text-sm font-black text-hf-text">Quantos dias de atestado?</p>
            <div className="flex items-center gap-2">
              <button type="button" aria-label="Menos um dia" onClick={() => setDoenteDias(Math.max(1, doenteDias - 1))} className="grid h-12 w-12 place-items-center rounded-full border border-hf-border"><Minus size={18} /></button>
              <span className="min-w-[110px] text-center text-[20px] font-black tabular-nums text-hf-text">{doenteDias} dia{doenteDias > 1 ? "s" : ""}</span>
              <button type="button" aria-label="Mais um dia" onClick={() => setDoenteDias(Math.min(30, doenteDias + 1))} className="grid h-12 w-12 place-items-center rounded-full border border-hf-border"><Plus size={18} /></button>
              <span className="text-sm text-hf-muted">até {dataCurta(somarDias(doenteInicio, doenteDias - 1))}</span>
            </div>
            <label className="flex items-center gap-2 text-sm font-semibold text-hf-text-2">
              <input type="checkbox" checked={doenteParcial} onChange={(e) => setDoenteParcial(e.target.checked)} className="h-5 w-5" /> Só parte do dia (consulta, exame)
            </label>
            <label className="block text-sm font-semibold text-hf-text-2">Foto do atestado (opcional)
              <input type="file" accept="image/*,application/pdf" capture="environment" onChange={(e) => setDoenteFoto(e.target.files?.[0] || null)} className="mt-1 block w-full text-sm" />
            </label>
            <button type="button" disabled={!podeMexer || ocupado || !doentePessoa.length} onClick={lancarAtestado} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-hf-menu text-[15px] font-black text-white disabled:opacity-40">
              {ocupado ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Lançar atestado
            </button>
            <p className="text-[12px] text-hf-muted">Atestado não conta como falta e não desconta. CID e médico, se precisar, ficam na ficha do funcionário.</p>
          </div>
          <div>
            <p className="mb-2 text-[13px] font-medium text-hf-muted">Atestados dos últimos 30 dias</p>
            <ul className="space-y-1.5">
              {atestados.map((a) => (
                <li key={a.id} className="rounded-2xl border border-hf-border bg-hf-surface px-4 py-2 text-sm">
                  <b className="text-hf-text">{nomeDe(a.colaborador_id)}</b> <span className="text-hf-muted">· {dataCurta(a.data_inicio)}{a.data_fim && a.data_fim !== a.data_inicio ? ` a ${dataCurta(a.data_fim)}` : ""}{a.parcial ? " · parte do dia" : ""}{a.arquivo_url ? " · com foto" : ""}</span>
                </li>
              ))}
              {!atestados.length && <li className="text-sm text-hf-muted">Nenhum atestado no período.</li>}
            </ul>
          </div>
        </section>
      ) : aba === "feriados" ? (
        <section className="space-y-4">
          {sugestoes.length > 0 && podeMexer && (
            <div className="rounded-3xl border border-hf-border bg-hf-surface p-4">
              <p className="mb-2 text-sm font-black text-hf-text">Feriados nacionais que ainda não estão lançados</p>
              <div className="flex flex-wrap gap-2">
                {sugestoes.map((s) => (
                  <button key={s.data} type="button" disabled={ocupado} onClick={() => addFeriado(s.data, s.nome)} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-hf-border px-4 text-sm font-bold text-hf-text">
                    <Plus size={14} /> {dataCurta(s.data)} · {s.nome}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[12px] text-hf-muted">Carnaval, Sexta-feira Santa, Corpus Christi e os feriados do estado e da cidade você lança abaixo.</p>
            </div>
          )}
          {podeMexer && (
            <div className="grid gap-2 rounded-3xl border border-hf-border bg-hf-surface p-4 sm:grid-cols-[180px_1fr_auto]">
              <input type="date" value={ferData} onChange={(e) => setFerData(e.target.value)} aria-label="Data do feriado" className={inputCls} />
              <input value={ferNome} onChange={(e) => setFerNome(e.target.value)} placeholder="Nome (ex.: Aniversário da cidade)" className={inputCls} />
              <button type="button" disabled={ocupado || !ferData} onClick={() => addFeriado(ferData, ferNome.trim())} className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-hf-menu px-5 text-sm font-black text-white disabled:opacity-40"><Plus size={16} /> Lançar</button>
            </div>
          )}
          <ul className="space-y-1.5">
            {feriados.map((f) => (
              <li key={f.id} className={`flex items-center gap-3 rounded-2xl border border-hf-border bg-hf-surface px-4 py-2 ${String(f.data) < hoje ? "opacity-60" : ""}`}>
                <span className="w-24 shrink-0 text-sm font-black text-hf-text">{diaSemana(String(f.data).slice(0, 10))} {dataCurta(f.data)}</span>
                <span className="min-w-0 flex-1 text-sm font-semibold text-hf-text">{f.nome || "Feriado"}</span>
                {podeMexer && <button type="button" aria-label="Tirar feriado" onClick={() => tirarFeriado(f)} className="grid h-10 w-10 place-items-center rounded-full text-hf-danger"><Trash2 size={16} /></button>}
              </li>
            ))}
            {!feriados.length && <li className="text-sm text-hf-muted">Nenhum feriado lançado neste ano.</li>}
          </ul>
        </section>
      ) : (
        <section className="space-y-3 rounded-3xl border border-hf-border bg-hf-surface p-4">
          <p className="text-sm font-black text-hf-text">De quem é o ponto?</p>
          <EscolherPessoas equipe={equipe} sel={pontoPessoa} setSel={setPontoPessoa} varias={false} />
          <p className="text-sm font-black text-hf-text">Qual dia?</p>
          <EscolherDia valor={pontoDia} setValor={setPontoDia} hoje={hoje} opcoes={["ontem", "hoje"]} />
          {pontoPessoa.length ? (
            <Link href={`/dashboard/rh/ponto/corrigir?colab=${pontoPessoa[0]}&data=${pontoDia}`} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-hf-menu text-[15px] font-black text-white">
              <Clock size={16} /> Corrigir o ponto de {nomeDe(pontoPessoa[0])} em {dataCurta(pontoDia)}
            </Link>
          ) : <p className="text-sm text-hf-muted">Escolha a pessoa para abrir a correção já no dia certo.</p>}
          <p className="text-[12px] text-hf-muted">A correção pede o motivo e o ajuste aparece no espelho; a batida original não é apagada.</p>
        </section>
      )}
    </div>
  );
}
