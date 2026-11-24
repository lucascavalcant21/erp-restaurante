"use client";

import { useState } from "react";
import { Check, ChefHat, Clock, Copy, KeyRound, Loader2, Martini, Minus, Sparkles, Wine, X } from "lucide-react";
import { accessCommand } from "../../lib/access-control";
import { CONTAS_RAPIDAS, contaRapidaPorId, gerarSenhaTemporaria, sugerirLogin } from "../../lib/contas-rapidas.mjs";

const ICONES = { ChefHat, Clock, Martini, Sparkles, Wine };
const CAMPO = "min-h-11 w-full rounded-xl border border-hf-border bg-hf-surface px-3 text-sm font-semibold text-hf-text outline-none focus:border-hf-accent";

/** Criar um acesso em três passos: função, nome e senha. */
export default function ContaRapida({ onFechar, onCriada, modeloInicial = null }) {
  const [modeloId, setModeloId] = useState(contaRapidaPorId(modeloInicial)?.id || CONTAS_RAPIDAS[0].id);
  const [nome, setNome] = useState("");
  const [login, setLogin] = useState("");
  const [loginEditado, setLoginEditado] = useState(false);
  const [senha, setSenha] = useState(() => gerarSenhaTemporaria());
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [criada, setCriada] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const modelo = contaRapidaPorId(modeloId);

  const mudarNome = (valor) => {
    setNome(valor);
    if (!loginEditado) setLogin(sugerirLogin(valor));
  };

  const criar = async () => {
    if (!nome.trim() || !login.trim()) return setErro("Informe o nome e o login.");
    if (senha.length < 8) return setErro("A senha precisa ter ao menos 8 caracteres.");
    setSalvando(true); setErro("");
    try {
      await accessCommand("create-quick-account", { modelo: modeloId, nome, login, password: senha });
      setCriada({ nome, login: login.trim().toLowerCase(), senha, funcao: modelo.nome, trocar: modelo.trocarSenha !== false });
      onCriada?.();
    } catch (e) { setErro(e.message || "Não foi possível criar a conta."); }
    setSalvando(false);
  };

  const copiarAcesso = async () => {
    try {
      await navigator.clipboard.writeText(`Acesso ao Héfisto\nLogin: ${criada.login}\nSenha: ${criada.senha}`);
      setCopiado(true);
    } catch { setErro("Não foi possível copiar. Anote o login e a senha."); }
  };

  const novaConta = () => {
    setCriada(null); setNome(""); setLogin(""); setLoginEditado(false); setCopiado(false);
    setSenha(gerarSenhaTemporaria());
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
      <div role="dialog" aria-modal="true" aria-label="Conta rápida" className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-3xl bg-hf-surface sm:rounded-3xl">
        <header className="flex items-center justify-between gap-3 border-b border-hf-border px-5 py-4">
          <h2 className="text-lg font-black text-hf-text">{criada ? "Conta criada" : "Conta rápida"}</h2>
          <button onClick={onFechar} aria-label="Fechar" className="grid h-11 w-11 place-items-center rounded-xl text-hf-text hover:bg-hf-elevated"><X size={20} aria-hidden="true" /></button>
        </header>

        {criada ? (
          <div className="space-y-4 overflow-y-auto p-5">
            <p className="text-sm font-medium text-hf-text-2">{criada.nome} já pode entrar como {criada.funcao}. Esta senha não aparece de novo.</p>
            <dl className="space-y-3 rounded-2xl bg-hf-elevated p-4">
              <div><dt className="text-xs font-bold text-hf-muted">Login</dt><dd className="break-all text-lg font-black text-hf-text">{criada.login}</dd></div>
              <div><dt className="text-xs font-bold text-hf-muted">Senha temporária</dt><dd className="break-all font-mono text-lg font-black text-hf-text">{criada.senha}</dd></div>
            </dl>
            {criada.trocar && <p className="text-xs font-medium text-hf-muted">A pessoa cria uma senha própria no primeiro acesso.</p>}
            {erro && <p role="alert" className="text-sm font-bold text-hf-danger">{erro}</p>}
            <div className="flex flex-wrap gap-2">
              <button onClick={copiarAcesso} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-hf-accent px-4 text-sm font-black text-hf-accent-fg">
                {copiado ? <Check size={17} aria-hidden="true" /> : <Copy size={17} aria-hidden="true" />} {copiado ? "Copiado" : "Copiar acesso"}
              </button>
              <button onClick={novaConta} className="min-h-11 flex-1 rounded-xl border border-hf-border px-4 text-sm font-black text-hf-text">Criar outra</button>
              <button onClick={onFechar} className="min-h-11 flex-1 rounded-xl border border-hf-border px-4 text-sm font-black text-hf-text">Concluir</button>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-5 overflow-y-auto p-5">
              <fieldset className="space-y-2">
                <legend className="mb-2 text-sm font-extrabold text-hf-text-2">Função</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {CONTAS_RAPIDAS.map((c) => {
                    const Icone = ICONES[c.icone];
                    const ativo = c.id === modeloId;
                    return (
                      <button key={c.id} type="button" aria-pressed={ativo} onClick={() => setModeloId(c.id)}
                        className={`flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-2xl border p-2 text-center text-xs font-bold text-hf-text ${ativo ? "border-hf-accent bg-hf-elevated ring-2 ring-hf-accent" : "border-hf-border bg-hf-surface"}`}>
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-hf-accent text-hf-accent-fg"><Icone size={21} aria-hidden="true" /></span>
                        {c.nome}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="grid gap-3 rounded-2xl bg-hf-elevated p-4 text-sm font-medium text-hf-text sm:grid-cols-2">
                <ul className="space-y-1.5">
                  {modelo.pode.map((t) => <li key={t} className="flex items-start gap-2"><Check size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-hf-success" />{t}</li>)}
                </ul>
                <ul className="space-y-1.5">
                  {modelo.naoPode.map((t) => <li key={t} className="flex items-start gap-2 text-hf-text-2"><Minus size={16} aria-hidden="true" className="mt-0.5 shrink-0" />Não: {t.charAt(0).toLowerCase() + t.slice(1)}</li>)}
                </ul>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-bold text-hf-text-2">Nome
                  <input value={nome} onChange={(e) => mudarNome(e.target.value)} autoComplete="off" className={`${CAMPO} mt-1`} />
                </label>
                <label className="block text-sm font-bold text-hf-text-2">Login
                  <input value={login} onChange={(e) => { setLogin(e.target.value); setLoginEditado(true); }} autoCapitalize="none" autoComplete="off" className={`${CAMPO} mt-1`} />
                </label>
                <label className="block text-sm font-bold text-hf-text-2 sm:col-span-2">Senha temporária
                  <span className="mt-1 flex gap-2">
                    <input value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="off" className={`${CAMPO} font-mono`} />
                    <button type="button" onClick={() => setSenha(gerarSenhaTemporaria())} aria-label="Gerar outra senha" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-hf-border text-hf-text"><KeyRound size={18} aria-hidden="true" /></button>
                  </span>
                </label>
              </div>
              {erro && <p role="alert" className="text-sm font-bold text-hf-danger">{erro}</p>}
            </div>
            <footer className="border-t border-hf-border p-4">
              <button onClick={criar} disabled={salvando} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-hf-accent px-4 text-sm font-black text-hf-accent-fg disabled:opacity-60">
                {salvando && <Loader2 size={17} aria-hidden="true" className="animate-spin" />} Criar conta de {modelo.nome}
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}
