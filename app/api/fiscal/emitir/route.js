import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Inicializa Supabase no lado do Servidor
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(req) {
  try {
    const body = await req.json();
    const { pedido_id, unidade_id, cpf_cliente } = body;

    if (!pedido_id || !unidade_id) {
      return NextResponse.json({ error: "Parâmetros obrigatórios ausentes." }, { status: 400 });
    }

    // 1. Busca Pedido (Para calcular valor total e itens - Simulado)
    const { data: pedido } = await supabase
       .from("pedidos")
       .select("*, pedidos_itens(*)")
       .eq("id", pedido_id)
       .single();

    if (!pedido) {
       return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
    }

    const valor_total = pedido.pedidos_itens?.reduce((acc, it) => acc + (it.quantidade * (it.valor_unitario || 0)), 0) || 0;

    // 2. Simula o Envio para SEFAZ (Delay de 2 segundos)
    await new Promise(r => setTimeout(r, 2000));

    // Aqui geramos dados falsos da SEFAZ para manter o sistema operacional no ambiente de testes (Sandbox)
    const numero_nota = Math.floor(100000 + Math.random() * 900000).toString();
    const chave_acesso = `3523101234567800019965001000${numero_nota}123456789`;
    
    // Links fictícios, o PDF real viria da API
    const url_pdf = "https://hefisto-mock-nfe.vercel.app/danfe.pdf"; 
    const url_xml = "https://hefisto-mock-nfe.vercel.app/nota.xml";

    // 3. Salva no Banco de Dados Histórico Fiscal
    const novaNota = {
       unidade_id,
       pedido_id,
       numero_nota,
       serie_nota: "1",
       chave_acesso,
       status: "autorizada",
       mensagem_sefaz: "Autorizado o uso da NFC-e",
       url_xml,
       url_pdf,
       valor_total,
       cpf_cliente: cpf_cliente || null
    };

    const { error: insertError, data: notaSalva } = await supabase
       .from("notas_fiscais")
       .insert([novaNota])
       .select()
       .single();

    if (insertError) {
       console.error("Erro ao salvar nota fiscal:", insertError);
       return NextResponse.json({ error: "NFC-e Autorizada, mas erro ao salvar no banco." }, { status: 500 });
    }

    // Retorna Sucesso com os links do PDF/XML
    return NextResponse.json({ 
       success: true, 
       mensagem: "Autorizado o uso da NFC-e", 
       nota: novaNota 
    });

  } catch (err) {
    console.error("Erro API Fiscal:", err);
    return NextResponse.json({ error: "Erro interno no servidor fiscal." }, { status: 500 });
  }
}
