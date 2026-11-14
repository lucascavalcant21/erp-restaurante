"use client";

// MINHA CONTA — quem está logado, a empresa, a assinatura e o "Sair".
//
// Pedido do dono (14/11/2026): upgrade visual inspirado na tela "Meu Perfil" do
// app da Medway (avatar, nome e e-mail no topo; listas por seção com ícone e
// seta; faixa de indicação; botão Sair grande no fim) e preparação do Héfisto
// para venda. A parte de empresa e assinatura só aparece para quem administra
// usuários. Sem plano no banco, a assinatura diz "Não registrado".
// Planos (14/11/2026): Grátis e Completo por R$ 89,90 por mês (app/lib/planos.mjs).

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Bell, Building2, ChevronRight, CreditCard, ExternalLink, FileText, Gift, Info, KeyRound,
  Loader2, LogOut, Settings, ShieldCheck, Tablet,
} from "lucide-react";
import CabecalhoTela from "../../components/ui/CabecalhoTela";
import { useERP } from "../../context/ERPContext";
import { canAccessRoute } from "../../lib/permissions-catalog.mjs";
import { sairDoSistema } from "../../lib/auth";
import { emailReal, iniciais, linkIndicacao, situacaoAssinatura } from "../../lib/conta.mjs";
import { useMinhaAssinatura } from "../../lib/assinatura";

function Linha({ icone: Icone, rotulo, valor, href, externo = false, detalhe }) {
  const corpo = (
    <>
      <Icone size={22} strokeWidth={1.8} className="shrink-0 text-hf-text" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-medium text-hf-text">{rotulo}</span>
        {detalhe && <span className="mt-0.5 block text-xs leading-snug text-hf-muted">{detalhe}</span>}
      </span>
      {valor && <span className="max-w-[45%] shrink-0 truncate text-right text-sm text-hf-muted">{valor}</span>}
      {href && (externo
        ? <ExternalLink size={18} className="shrink-0 text-hf-text-2" aria-hidden="true" />
        : <ChevronRight size={18} className="shrink-0 text-hf-text-2" aria-hidden="true" />)}
    </>
  );
  const classe = "flex min-h-[56px] items-center gap-4 px-4 py-3 sm:px-5";
  if (!href) return <div className={classe}>{corpo}</div>;
  return externo
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={`${classe} transition hover:bg-hf-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-hf-accent`}>{corpo}</a>
    : <Link href={href} className={`${classe} transition hover:bg-hf-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-hf-accent`}>{corpo}</Link>;
}

function Secao({ titulo, children }) {
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-hf-muted">{titulo}</h2>
      <div className="divide-y divide-hf-border overflow-hidden rounded-[22px] border border-hf-border bg-hf-surface shadow-xs">{children}</div>
    </section>
  );
}

export default function MinhaContaPage() {
  const router = useRouter();
  const { sessao, unidadeInfo } = useERP();
  const [saindo, setSaindo] = useState(false);
  const minhaAssinatura = useMinhaAssinatura(sessao);
  if (!sessao) return null;

  const pode = (rota) => canAccessRoute(sessao, rota, "");
  const nome = sessao.app_nome || sessao.nome || "Usuário";
  const contato = sessao.is_app ? `Login: @${sessao.login}` : sessao.email;
  const administra = !sessao.is_app && pode("/dashboard/configuracoes/usuarios");
  const assinatura = minhaAssinatura === undefined
    ? { rotulo: "Carregando…", detalhe: null }
    : situacaoAssinatura(minhaAssinatura);
  const versao = process.env.HEFISTO_VERSAO;

  async function sair() {
    setSaindo(true);
    await sairDoSistema();
    router.replace("/login");
  }

  return (
    <div className="mx-auto w-full max-w-2xl pb-10">
      <CabecalhoTela titulo="Minha conta" icone={Settings} voltarPara="/dashboard/menu" />

      <div className="space-y-6 px-4 sm:px-6">
        <div className="flex flex-col items-center gap-3 pt-2 text-center">
          <span aria-hidden="true" className="grid h-24 w-24 place-items-center rounded-full bg-hf-menu text-3xl font-semibold text-white ring-4 ring-hf-surface shadow-sm">
            {iniciais(nome)}
          </span>
          <div className="min-w-0">
            <p className="break-words text-[26px] font-semibold leading-tight tracking-tight text-hf-text">{nome}</p>
            {contato && <p className="mt-1 break-all text-sm text-hf-text-2">{contato}</p>}
          </div>
        </div>

        <Secao titulo="Minha conta">
          <Linha icone={Building2} rotulo="Unidade atual" valor={unidadeInfo?.nome || "Nenhuma"} />
          {!sessao.is_app && emailReal(sessao.email) && (
            <Linha icone={KeyRound} rotulo="Alterar senha" detalhe="Enviamos um link para o seu e-mail" href="/recuperar" />
          )}
          {pode("/dashboard/notificacoes") && <Linha icone={Bell} rotulo="Notificações" href="/dashboard/notificacoes" />}
          {pode("/dashboard/configuracoes") && <Linha icone={Settings} rotulo="Configurações" href="/dashboard/configuracoes" />}
        </Secao>

        {administra && (
          <Secao titulo="Empresa e assinatura">
            <Linha icone={ShieldCheck} rotulo="Usuários e acessos" href="/dashboard/configuracoes/usuarios" />
            {pode("/dashboard/configuracoes/apps") && <Linha icone={Tablet} rotulo="Apps e terminais" href="/dashboard/configuracoes/apps" />}
            <Linha icone={CreditCard} rotulo="Plano e assinatura" valor={assinatura.rotulo} detalhe={assinatura.detalhe} href="/dashboard/conta/plano" />
          </Secao>
        )}

        <Secao titulo="Sobre">
          <Linha icone={FileText} rotulo="Privacidade e termos" href="/privacidade" />
          <Linha icone={Info} rotulo="Versão do Héfisto" valor={versao || "Não informada"} />
        </Secao>

        {!sessao.is_app && (
          <a
            href={linkIndicacao(nome)}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-4 rounded-[22px] bg-hf-menu p-5 text-white shadow-sm transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hf-accent"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-semibold leading-tight">Indique o Héfisto</span>
              <span className="mt-1 block text-sm leading-snug text-white/75">Conte para outro restaurante pelo WhatsApp</span>
            </span>
            <span className="inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border-2 border-hf-accent px-4 text-sm font-semibold text-white">
              <Gift size={16} aria-hidden="true" /> Indicar
            </span>
          </a>
        )}

        <button
          type="button"
          onClick={sair}
          disabled={saindo}
          className="hf-botao-sair flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full border-2 border-hf-text bg-hf-surface text-base font-semibold text-hf-text transition hover:bg-hf-elevated disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hf-accent"
        >
          {saindo ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <LogOut size={18} aria-hidden="true" />}
          {sessao.is_app ? "Sair do app" : "Sair"}
        </button>
      </div>
    </div>
  );
}
