"use client";

import { useState } from "react";
import { Check, ChefHat, Clock, ConciergeBell, Copy, KeyRound, Loader2, Martini, Minus, Sparkles, Users, Wine, X } from "lucide-react";
import { accessCommand } from "../../lib/access-control";
import { previaDaConta } from "../../lib/conta-previa.mjs";
import IconeModulo from "../ui/IconeModulo";
import { useERP } from "../../context/ERPContext";
import { CONTAS_RAPIDAS, MODULOS_CONTA, contaDosModulos, contaRapidaPorId, loginDoRestaurante, senhaDoRestaurante } from "../../lib/contas-rapidas.mjs";

// Todo ícone usado em contas-rapidas.mjs precisa estar aqui (trava em
// contas-rapidas.test.mjs); o que faltar cai no KeyRound em vez de quebrar a tela.
export const ICONES_CONTA = { ChefHat, Clock, ConciergeBell, Martini, Sparkles, Users, Wine };
const ICONES = ICONES_CONTA;
const MODULOS_DO_MODELO = {
  "chefe-bar": ["bar"], "equipe-bar": ["bar"], "equipe-cozinha": ["cozinha"], garcom: ["salao"],
  "somente-ponto": ["ponto"], "tablet-nico": ["nico"], "tablet-nico-ponto": ["nico", "ponto"],
  tablet: ["nico"], ponto: ["ponto"], cozinha: ["cozinha"], bar: ["bar"],
};
const CAMPO = "min-h-11 w-full rounded-xl border border-hf-border bg-hf-surface px-3 text-sm font-semibold text-hf-text outline-none focus:border-hf-accent";

