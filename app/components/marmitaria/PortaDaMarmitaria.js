"use client";

// Senha para entrar e sair da marmitaria. Na primeira vez, o administrador cria
// a senha aqui. A conferência é no banco, com bloqueio por tentativas.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, LogOut } from "lucide-react";
import { useERP } from "../../context/ERPContext";
import { Aviso, Botao, Campo, Secao, inputCls } from "./ui";
import { conferirSenha, definirSenha, senhaFoiDefinida } from "../../lib/marmitaria/dados";
import { UNIDADE_MARMITARIA, gravarEntrada, lerEntrada, limparEntrada, senhaValida } from "../../lib/marmitaria/acesso.mjs";

const armazem = () => (typeof window === "undefined" ? null : window.localStorage);

function CampoSenha({ rotulo, valor, onChange, onEnter, foco }) {
  return (
    <Campo rotulo={rotulo}>
      <input type="password" inputMode="numeric" autoComplete="off" maxLength={8} autoFocus={foco} className={inputCls} value={valor} aria-label={rotulo}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))} onKeyDown={(e) => { if (e.key === "Enter") onEnter?.(); }} />
    </Campo>
  );
}

export function EntrarNaMarmitaria() {
  const { unidadeAtiva, setUnidadeAtiva, recarregarUnidades } = useERP();
  const [definida, setDefinida] = useState(null);
  const [senha, setSenha] = useState("");
  const [repetir, setRepetir] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);

  useEffect(() => { senhaFoiDefinida(UNIDADE_MARMITARIA).then(setDefinida); }, []);

  async function entrar() {
    // A senha certa libera a unidade: a lista precisa ser lida de novo.
    await recarregarUnidades();
    gravarEntrada(armazem(), typeof unidadeAtiva === "object" ? unidadeAtiva?.id : unidadeAtiva);
    setUnidadeAtiva(UNIDADE_MARMITARIA);
    window.dispatchEvent(new CustomEvent("hefisto:marmitaria"));
  }

  async function confirmar() {
    if (ocupado) return;
    if (!senhaValida(senha)) return setErro("A senha precisa ter de 4 a 8 números.");
    if (definida === false && senha !== repetir) return setErro("As duas senhas não são iguais.");
    setOcupado(true); setErro(null);
    try {
      const r = definida === false ? await definirSenha(UNIDADE_MARMITARIA, senha) : await conferirSenha(UNIDADE_MARMITARIA, senha);
      setSenha("");
      if (r.error) { setErro(r.error); return; }
      await entrar();
    } finally { setOcupado(false); }
  }

  return (
    <div className="mx-auto max-w-sm">
      <Secao titulo={definida === false ? "Crie a senha da marmitaria" : "Entrar na marmitaria"} subtitulo="A mesma senha vale para entrar e para sair.">
        <div className="space-y-3">
          <CampoSenha rotulo={definida === false ? "Nova senha (4 a 8 números)" : "Senha"} valor={senha} onChange={setSenha} onEnter={definida === false ? undefined : confirmar} foco />
          {definida === false && <CampoSenha rotulo="Repita a senha" valor={repetir} onChange={setRepetir} onEnter={confirmar} />}
          {erro && <Aviso tipo="alerta">{erro}</Aviso>}
          <Botao type="button" onClick={confirmar} disabled={ocupado || definida === null}><LockKeyhole size={16} /> {ocupado ? "Conferindo…" : definida === false ? "Criar e entrar" : "Entrar"}</Botao>
        </div>
      </Secao>
    </div>
  );
}

export function SairDaMarmitaria() {
  const { setUnidadeAtiva } = useERP();
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [senha, setSenha] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [erro, setErro] = useState(null);

  async function sair() {
    if (ocupado) return;
    setOcupado(true); setErro(null);
    try {
      const r = await conferirSenha(UNIDADE_MARMITARIA, senha);
      setSenha("");
      if (r.error) { setErro(r.error); return; }
      const anterior = lerEntrada(armazem())?.unidadeAnterior;
      limparEntrada(armazem());
      window.dispatchEvent(new CustomEvent("hefisto:marmitaria"));
      if (anterior && anterior !== UNIDADE_MARMITARIA) setUnidadeAtiva(anterior);
      router.replace("/dashboard");
    } finally { setOcupado(false); }
  }

  if (!aberto) return <Botao variante="secundario" type="button" onClick={() => setAberto(true)}><LogOut size={16} /> Sair da marmitaria</Botao>;
  return (
    <div className="w-full rounded-2xl border border-hf-border bg-hf-surface p-3 sm:max-w-xs">
      <CampoSenha rotulo="Senha para sair" valor={senha} onChange={setSenha} onEnter={sair} foco />
      {erro && <Aviso tipo="alerta" className="mt-2">{erro}</Aviso>}
      <div className="mt-2 flex gap-2">
        <Botao variante="secundario" type="button" onClick={() => { setAberto(false); setErro(null); }}>Cancelar</Botao>
        <Botao type="button" onClick={sair} disabled={ocupado || !senha}>{ocupado ? "Conferindo…" : "Sair"}</Botao>
      </div>
    </div>
  );
}
