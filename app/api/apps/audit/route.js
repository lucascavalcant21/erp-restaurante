import { NextResponse } from "next/server";
import { sessaoOuNegar } from "../../../lib/server/sessao-rota.mjs";
import { carregarPermissoes, permite } from "../../../lib/server/permissoes-efetivas.mjs";

export const dynamic = "force-dynamic";

// Registro de acessos dos apps dedicados. Exige sessão nas duas direções
// (S-34): antes qualquer pessoa lia logins e IPs e gravava registros falsos.
// O app sem sessão do Supabase mantém o registro no próprio aparelho.
const PERMISSOES_DE_LEITURA = ["configuracoes.users.view", "configuracoes.store.view"];
const texto = (valor, limite) => String(valor ?? "").slice(0, limite);
const ipValido = (ip) => (/^[0-9a-f:.]{2,45}$/i.test(ip) ? ip : null);

export async function GET(request) {
  const sessao = await sessaoOuNegar(request);
  if (sessao.resposta) return sessao.resposta;
  const { db, usuario } = sessao;

  const perms = await carregarPermissoes(db, usuario);
  if (!permite(perms, PERMISSOES_DE_LEITURA)) {
    return NextResponse.json({ error: "Você não tem permissão para ver estes registros." }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const unidadeId = searchParams.get("unidade") || usuario.unidade_id || "matriz";
  let consulta = db.from("acessos_auditoria").select("*").order("created_at", { ascending: false }).limit(200);

  // A tabela não tem unidade: fora o super admin, só entram os registros de
  // quem é da mesma unidade. Nunca os de outra empresa.
  if (!perms.superAdmin) {
    if (!usuario.unidade_id) return NextResponse.json({ logs: [] });
    const { data: colegas, error } = await db.from("usuarios_erp").select("id")
      .or(`unidade_id.eq.${usuario.unidade_id},unidade_principal_id.eq.${usuario.unidade_id}`);
    if (error) return NextResponse.json({ logs: [] });
    consulta = consulta.in("usuario_id", (colegas || []).map((c) => c.id));
  }

  const { data, error } = await consulta;
  if (error) return NextResponse.json({ logs: [] });
  return NextResponse.json({
    logs: (data || []).map((l) => {
      const aparelho = l.user_agent ? parseUa(l.user_agent) : null;
      return {
        id: l.id,
        app_id: l.detalhes?.app_id || l.usuario_id || "sistema",
        app_nome: l.detalhes?.app_nome || "App Hefisto",
        login: l.detalhes?.login || "login",
        unidade_id: unidadeId,
        sucesso: l.sucesso !== false,
        evento: l.evento || "login",
        timestamp: l.created_at,
        ip: l.ip || "Rede Local",
        dispositivo: aparelho?.dispositivo || "Dispositivo",
        navegador: aparelho?.navegador || "Navegador",
        local: `Unidade ${unidadeId === "matriz" ? "Matriz" : unidadeId}`,
      };
    }),
  });
}

export async function POST(request) {
  const sessao = await sessaoOuNegar(request);
  if (sessao.resposta) return sessao.resposta;
  const { db, usuario, authUserId } = sessao;

  let body = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const encaminhado = request.headers.get("x-forwarded-for");
  const ip = ipValido(((encaminhado ? encaminhado.split(",")[0] : request.headers.get("x-real-ip")) || "").trim());

  // Quem é e de onde veio saem da sessão e do pedido, não do corpo.
  const { error } = await db.from("acessos_auditoria").insert({
    usuario_id: usuario.id,
    auth_user_id: authUserId,
    evento: texto(body.evento || "acesso", 60),
    sucesso: body.sucesso !== false,
    ip,
    user_agent: texto(request.headers.get("user-agent"), 300),
    device_id: texto(body.app_id || "sistema", 120),
    detalhes: {
      app_id: texto(body.app_id, 120),
      app_nome: texto(body.app_nome, 120),
      login: texto(body.login, 120),
      detalhes: texto(body.detalhes, 300),
    },
  });
  if (error) return NextResponse.json({ error: "Não foi possível registrar." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

function parseUa(ua = "") {
  let dispositivo = "Computador / Desktop";
  let tipoTela = "Desktop";

  if (/ipad/i.test(ua)) {
    dispositivo = "Apple iPad";
    tipoTela = "Tablet";
  } else if (/tablet|(android(?!.*mobile))/i.test(ua)) {
    dispositivo = "Tablet Android";
    tipoTela = "Tablet";
  } else if (/iphone/i.test(ua)) {
    dispositivo = "Apple iPhone";
    tipoTela = "Smartphone";
  } else if (/mobile|android/i.test(ua)) {
    dispositivo = "Celular Android";
    tipoTela = "Smartphone";
  } else if (/windows/i.test(ua)) {
    dispositivo = "Computador Windows";
  } else if (/macintosh|mac os x/i.test(ua)) {
    dispositivo = "Apple Mac";
  } else if (/linux/i.test(ua)) {
    dispositivo = "Terminal Linux";
  }

  let navegador = "Navegador Web";
  if (/chrome|crios/i.test(ua) && !/edge|edg/i.test(ua)) navegador = "Google Chrome";
  else if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) navegador = "Apple Safari";
  else if (/firefox/i.test(ua)) navegador = "Mozilla Firefox";
  else if (/edg/i.test(ua)) navegador = "Microsoft Edge";

  return { dispositivo, navegador, tipoTela };
}
