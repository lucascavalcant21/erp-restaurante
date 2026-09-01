import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req) {
  const fiscalUrl = String(process.env.FISCAL_API_URL || "").trim();
  const fiscalToken = String(process.env.FISCAL_API_TOKEN || "").trim();
  if (!fiscalUrl || !fiscalToken) {
    return NextResponse.json({
      error: "Emissão fiscal oficial ainda não configurada. Informe o motor fiscal e as credenciais de produção nas configurações da Vercel.",
      codigo: "FISCAL_NAO_CONFIGURADO",
    }, { status: 503 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: "Banco fiscal não configurado." }, { status: 503 });
  }
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { pedido_id, unidade_id, cpf_cliente } = await req.json();
    if (!pedido_id || !unidade_id) return NextResponse.json({ error: "Pedido e unidade são obrigatórios." }, { status: 400 });

    const [{ data: pedido, error: erroPedido }, { data: unidade, error: erroUnidade }] = await Promise.all([
      supabase.from("pedidos").select("*, pedidos_itens(*, produtos(nome_produto))").eq("id", pedido_id).eq("unidade_id", unidade_id).single(),
      supabase.from("unidades").select("id,nome,cnpj,inscricao_estadual,regime_tributario,endereco_fiscal,codigo_ibge,ambiente_nfe").eq("id", unidade_id).single(),
    ]);
    if (erroPedido || !pedido) return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    if (erroUnidade || !unidade) return NextResponse.json({ error: "Dados fiscais da unidade não encontrados." }, { status: 404 });

    const resposta = await fetch(fiscalUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${fiscalToken}` },
      body: JSON.stringify({ pedido, emitente: unidade, cpf_cliente: cpf_cliente || null }),
      signal: AbortSignal.timeout(30000),
    });
    const retorno = await resposta.json().catch(() => ({}));
    if (!resposta.ok || retorno.error) {
      return NextResponse.json({ error: retorno.error || retorno.mensagem || "A SEFAZ recusou a emissão." }, { status: resposta.status || 502 });
    }

    const notaRecebida = retorno.nota || retorno;
    const nota = {
      unidade_id,
      pedido_id,
      numero_nota: notaRecebida.numero_nota || notaRecebida.numero || null,
      serie_nota: notaRecebida.serie_nota || notaRecebida.serie || null,
      chave_acesso: notaRecebida.chave_acesso || notaRecebida.chave || null,
      status: notaRecebida.status || "autorizada",
      mensagem_sefaz: notaRecebida.mensagem_sefaz || notaRecebida.mensagem || "Autorizada",
      url_xml: notaRecebida.url_xml || null,
      url_pdf: notaRecebida.url_pdf || notaRecebida.url_danfe || null,
      valor_total: Number(notaRecebida.valor_total ?? pedido.valor_total) || 0,
      cpf_cliente: cpf_cliente || null,
    };
    if (!nota.numero_nota || !nota.chave_acesso) {
      return NextResponse.json({ error: "O motor fiscal não devolveu número e chave de acesso válidos." }, { status: 502 });
    }

    const { error: erroHistorico } = await supabase.from("notas_fiscais").insert([nota]);
    if (erroHistorico) return NextResponse.json({ error: "Nota autorizada, mas não foi possível salvar o histórico fiscal.", detalhe: erroHistorico.message }, { status: 500 });
    return NextResponse.json({ success: true, mensagem: nota.mensagem_sefaz, nota });
  } catch (error) {
    const timeout = error?.name === "TimeoutError" || error?.name === "AbortError";
    return NextResponse.json({ error: timeout ? "O motor fiscal demorou demais para responder." : "Falha na comunicação com o motor fiscal." }, { status: 502 });
  }
}
