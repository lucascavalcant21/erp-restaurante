// homeDoUsuario mora em auth.js, que depende do cliente Supabase. Aqui vale só a
// regra dele: página inicial permitida, senão a primeira rota liberada.
import { canAccessRoute, permittedRoutes } from "./permissions-catalog.mjs";

export function homeDoUsuarioDe(conta) {
  const sessao = { gerenciado: true, permissions: conta.permissoes };
  const [rota, busca = ""] = conta.paginaInicial.split("?");
  return canAccessRoute(sessao, rota, busca) ? conta.paginaInicial : permittedRoutes(sessao)?.[0];
}
