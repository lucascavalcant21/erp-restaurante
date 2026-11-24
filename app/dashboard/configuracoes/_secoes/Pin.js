"use client";

// PIN do gerente. Antes ficava aberto na tela (qualquer um via "1234" passando
// pela Configurações). Agora fica escondido e só troca digitando o novo duas vezes.

import { useEffect, useState } from "react";
import { useERP } from "../../../context/ERPContext";
import { fetchPins, salvarPins } from "../../../lib/seguranca";
import { pinFraco, PIN_DE_FABRICA } from "../../../lib/configuracoes-hub.mjs";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Painel, Bloco, Campo, BotaoSalvar, SemUnidade, inputCls, avisarSalvo } from "./ui";

const so4 = (v) => String(v || "").replace(/\D/g, "").slice(0, 4);

export default function Pin({ onVoltar }) {
  const { unidadeAtiva } = useERP();
  const real = unidadeAtiva && unidadeAtiva !== "todas";
  const [pins, setPins] = useState(null);
  const [novo, setNovo] = useState("");
  const [repete, setRepete] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [ok, setOk] = useState(false);
  const [erro, setErro] = useState("");

  useEffect(() => { if (real) fetchPins(unidadeAtiva).then((r) => setPins(r.data)); }, [unidadeAtiva, real]);

  const aviso = novo.length === 4 && pinFraco(novo) ? "Fácil de adivinhar. Escolha outro." : repete.length === 4 && repete !== novo ? "Os dois não batem." : null;
  const pronto = novo.length === 4 && repete === novo && !pinFraco(novo);

  const salvar = async () => {
    setErro("");
    setSalvando(true);
    const { error } = await salvarPins(unidadeAtiva, { ...pins, pin_gerente: novo });
    setSalvando(false);
    if (error) return setErro(`Não salvou: ${error}`);
    setPins((p) => ({ ...p, pin_gerente: novo }));
    setNovo(""); setRepete("");
    avisarSalvo(setOk);
  };

  if (!real) return <Painel titulo="PIN do gerente" onVoltar={onVoltar}><SemUnidade /></Painel>;
  const fraco = pins && pinFraco(pins.pin_gerente);

  return (
    <Painel titulo="PIN do gerente" descricao="4 números. Libera entrada atrasada no ponto, destrava o modo tablet e tira o tablet das estações."
      onVoltar={onVoltar} rodape={<><BotaoSalvar onClick={salvar} salvando={salvando} ok={ok} desabilitado={!pronto} texto="Trocar PIN" />{erro && <span className="text-[13px] font-medium text-hf-danger">{erro}</span>}</>}>
      {pins && (
        <div className={`flex items-start gap-3 rounded-2xl border p-4 ${fraco ? "border-hf-warning/40 bg-hf-warning/10" : "border-hf-border bg-hf-surface"}`}>
          {fraco ? <ShieldAlert size={20} className="mt-0.5 shrink-0 text-hf-warning" /> : <ShieldCheck size={20} className="mt-0.5 shrink-0 text-hf-success" />}
          <p className="text-[14px] text-hf-text">{fraco ? (pins.pin_gerente === PIN_DE_FABRICA ? "O PIN ainda é o de fábrica. Qualquer funcionário pode adivinhar: troque agora." : "O PIN atual é fácil de adivinhar. Troque.") : "PIN definido. Por segurança ele não aparece aqui."}</p>
        </div>
      )}
      <Bloco titulo="Novo PIN">
        <div className="grid grid-cols-2 gap-3">
          <Campo rotulo="Novo"><input className={`${inputCls} text-center tracking-[0.5em]`} type="password" inputMode="numeric" autoComplete="off" value={novo} onChange={(e) => setNovo(so4(e.target.value))} placeholder="••••" /></Campo>
          <Campo rotulo="Repita"><input className={`${inputCls} text-center tracking-[0.5em]`} type="password" inputMode="numeric" autoComplete="off" value={repete} onChange={(e) => setRepete(so4(e.target.value))} placeholder="••••" /></Campo>
        </div>
        {aviso && <p className="text-[13px] font-medium text-hf-warning">{aviso}</p>}
      </Bloco>
    </Painel>
  );
}
