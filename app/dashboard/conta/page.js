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
import { TopoComVoltar } from "../../components/ui/Medway";
import { useERP } from "../../context/ERPContext";
import { canAccessRoute } from "../../lib/permissions-catalog.mjs";
import { sairDoSistema } from "../../lib/auth";
import { emailReal, iniciais, linkIndicacao, situacaoAssinatura } from "../../lib/conta.mjs";
import { useMinhaAssinatura } from "../../lib/assinatura";

function Linha({ icone: Icone, rotulo, valor, href, externo = false, detalhe }) {
  const corpo = (
    <>
      <Icone size={26} strokeWidth={1.7} className="shrink-0 text-mw-marinho" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-[18px] font-medium text-mw-marinho">{rotulo}</span>
        {detalhe && <span className="mt-0.5 block text-[13px] leading-snug text-mw-sec">{detalhe}</span>}
      </span>
      {valor && <span className="max-w-[45%] shrink-0 truncate text-right text-[16px] text-mw-sec">{valor}</span>}
      {href && (externo
        ? <ExternalLink size={24} strokeWidth={1.8} className="shrink-0 text-mw-marinho" aria-hidden="true" />
        : <ChevronRight size={24} strokeWidth={2} className="shrink-0 text-mw-marinho" aria-hidden="true" />)}
    </>
  );
  const classe = "flex min-h-[64px] items-center gap-5 py-3";
  if (!href) return <div className={classe}>{corpo}</div>;
  return externo
    ? <a href={href} target="_blank" rel="noopener noreferrer" className={`${classe} transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mw-agua`}>{corpo}</a>
    : <Link href={href} className={`${classe} transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mw-agua`}>{corpo}</Link>;
}

function Secao({ titulo, children }) {
  return (
    <section className="space-y-1">
      <h2 className="text-[15px] font-semibold uppercase tracking-[0.04em] text-mw-sec/80">{titulo}</h2>
      <div>{children}</div>
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
    <div className="min-h-full bg-mw-card pb-10">
      <TopoComVoltar titulo="Meu perfil" voltarPara="/dashboard/menu" />

      <div className="mx-auto w-full max-w-2xl space-y-8 px-6">
        <div className="pt-6">
          <span aria-hidden="true" className="mx-auto grid h-28 w-28 place-items-center rounded-full bg-[#5A5A5A] text-4xl font-semibold text-white ring-4 ring-mw-borda">
            {iniciais(nome)}
          </span>
          <p className="mt-6 break-words text-[34px] font-semibold leading-[1.15] tracking-tight text-mw-marinho">{nome}</p>
          {contato && <p className="mt-4 break-all text-center text-[17px] text-mw-sec">{contato}</p>}
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
            className="flex items-center gap-4 rounded-[18px] bg-gradient-to-r from-[#0A7C78] to-mw-marinho p-5 text-white shadow-none transition hover:opacity-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mw-agua"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[20px] font-semibold leading-tight">Indique o Héfisto</span>
              <span className="mt-1 block text-[15px] leading-snug text-white/85">Conte para outro restaurante</span>
            </span>
            <span className="inline-flex min-h-[48px] shrink-0 items-center gap-2 rounded-full border-2 border-white px-5 text-[16px] font-semibold text-white">
              <Gift size={16} aria-hidden="true" /> Indicar agora
            </span>
          </a>
        )}

        <button
          type="button"
          onClick={sair}
          disabled={saindo}
          className="hf-botao-sair flex min-h-[56px] w-full items-center justify-center gap-2 rounded-full border-2 border-mw-marinho bg-mw-card text-[18px] font-semibold text-mw-marinho shadow-none transition hover:bg-mw-bg disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mw-agua"
        >
          {saindo ? <Loader2 size={18} className="animate-spin" aria-hidden="true" /> : <LogOut size={18} aria-hidden="true" />}
          {sessao.is_app ? "Sair do app" : "Sair"}
        </button>
      </div>
    </div>
  );
}
