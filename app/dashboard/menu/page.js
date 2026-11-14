"use client";

// MENU — no visual do app da Medway (pedido do dono, 14/11/2026, com as
// capturas): título "Menu" grande, linha da unidade no alto (no lugar do
// "Tema"), seções com rótulo em maiúsculas, cartões brancos de duas colunas
// com ícone em contorno e o nome embaixo, e o cartão da pessoa no fim, que
// leva a "Meu perfil". Tudo passa pelo guard de rotas e pelo plano.

import Link from "next/link";
import { Building2, ChevronRight, EllipsisVertical } from "lucide-react";
import { useERP } from "../../context/ERPContext";
import useModulosDoUsuario from "../../components/navigation/useModulosDoUsuario";
import { CartaoGrade, FundoMedway, GradeCartoes, RotuloSecao, TituloGrande } from "../../components/ui/Medway";
import { MENU_ATALHOS, MENU_SISTEMA } from "../../lib/menu-principal.mjs";
import { iniciais } from "../../lib/conta.mjs";
import { useMinhaAssinatura } from "../../lib/assinatura";
import { linkCheckout, rotaLiberada } from "../../lib/planos.mjs";

export default function MenuPage() {
  const { unidadeInfo } = useERP();
  const { sessao, modulos, destino, pode, trancada } = useModulosDoUsuario();
  const assinatura = useMinhaAssinatura(sessao);
  const liberado = (href) => {
    const [rota, busca = ""] = href.split("?");
    return pode(rota, busca);
  };
  const item = (i) => {
    const pago = !rotaLiberada(assinatura?.plano, i.href);
    return <CartaoGrade key={i.href} href={pago ? linkCheckout(i.href) : i.href} icone={i.icone} label={i.label} trancado={pago} />;
  };
  const atalhos = MENU_ATALHOS.filter((i) => liberado(i.href));
  const sistema = sessao?.is_app ? [] : MENU_SISTEMA.filter((i) => liberado(i.href));
  const versao = process.env.HEFISTO_VERSAO;

  return (
    <FundoMedway>
      <div className="mx-auto w-full max-w-5xl">
        <TituloGrande>Menu</TituloGrande>

        <div className="space-y-8 px-4 sm:px-6">
          <Link
            href="/dashboard/conta"
            className="flex min-h-[64px] items-center gap-4 rounded-[22px] border border-mw-borda bg-mw-card px-4 shadow-none"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-mw-bg text-mw-texto">
              <Building2 size={20} strokeWidth={1.7} aria-hidden="true" />
            </span>
            <span className="flex-1 text-[16px] font-semibold text-mw-texto">Unidade</span>
            <span className="max-w-[45%] truncate text-[15px] text-mw-sec">{unidadeInfo?.nome || "Nenhuma"}</span>
            <ChevronRight size={20} className="shrink-0 text-mw-sec" aria-hidden="true" />
          </Link>

          {modulos.length > 0 && (
            <section className="space-y-3">
              <RotuloSecao>Áreas</RotuloSecao>
              <GradeCartoes>
                {modulos.map((m) => (
                  <CartaoGrade key={m.id} href={destino(m)} icone={m.icone} label={m.label} trancado={trancada(m)} />
                ))}
              </GradeCartoes>
            </section>
          )}

          {atalhos.length > 0 && (
            <section className="space-y-3">
              <RotuloSecao>Atalhos</RotuloSecao>
              <GradeCartoes>{atalhos.map(item)}</GradeCartoes>
            </section>
          )}

          {sistema.length > 0 && (
            <section className="space-y-3">
              <RotuloSecao>Outros</RotuloSecao>
              <GradeCartoes>
                {sistema.map(item)}
                {versao && <CartaoGrade href="/dashboard/conta" icone="Smartphone" label={`Versão ${versao}`} />}
              </GradeCartoes>
            </section>
          )}

          {sessao && (
            <Link
              href="/dashboard/conta"
              className="flex min-h-[88px] items-center gap-4 rounded-[22px] border border-mw-borda bg-mw-card px-6 shadow-none"
            >
              <span aria-hidden="true" className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-mw-bg text-[18px] font-semibold text-mw-marinho">
                {iniciais(sessao.app_nome || sessao.nome)}
              </span>
              <span className="min-w-0 flex-1 truncate text-[18px] font-semibold text-mw-marinho">{sessao.app_nome || sessao.nome}</span>
              <EllipsisVertical size={22} className="shrink-0 text-mw-texto" aria-hidden="true" />
            </Link>
          )}
        </div>
      </div>
    </FundoMedway>
  );
}
