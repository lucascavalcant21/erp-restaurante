"use client";

// Áreas do menu que esta sessão pode abrir, com o link certo para cada uma.
// Mesma regra do lançador do Início (LancadorModulos) e da tela Menu: quem tem
// perfil limitado só vê as áreas que pode abrir, e Marmitaria/Eventos que estão
// na troca de negócio do topo não se repetem.

import { useERP } from "../../context/ERPContext";
import { canAccessRoute, hasPermission } from "../../lib/permissions-catalog.mjs";
import { menuPrincipal, menuVisivel, universoLiberado } from "../../lib/menu-principal.mjs";
import { negociosDoLogin, semNegociosDaTroca } from "../../lib/negocios.mjs";
import { areaLiberada, linkCheckout } from "../../lib/planos.mjs";
import { useMinhaAssinatura } from "../../lib/assinatura";

export default function useModulosDoUsuario() {
  const { sessao, unidades } = useERP();
  const assinatura = useMinhaAssinatura(sessao);
  if (!sessao) return { sessao: null, modulos: [], destino: (m) => m.href, pode: () => false, trancada: () => false };
  // Área do plano Completo numa empresa no Grátis: aparece com cadeado e leva ao checkout.
  const trancada = (m) => !areaLiberada(assinatura?.plano, m);

  const pode = (rota, busca = "") => canAccessRoute(sessao, rota, busca);
  const podeInteligencia = !sessao.gerenciado || hasPermission(sessao, "dashboard.intelligence.view");
  const todos = menuPrincipal({ podeInteligencia });
  const limitado = !!sessao.gerenciado || !!sessao.is_app;
  const liberados = limitado
    ? menuVisivel(todos, (rota, busca) => pode(rota, busca) || universoLiberado(rota, pode))
    : todos;
  const negocios = sessao.is_app ? [] : negociosDoLogin(unidades, (rota) => pode(rota));
  const modulos = semNegociosDaTroca(liberados, negocios);

  // Para quem não pode abrir a página da área, o link é a primeira tela liberada dela.
  const destino = (m) => {
    if (trancada(m)) return linkCheckout(m.href);
    const [rota, busca = ""] = m.href.split("?");
    if (!limitado || pode(rota, busca) || universoLiberado(rota, pode)) return m.href;
    return m.submodules?.[0]?.href || m.href;
  };

  return { sessao, modulos, destino, pode, trancada };
}
