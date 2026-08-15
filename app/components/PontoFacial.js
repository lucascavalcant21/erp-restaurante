"use client";

// Identificação por rosto para o ponto. Abre a câmera, lê o rosto e compara
// com os funcionários cadastrados. Só devolve alguém quando tem certeza —
// na dúvida, manda usar o PIN.

import { useState, useEffect, useRef } from "react";
import { ScanFace, Loader2, X, Check } from "lucide-react";
import { prepararFacial, lerRosto, identificar, fotoDoQuadro } from "../lib/facial";

export default function PontoFacial({ funcionarios, onIdentificado, onFechar }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState("Preparando a câmera...");
  const [erro, setErro] = useState("");
  const [lendo, setLendo] = useState(false);
  const [achado, setAchado] = useState(null); // { pessoa, distancia, foto }

  const cadastrados = (funcionarios || [])
    .filter(f => Array.isArray(f.face_descritores) && f.face_descritores.length > 0)
    .map(f => ({ id: f.id, nome: f.nome, cargo: f.cargo, registro: f, descritores: f.face_descritores }));

  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
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
    return () => { vivo = false; streamRef.current?.getTracks().forEach(t => t.stop()); streamRef.current = null; };
  }, []);

  const reconhecer = async () => {
    if (!videoRef.current || lendo) return;
    if (!cadastrados.length) { setErro("Nenhum funcionário com rosto cadastrado. Cadastre em RH → Cadastro facial do ponto."); return; }
    setLendo(true); setErro("");
    const { descritor, erro: e } = await lerRosto(videoRef.current);
    if (e) { setErro(e); setLendo(false); return; }
    const r = identificar(descritor, cadastrados);
    setLendo(false);
    if (r.erro) { setErro(r.erro); return; }
    setAchado({ pessoa: r.pessoa, distancia: r.distancia, foto: fotoDoQuadro(videoRef.current) });
  };

  const confirmar = () => {
    if (!achado) return;
    streamRef.current?.getTracks().forEach(t => t.stop());
    onIdentificado?.({ funcionario: achado.pessoa.registro, distancia: achado.distancia, foto: achado.foto });
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/80 p-3 backdrop-blur-sm">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3.5">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white"><ScanFace size={20} /></div>
          <div className="min-w-0 flex-1">
            <p className="font-black text-slate-900">Ponto por reconhecimento</p>
            <p className="text-[11px] font-bold text-slate-400">{cadastrados.length} funcionário(s) com rosto cadastrado</p>
          </div>
          <button onClick={onFechar} className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-slate-100 text-slate-600"><X size={20} /></button>
        </div>

        <div className="relative bg-slate-900" style={{ aspectRatio: "4/3" }}>
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" style={{ transform: "scaleX(-1)" }} />
          {status && (
            <div className="absolute inset-0 grid place-items-center bg-slate-900/70 text-center text-sm font-bold text-white">
              <span><Loader2 size={26} className="mx-auto mb-2 animate-spin" />{status}</span>
            </div>
          )}
          {achado && (
            <div className="absolute inset-x-0 bottom-0 bg-emerald-600/95 px-4 py-3 text-white">
              <p className="text-[11px] font-black uppercase tracking-widest text-emerald-100">Reconhecido</p>
              <p className="text-lg font-black leading-tight">{achado.pessoa.nome}</p>
              <p className="text-[12px] font-bold text-emerald-100">{achado.pessoa.cargo || "Equipe"}</p>
            </div>
          )}
        </div>

        <div className="p-4">
          {erro && <p className="mb-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">{erro}</p>}
          {achado ? (
            <div className="flex gap-3">
              <button onClick={() => { setAchado(null); setErro(""); }} className="rounded-xl border border-slate-200 px-5 py-3.5 text-sm font-bold text-slate-600">
                Não sou eu
              </button>
              <button onClick={confirmar} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-base font-black text-white hover:bg-emerald-700">
                <Check size={19} /> Sou eu, registrar
              </button>
            </div>
          ) : (
            <button onClick={reconhecer} disabled={lendo || !!status}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-4 text-base font-black text-white hover:bg-emerald-700 disabled:opacity-60">
              {lendo ? <><Loader2 size={19} className="animate-spin" /> Reconhecendo...</> : <><ScanFace size={19} /> Reconhecer meu rosto</>}
            </button>
          )}
          <p className="mt-3 text-center text-[11px] font-medium text-slate-400">
            Fique de frente, com o rosto iluminado e sozinho na câmera.
          </p>
        </div>
      </div>
    </div>
  );
}
