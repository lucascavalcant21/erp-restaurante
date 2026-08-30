"use client";

// CORREÇÃO DE BATIDA DO PONTO
//
// Esqueceu de picar, picou na hora errada, tablet fora do ar. Até aqui não
// havia como consertar pelo sistema — só mexendo no banco à mão, o que quebra
// o encadeamento por hash do livro de marcações.
//
// Corrigir aqui NÃO reescreve a batida original: entra uma marcação de ajuste
// guardando o valor anterior, quem corrigiu e o motivo, como manda a Portaria
// MTP 671/2021. Só depois o resumo do dia recebe a hora nova.

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Check, Loader2, ShieldCheck, Clock3 } from "lucide-react";
import { useERP } from "../../../../context/ERPContext";
import { fetchColaboradores } from "../../../../lib/rh";
import { fetchPontosMes, corrigirBatida, CAMPO_POR_TIPO } from "../../../../lib/ponto";
import { fetchPins } from "../../../../lib/seguranca";

const TIPOS = [
  ["entrada", "Entrada"],
  ["saida_intervalo", "Saída para intervalo"],
  ["retorno_intervalo", "Volta do intervalo"],
  ["saida_trabalho", "Saída do trabalho"],
];

const hojeISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const horaDe = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d) ? "" : `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export default function CorrigirPontoPage() {
  const router = useRouter();
  const { unidadeAtiva, sessao } = useERP();

  const [colaboradores, setColaboradores] = useState([]);
  const [colabId, setColabId] = useState("");
  const [data, setData] = useState(hojeISO());
  const [diaDoMes, setDiaDoMes] = useState(null);
  const [carregando, setCarregando] = useState(false);

  const [tipo, setTipo] = useState("entrada");
  const [hora, setHora] = useState("");
  const [motivo, setMotivo] = useState("");
  const [pinGerente, setPinGerente] = useState("");
  const [pinDigitado, setPinDigitado] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState(null);

  useEffect(() => {
    if (!unidadeAtiva || unidadeAtiva === "todas") return;
    fetchColaboradores(unidadeAtiva).then((r) =>
      setColaboradores((r.data || []).filter((c) => c.ativo !== false && String(c.status || "ativo").toLowerCase() !== "inativo")));
    fetchPins(unidadeAtiva).then((r) => setPinGerente(r.data.pin_gerente));
  }, [unidadeAtiva]);

  // Carrega o dia escolhido para mostrar o que está gravado hoje. Sem isso a
  // pessoa corrige às cegas e não vê o que está prestes a substituir.
  useEffect(() => {
    if (!colabId || !data) { setDiaDoMes(null); return; }
    let ativo = true;
    setCarregando(true);
    fetchPontosMes(colabId, data.slice(0, 7)).then((r) => {
      if (!ativo) return;
      setDiaDoMes((r.data || []).find((d) => String(d.data_referencia).slice(0, 10) === data) || null);
      setCarregando(false);
    });
    return () => { ativo = false; };
  }, [colabId, data]);

  const valorAtual = diaDoMes ? diaDoMes[CAMPO_POR_TIPO[tipo]] : null;
  const nomeColab = useMemo(
    () => colaboradores.find((c) => String(c.id) === String(colabId))?.nome || "",
    [colaboradores, colabId],
  );

  const salvar = async () => {
    setAviso(null);
    if (pinDigitado !== pinGerente) return setAviso({ erro: true, msg: "PIN do gerente incorreto." });
    if (!colabId) return setAviso({ erro: true, msg: "Escolha o colaborador." });
    if (!hora) return setAviso({ erro: true, msg: "Informe o horário corrigido." });

    // Saída depois da meia-noite pertence ao dia seguinte. O turno continua
    // sendo do dia de referência — é assim que o espelho fecha a jornada.
    const [h, m] = hora.split(":").map(Number);
    const base = new Date(`${data}T00:00:00`);
    const passouMeiaNoite = tipo === "saida_trabalho" && h < 6;
    if (passouMeiaNoite) base.setDate(base.getDate() + 1);
    base.setHours(h, m, 0, 0);

    setSalvando(true);
    const r = await corrigirBatida({
      unidadeId: unidadeAtiva,
      colaboradorId: colabId,
      dataReferencia: data,
      tipo,
      novaHoraISO: base.toISOString(),
      registradoPor: sessao?.nome || sessao?.user?.email || "Gerência",
      motivo,
    });
    setSalvando(false);
    if (r.error) return setAviso({ erro: true, msg: r.error });

    setAviso({
      erro: false,
      msg: `${nomeColab}: ${TIPOS.find(([id]) => id === tipo)[1].toLowerCase()} corrigida para ${hora}${passouMeiaNoite ? " do dia seguinte" : ""}.`
        + (r.nsr ? ` Ajuste registrado no livro sob NSR ${r.nsr}.` : ""),
    });
    setMotivo("");
    setHora("");
    setPinDigitado("");
    // Recarrega o dia para a tela mostrar o que ficou gravado.
    fetchPontosMes(colabId, data.slice(0, 7)).then((res) =>
      setDiaDoMes((res.data || []).find((d) => String(d.data_referencia).slice(0, 10) === data) || null));
  };

  const campo = "mt-1.5 h-12 w-full rounded-xl border border-slate-200 bg-white px-3.5 font-bold text-slate-800 outline-none focus:border-emerald-500";
  const rotulo = "text-[11px] font-black uppercase tracking-wider text-slate-500";

  return (
    <div className="min-h-screen bg-[var(--surface)] pb-16 text-slate-900">
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-7">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button onClick={() => router.back()} className="grid h-11 w-11 place-items-center rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50" aria-label="Voltar">
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-black sm:text-2xl">Corrigir batida do ponto</h1>
            <p className="text-sm font-semibold text-slate-500">A batida original não é apagada — entra um ajuste com motivo e autor</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 px-4 py-6 sm:px-7">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label><span className={rotulo}>Colaborador *</span>
              <select value={colabId} onChange={(e) => setColabId(e.target.value)} className={campo}>
                <option value="">Selecione…</option>
                {colaboradores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
              </select>
            </label>
            <label><span className={rotulo}>Dia *</span>
              <input type="date" value={data} onChange={(e) => setData(e.target.value)} className={campo} />
            </label>
          </div>

          {colabId && (
            <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className={rotulo}>O que está gravado neste dia</p>
              {carregando ? (
                <p className="mt-2 flex items-center gap-2 text-sm font-bold text-slate-500"><Loader2 size={15} className="animate-spin" /> Carregando…</p>
              ) : (
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {TIPOS.map(([id, nome]) => (
                    <div key={id} className="rounded-lg bg-white px-3 py-2 text-center">
                      <p className="text-[10px] font-black uppercase text-slate-400">{nome.split(" ")[0]}</p>
                      <p className="text-base font-black text-slate-800">{horaDe(diaDoMes?.[CAMPO_POR_TIPO[id]]) || "--:--"}</p>
                    </div>
                  ))}
                </div>
              )}
              {!carregando && !diaDoMes && (
                <p className="mt-2 text-xs font-bold text-amber-700">Nenhuma batida neste dia. A correção vai criar o registro.</p>
              )}
            </div>
          )}
        </section>

        <section className="rounded-2xl border-2 border-emerald-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-4 flex items-center gap-2"><Clock3 className="text-emerald-600" size={20} /><h2 className="text-lg font-black">A correção</h2></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <label><span className={rotulo}>Qual batida *</span>
              <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={campo}>
                {TIPOS.map(([id, nome]) => <option key={id} value={id}>{nome}</option>)}
              </select>
            </label>
            <label><span className={rotulo}>Horário correto *</span>
              <input type="time" value={hora} onChange={(e) => setHora(e.target.value)} className={campo} />
            </label>
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-500">
            Valor atual: <b className="text-slate-700">{horaDe(valorAtual) || "não marcado"}</b>
            {tipo === "saida_trabalho" && " · saída antes das 6h é entendida como madrugada do dia seguinte"}
          </p>
          <label className="mt-4 block"><span className={rotulo}>Motivo (opcional)</span>
            <textarea rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: tablet sem rede no fechamento"
              className={`${campo} h-auto py-3`} />
          </label>
          <p className="mt-1 text-xs font-semibold text-slate-500">Quando preenchido, fica gravado junto com o ajuste.</p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="mb-3 flex items-center gap-2"><ShieldCheck className="text-emerald-600" size={19} /><h2 className="font-black">Autorização</h2></div>
          <label className="block sm:max-w-[220px]"><span className={rotulo}>PIN do gerente *</span>
            <input type="password" inputMode="numeric" value={pinDigitado} onChange={(e) => setPinDigitado(e.target.value)} className={campo} />
          </label>
        </section>

        {aviso && (
          <p className={`rounded-xl px-4 py-3 text-sm font-bold ${aviso.erro ? "border border-red-200 bg-red-50 text-red-700" : "border border-emerald-200 bg-emerald-50 text-emerald-800"}`}>
            {aviso.msg}
          </p>
        )}

        <button onClick={salvar} disabled={salvando}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 text-base font-black text-white shadow-lg shadow-emerald-200 hover:bg-emerald-700 disabled:opacity-60">
          {salvando ? <Loader2 className="animate-spin" size={20} /> : <Check size={19} />} Registrar correção
        </button>
      </main>
    </div>
  );
}
