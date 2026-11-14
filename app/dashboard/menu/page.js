"use client";

// MENU — todas as áreas e ferramentas em grade de cartões, por seção.
//
// Pedido do dono (14/11/2026): upgrade visual inspirado no app da Medway. A aba
// "Menu" da barra inferior abre esta tela: cartões grandes de duas colunas
// (ícone em cima, nome embaixo), seções com rótulo discreto e o cartão da
// pessoa logada no fim, que leva a "Minha conta". Tudo passa pelo guard de
// rotas: cada pessoa só vê o que pode abrir.

import Link from "next/link";
import { EllipsisVertical, LayoutGrid } from "lucide-react";
import CabecalhoTela from "../../components/ui/CabecalhoTela";
import IconeModulo from "../../components/ui/IconeModulo";
import useModulosDoUsuario from "../../components/navigation/useModulosDoUsuario";
import { MENU_ATALHOS, MENU_SISTEMA } from "../../lib/menu-principal.mjs";
import { iniciais } from "../../lib/conta.mjs";

function CartaoMenu({ item, href }) {
  return (
    <Link
      href={href || item.href}
      className="group flex min-h-[124px] min-w-0 flex-col justify-between gap-4 rounded-[22px] border border-hf-border bg-hf-surface p-4 shadow-xs transition hover:border-hf-border-strong active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hf-accent sm:min-h-[132px] sm:p-5"
    >
      <IconeModulo item={item} tamanho="sm" />
      <span className="min-w-0">
        <span className="block text-[15px] font-semibold leading-snug text-hf-text sm:text-base">{item.label}</span>
        {item.desc && <span className="mt-0.5 block text-xs leading-snug text-hf-muted line-clamp-2">{item.desc}</span>}
      </span>
    </Link>
  );
}

function Secao({ titulo, children }) {
  return (
    <section className="space-y-3">
      <h2 className="px-1 text-[12px] font-semibold uppercase tracking-[0.08em] text-hf-muted">{titulo}</h2>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">{children}</div>
    </section>
  );
}

export default function MenuPage() {
  const { sessao, modulos, destino, pode } = useModulosDoUsuario();
  const liberado = (href) => {
    const [rota, busca = ""] = href.split("?");
    return pode(rota, busca);
  };
  const atalhos = MENU_ATALHOS.filter((i) => liberado(i.href));
  const sistema = sessao?.is_app ? [] : MENU_SISTEMA.filter((i) => liberado(i.href));
  const versao = process.env.HEFISTO_VERSAO;

  return (
    <div className="mx-auto w-full max-w-5xl pb-8">
      <CabecalhoTela titulo="Menu" subtitulo="Todas as áreas e ferramentas do Héfisto" icone={LayoutGrid} voltar={false} />

      <div className="space-y-7 px-4 sm:px-6 lg:px-8">
        {modulos.length > 0 && (
          <Secao titulo="Áreas">
            {modulos.map((m) => <CartaoMenu key={m.id} item={m} href={destino(m)} />)}
          </Secao>
        )}

        {atalhos.length > 0 && (
          <Secao titulo="Atalhos">
            {atalhos.map((i) => <CartaoMenu key={i.href} item={i} />)}
          </Secao>
        )}

        {sistema.length > 0 && (
          <Secao titulo="Sistema">
            {sistema.map((i) => <CartaoMenu key={i.href} item={i} />)}
          </Secao>
        )}

        {sessao && (
          <Link
            href="/dashboard/conta"
            className="flex min-h-[76px] items-center gap-4 rounded-[22px] border border-hf-border bg-hf-surface px-4 py-3 shadow-xs transition hover:border-hf-border-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-hf-accent sm:px-5"
          >
            <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-hf-elevated text-sm font-semibold text-hf-text">
              {iniciais(sessao.app_nome || sessao.nome)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-base font-semibold text-hf-text">{sessao.app_nome || sessao.nome}</span>
              <span className="block truncate text-xs text-hf-muted">Minha conta{versao ? ` · Versão ${versao}` : ""}</span>
            </span>
            <EllipsisVertical size={20} className="shrink-0 text-hf-text-2" aria-hidden="true" />
          </Link>
        )}
      </div>
    </div>
  );
}
