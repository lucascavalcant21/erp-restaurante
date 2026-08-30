"use client";

// CADASTRO FACIAL DOS FUNCIONÁRIOS
// O rosto é convertido em números no próprio aparelho. A foto não é enviada
// nem guardada. Exige consentimento do funcionário (LGPD: biometria é dado
// pessoal sensível).

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Camera, Check, Loader2, ScanFace, Trash2, ShieldCheck } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { fetchColaboradores, atualizarColaborador } from "../../../lib/rh";
import { prepararFacial, lerRosto, validarCapturas } from "../../../lib/facial";

const CAPTURAS_NECESSARIAS = 4;
const ORIENTACOES = [
  "Olhe de frente para a câmera",
  "Vire o rosto levemente para a direita",
  "Vire o rosto levemente para a esquerda",
  "De frente de novo, com expressão neutra",
];

export default function CadastroFacialPage() {
  const router = useRouter();
  const { unidadeAtiva } = useERP();
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const [colaboradores, setColaboradores] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [pessoa, setPessoa] = useState(null);
  const [consentiu, setConsentiu] = useState(false);
  const [capturas, setCapturas] = useState([]);
  const [status, setStatus] = useState("");
  const [erro, setErro] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!unidadeAtiva) return;
    fetchColaboradores(unidadeAtiva).then(r => {
      setColaboradores((r.data || []).filter(c => (c.status || "ativo") !== "inativo"));
      setCarregando(false);
    });
  }, [unidadeAtiva]);

  // Liga a câmera só enquanto alguém está sendo cadastrado.
  useEffect(() => {
    if (!pessoa || !consentiu) return;
    let vivo = true;
    (async () => {
      try {
        setStatus("Preparando o reconhecimento...");
        await prepararFacial(setStatus);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user", width: { ideal: 640 } }, audio: false,
        });
        if (!vivo) { stream.getTracks().forEach(t => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}); }
        setStatus("");
      } catch (e) {
        setErro(/denied|NotAllowed/i.test(e?.message || e?.name || "")
          ? "Permissão da câmera negada. Autorize a câmera para este site."
          : (e?.message || "Não consegui abrir a câmera."));
        setStatus("");
      }
    })();
    return () => {
      vivo = false;
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    };
  }, [pessoa, consentiu]);

  const capturar = async () => {
    if (!videoRef.current || ocupado) return;
    setOcupado(true);
    setErro("");
    const { descritor, erro: e } = await lerRosto(videoRef.current);
    setOcupado(false);
    if (e) { setErro(e); return; }
    setCapturas(a => [...a, descritor]);
  };

  const salvar = async () => {
    const problema = validarCapturas(capturas);
    if (problema) { setErro(problema); return; }
    setSalvando(true);
    const { error } = await atualizarColaborador(pessoa.id, {
      face_descritores: capturas,
      face_cadastrado_em: new Date().toISOString(),
      face_consentimento_em: new Date().toISOString(),
    });
    setSalvando(false);
    if (error) { setErro("Não consegui salvar: " + error); return; }
    setColaboradores(l => l.map(c => c.id === pessoa.id ? { ...c, face_descritores: capturas, face_cadastrado_em: new Date().toISOString() } : c));
    setPessoa(null); setCapturas([]); setConsentiu(false);
  };

  const apagarRosto = async (c) => {
    if (!confirm(`Apagar o cadastro facial de ${c.nome}? Ele precisará bater ponto pelo PIN até refazer.`)) return;
    await atualizarColaborador(c.id, { face_descritores: null, face_cadastrado_em: null, face_consentimento_em: null });
    setColaboradores(l => l.map(x => x.id === c.id ? { ...x, face_descritores: null, face_cadastrado_em: null } : x));
  };

  const temRosto = (c) => Array.isArray(c.face_descritores) && c.face_descritores.length > 0;

  return (
    <div className="min-h-screen bg-[var(--surface)] pb-24">
      <div className="sticky top-0 z-20 border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <button onClick={() => router.push("/dashboard/rh")} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-200">
            <ArrowLeft size={19} />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-black text-slate-900 sm:text-xl">Cadastro facial do ponto</h1>
            <p className="text-xs font-bold text-slate-500">O rosto vira números no aparelho — a foto não é guardada</p>
          </div>
        </div>
      </div>

      <main className="mx-auto max-w-3xl space-y-5 p-4 sm:p-6">
        {!pessoa ? (
          <>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
              <p className="flex items-center gap-2 text-sm font-black text-emerald-800"><ShieldCheck size={17} /> Como funciona</p>
              <p className="mt-1.5 text-[13px] font-medium leading-relaxed text-slate-600">
                São feitas 4 capturas do rosto. O aparelho converte cada uma em 128 números e guarda só isso.
                Nenhuma foto do cadastro é enviada ou armazenada, e não é possível recriar o rosto a partir desses números.
              </p>
            </div>

            {carregando ? (
              <p className="font-bold text-slate-500">Carregando equipe...</p>
            ) : (
              <div className="space-y-2">
                {colaboradores.map(c => (
                  <div key={c.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm">
                    <div className="min-w-0">
                      <p className="text-[15px] font-black text-slate-800 truncate">{c.nome}</p>
                      <p className="text-[12px] font-bold text-slate-500 truncate">
                        {c.cargo || "Equipe"}
                        {temRosto(c) && <span className="ml-2 text-emerald-700">· rosto cadastrado</span>}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {temRosto(c) && (
                        <button onClick={() => apagarRosto(c)} title="Apagar cadastro facial"
                          className="grid h-10 w-10 place-items-center rounded-xl border border-rose-200 bg-white text-rose-600 hover:bg-rose-50">
                          <Trash2 size={17} />
                        </button>
                      )}
                      <button onClick={() => { setPessoa(c); setCapturas([]); setConsentiu(false); setErro(""); }}
                        className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-black text-white hover:bg-emerald-700">
                        {temRosto(c) ? "Refazer" : "Cadastrar"}
                      </button>
                    </div>
                  </div>
                ))}
                {!colaboradores.length && <p className="font-bold text-slate-500">Nenhum funcionário ativo nesta unidade.</p>}
              </div>
            )}
          </>
        ) : !consentiu ? (
          /* Termo — biometria exige consentimento específico (LGPD art. 5º, II) */
          <div className="rounded-2xl border-2 border-emerald-200 bg-white p-5 shadow-sm">
            <p className="text-[11px] font-black uppercase tracking-widest text-emerald-700">Autorização do funcionário</p>
            <h2 className="mt-1 text-xl font-black text-slate-900">{pessoa.nome}</h2>
            <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-4 text-[13px] font-medium leading-relaxed text-slate-700">
              <p>Eu autorizo o uso do meu reconhecimento facial <b>exclusivamente para registrar meu ponto</b> nesta empresa.</p>
              <p className="mt-2">Fui informado(a) de que:</p>
              <ul className="mt-1.5 list-disc pl-5 space-y-1">
                <li>minha foto <b>não é armazenada</b>: o aparelho guarda apenas um código numérico do rosto;</li>
                <li>é registrada uma <b>foto de cada batida</b> para conferência da jornada;</li>
                <li>posso <b>revogar</b> esta autorização a qualquer momento e voltar a bater ponto por PIN;</li>
                <li>os dados não são usados para outra finalidade nem compartilhados.</li>
              </ul>
            </div>
            <div className="mt-4 flex flex-wrap gap-3">
              <button onClick={() => setConsentiu(true)} className="flex-1 rounded-xl bg-emerald-600 py-3.5 text-base font-black text-white hover:bg-emerald-700">
                {pessoa.nome.split(" ")[0]} autoriza — continuar
              </button>
              <button onClick={() => setPessoa(null)} className="rounded-xl border border-slate-200 px-5 py-3.5 text-sm font-bold text-slate-600">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="min-w-0">
                <h2 className="text-lg font-black text-slate-900 truncate">{pessoa.nome}</h2>
                <p className="text-[13px] font-bold text-emerald-700">
                  {capturas.length < CAPTURAS_NECESSARIAS ? ORIENTACOES[capturas.length] : "Capturas concluídas"}
                </p>
              </div>
              <span className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-black text-white">
                {capturas.length}/{CAPTURAS_NECESSARIAS}
              </span>
            </div>

            <div className="relative overflow-hidden rounded-2xl bg-slate-900" style={{ aspectRatio: "4/3" }}>
              <video ref={videoRef} playsInline muted className="h-full w-full object-cover" style={{ transform: "scaleX(-1)" }} />
              {status && (
                <div className="absolute inset-0 grid place-items-center bg-slate-900/70 text-center text-sm font-bold text-white">
                  <span><Loader2 size={26} className="mx-auto mb-2 animate-spin" />{status}</span>
                </div>
              )}
            </div>

            {erro && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{erro}</p>}

            <div className="mt-4 flex gap-3">
              <button onClick={() => { setPessoa(null); setCapturas([]); }} className="rounded-xl border border-slate-200 px-5 py-3.5 text-sm font-bold text-slate-600">
                Cancelar
              </button>
              {capturas.length < CAPTURAS_NECESSARIAS ? (
                <button onClick={capturar} disabled={ocupado || !!status}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-base font-black text-white hover:bg-emerald-700 disabled:opacity-60">
                  {ocupado ? <><Loader2 size={19} className="animate-spin" /> Lendo o rosto...</> : <><Camera size={19} /> Capturar {capturas.length + 1} de {CAPTURAS_NECESSARIAS}</>}
                </button>
              ) : (
                <button onClick={salvar} disabled={salvando}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-base font-black text-white hover:bg-emerald-700 disabled:opacity-60">
                  {salvando ? <><Loader2 size={19} className="animate-spin" /> Salvando...</> : <><Check size={19} /> Salvar cadastro facial</>}
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