/** Criar um acesso em três passos: função, nome e senha. */
// Login e senha já vêm prontos pelo nome do restaurante (dono, 24/11/2026); dá para editar os dois.
export default function ContaRapida({ onFechar, onCriada, modeloInicial = null, nomeRestaurante = "", loginsExistentes = [] }) {
  // Unidade aberta no topo: a conta nasce nela (o servidor confere o acesso).
  const { unidadeAtiva } = useERP();
  // Módulos marcados (dono, 24/11/2026): Cozinha, Bar, Salão, RH, Ponto, Nico.
  // Link antigo (?conta=tablet etc.) já chega com os módulos equivalentes.
  const [modulos, setModulos] = useState(() => MODULOS_DO_MODELO[modeloInicial] || MODULOS_DO_MODELO[contaRapidaPorId(modeloInicial)?.id] || []);
  const [usados, setUsados] = useState(loginsExistentes);
  const [nome, setNome] = useState("");
  const [login, setLogin] = useState(() => loginDoRestaurante(nomeRestaurante, loginsExistentes));
  const [senha, setSenha] = useState(() => senhaDoRestaurante(nomeRestaurante));
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [criada, setCriada] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const modelo = contaDosModulos(modulos) || { nome: "", pode: [], naoPode: [], trocarSenha: false };
  const alternar = (id) => setModulos((m) => (m.includes(id) ? m.filter((x) => x !== id) : [...m, id]));

  const mudarNome = (valor) => setNome(valor);

  const criar = async () => {
    if (!modulos.length) return setErro("Marque ao menos um módulo.");
    const nomeFinal = nome.trim() || modelo.nome;
    if (!login.trim()) return setErro("Informe o login.");
    if (senha.length < 8) return setErro("A senha precisa ter ao menos 8 caracteres.");
    setSalvando(true); setErro("");
    try {
      await accessCommand("create-quick-account", { modulos, nome: nomeFinal, login, password: senha, unidadeId: unidadeAtiva });
      setCriada({ nome: nomeFinal, login: login.trim().toLowerCase(), senha, funcao: modelo.nome, trocar: modelo.trocarSenha !== false });
      setUsados((u) => [...u, login.trim().toLowerCase()]);
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
    setCriada(null); setNome(""); setCopiado(false);
    setLogin(loginDoRestaurante(nomeRestaurante, usados));
    setSenha(senhaDoRestaurante(nomeRestaurante));
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
                <legend className="mb-1 text-sm font-extrabold text-hf-text-2">O que esta conta pode abrir?</legend>
                <p className="mb-2 text-xs font-medium text-hf-muted">Marque um ou mais módulos.</p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {MODULOS_CONTA.map((m) => {
                    const Icone = ICONES[m.icone] || KeyRound;
                    const ativo = modulos.includes(m.id);
                    return (
                      <button key={m.id} type="button" role="checkbox" aria-checked={ativo} onClick={() => alternar(m.id)}
                        className={`relative flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl border p-2 text-center text-sm font-bold text-hf-text ${ativo ? "border-hf-accent bg-hf-elevated ring-2 ring-hf-accent" : "border-hf-border bg-hf-surface"}`}>
                        {ativo && <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-hf-menu text-white"><Check size={14} aria-hidden="true" /></span>}
                        <span className="grid h-10 w-10 place-items-center rounded-xl bg-hf-accent text-hf-accent-fg"><Icone size={21} aria-hidden="true" /></span>
                        {m.nome}
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {modulos.length > 0 && <div className="grid gap-3 rounded-2xl bg-hf-elevated p-4 text-sm font-medium text-hf-text sm:grid-cols-2">
                <ul className="space-y-1.5">
                  {modelo.pode.map((t) => <li key={t} className="flex items-start gap-2"><Check size={16} aria-hidden="true" className="mt-0.5 shrink-0 text-hf-success" />{t}</li>)}
                </ul>
                <ul className="space-y-1.5">
                  {modelo.naoPode.map((t) => <li key={t} className="flex items-start gap-2 text-hf-text-2"><Minus size={16} aria-hidden="true" className="mt-0.5 shrink-0" />Não: {t.charAt(0).toLowerCase() + t.slice(1)}</li>)}
                </ul>
              </div>}

              {modulos.length > 0 && <Previa modelo={modelo} />}

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-sm font-bold text-hf-text-2">Nome
                  <input value={nome} onChange={(e) => mudarNome(e.target.value)} placeholder={modelo.nome || "Ex.: Tablet da cozinha"} autoComplete="off" className={`${CAMPO} mt-1`} />
                </label>
                <label className="block text-sm font-bold text-hf-text-2">Login
                  <input value={login} onChange={(e) => setLogin(e.target.value)} autoCapitalize="none" autoComplete="off" className={`${CAMPO} mt-1`} />
                </label>
                <label className="block text-sm font-bold text-hf-text-2 sm:col-span-2">Senha (pode trocar)
                  <span className="mt-1 flex gap-2">
                    <input value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="off" className={`${CAMPO} font-mono`} />
                    <button type="button" onClick={() => setSenha(senhaDoRestaurante(nomeRestaurante))} aria-label="Gerar outra senha" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-hf-border text-hf-text"><KeyRound size={18} aria-hidden="true" /></button>
                  </span>
                </label>
              </div>
              {erro && <p role="alert" className="text-sm font-bold text-hf-danger">{erro}</p>}
            </div>
            <footer className="border-t border-hf-border p-4">
              <button onClick={criar} disabled={salvando || !modulos.length} className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-hf-accent px-4 text-sm font-black text-hf-accent-fg disabled:opacity-60">
                {salvando && <Loader2 size={17} aria-hidden="true" className="animate-spin" />} {modulos.length ? `Criar conta: ${modelo.nome}` : "Marque os módulos"}
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}


// Prévia do que a conta vê ao entrar (dono, 28/11/2026: "aqui eu quero
// pré-visualizar como vai ser"). Mesmas regras do menu e das permissões.
function Previa({ modelo }) {
  const p = previaDaConta(modelo);
  if (!p) return null;
  return (
    <div>
      <p className="mb-2 text-sm font-bold text-hf-text-2">Prévia: o que aparece ao entrar</p>
      <div className="mx-auto w-full max-w-[300px] rounded-[28px] border-4 border-hf-menu bg-hf-bg p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between border-b border-hf-border pb-2">
          <span className="text-sm font-black text-hf-text">{p.titulo}</span>
          <span className="rounded-full border border-hf-border px-2 py-0.5 text-[10px] font-semibold text-hf-text-2">Sair</span>
        </div>
        {p.tipo === "ponto" && (
          <div className="space-y-2 text-center">
            <p className="text-2xl font-black tabular-nums text-hf-text">10:48</p>
            <p className="text-xs text-hf-muted">Toque no seu nome e digite o PIN</p>
            {["Funcionário 1", "Funcionário 2", "Funcionário 3"].map((n) => (
              <div key={n} className="flex items-center gap-2 rounded-xl border border-hf-border bg-hf-surface px-2 py-1.5 text-left text-xs font-semibold text-hf-text">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-hf-elevated text-[10px]">{n.slice(-1)}</span>{n}
              </div>
            ))}
            <p className="text-[10px] text-hf-muted">Só isso: sem menu, sem outras telas.</p>
          </div>
        )}
        {p.tipo === "nico" && (
          <div className="space-y-2">
            <div className="rounded-2xl rounded-bl-sm bg-hf-elevated px-3 py-2 text-xs text-hf-text">Oi! Pergunte como fazer um prato ou uma base.</div>
            <div className="flex items-center gap-2 rounded-full border border-hf-border bg-hf-surface px-3 py-2 text-xs text-hf-muted"><Sparkles size={14} aria-hidden="true" />Toque, digite ou fale…</div>
          </div>
        )}
        {(p.tipo === "cards" || p.tipo === "inicio") && (
          p.cards.length ? (
            <div className="grid grid-cols-3 gap-1.5">
              {p.cards.map((c) => (
                <div key={c.label} className="flex flex-col items-center gap-1 rounded-xl border border-hf-border bg-hf-surface p-1.5 text-center">
                  <IconeModulo item={c} tamanho="sm" />
                  <span className="line-clamp-2 text-[10px] font-semibold leading-tight text-hf-text">{c.label}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-hf-muted">Nenhuma tela liberada.</p>
        )}
      </div>
    </div>
  );
}
