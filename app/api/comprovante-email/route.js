import { NextResponse } from "next/server";
import { supabase } from "../../lib/supabase";

// Envio do comprovante de marcação por e-mail (Portaria MTP 671/2021, art. 84).
//
// A rota recebe só o NSR. Todo o conteúdo do comprovante é lido do banco aqui
// no servidor — nada do que o navegador mandar entra no e-mail. Um comprovante
// montado pelo cliente não provaria nada: quem recebe não tem como saber se o
// que está no papel é o que está no livro de marcações.
//
// Usa a API do Resend por fetch, sem biblioteca: uma dependência a mais no
// build não se justifica para uma chamada HTTP.

export const dynamic = "force-dynamic";

const ROTULO = {
  entrada: "Entrada",
  saida_intervalo: "Saída para intervalo",
  retorno_intervalo: "Volta do intervalo",
  saida_trabalho: "Saída do trabalho",
  ajuste: "Ajuste de marcação",
};

const escapar = (v) => String(v ?? "").replace(/[&<>"]/g, ch =>
  ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]));

const emSP = (data) => new Intl.DateTimeFormat("pt-BR", {
  timeZone: "America/Sao_Paulo",
  dateStyle: "short", timeStyle: "medium",
}).format(new Date(data));

function montarHtml({ nsr, tipo, marcadoEm, colaborador, unidade }) {
  const linha = (rot, val) => val
    ? `<tr><td style="padding:3px 14px 3px 0;color:#6b7280;font-size:12px;white-space:nowrap">${escapar(rot)}</td>
         <td style="padding:3px 0;color:#111827;font-size:13px;font-weight:600">${escapar(val)}</td></tr>`
    : "";

  return `<!doctype html><html lang="pt-BR"><body style="margin:0;padding:24px;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif">
    <div style="max-width:440px;margin:0 auto;background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:22px 24px">
      <p style="margin:0;font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:#6b7280;font-weight:700">
        Comprovante de marcação de ponto
      </p>
      <p style="margin:6px 0 16px;font-family:ui-monospace,'Courier New',monospace;font-size:34px;font-weight:700;color:#111827;letter-spacing:-.01em">
        NSR ${escapar(nsr)}
      </p>
      <table style="border-collapse:collapse;width:100%">
        ${linha("Empregador", unidade?.nome)}
        ${linha("CNPJ", unidade?.cnpj)}
        ${linha("Trabalhador", colaborador?.nome)}
        ${linha("CPF", colaborador?.cpf)}
        ${linha("Marcação", ROTULO[tipo] || tipo)}
        ${linha("Data e hora", emSP(marcadoEm))}
      </table>
      <p style="margin:18px 0 0;padding-top:14px;border-top:1px solid #e5e7eb;font-size:11px;line-height:1.5;color:#6b7280">
        Marcação registrada nos termos da Portaria MTP nº 671/2021. Guarde este
        comprovante — o NSR identifica a marcação de forma única e não se repete.
      </p>
    </div>
  </body></html>`;
}

// Registra a entrega. Nunca derruba o envio: se o log falhar, o comprovante já
// foi entregue e é isso que importa para o trabalhador.
async function registrarEntrega(dados) {
  try {
    await supabase.from("ponto_comprovante_envio").insert([dados]);
  } catch (e) {
    console.warn("Não consegui registrar a entrega do comprovante:", e?.message);
  }
}

export async function POST(request) {
  try {
    const { nsr } = await request.json();
    if (!nsr) return NextResponse.json({ erro: "Faltando o NSR." }, { status: 400 });

    const chave = process.env.RESEND_API_KEY;
    const remetente = process.env.COMPROVANTE_REMETENTE;
    if (!chave || !remetente) {
      // Diz o que falta em vez de "erro ao enviar": quem lê isso é quem
      // configura o Vercel, e a mensagem tem que bastar.
      return NextResponse.json({
        erro: "Envio por e-mail não configurado. Defina RESEND_API_KEY e COMPROVANTE_REMETENTE nas variáveis de ambiente do projeto.",
      }, { status: 503 });
    }

    const { data: marcacao, error: errMarc } = await supabase
      .from("ponto_marcacao")
      .select("nsr, unidade_id, colaborador_id, tipo, marcado_em")
      .eq("nsr", nsr)
      .single();

    if (errMarc || !marcacao) {
      return NextResponse.json({ erro: "Marcação não encontrada para este NSR." }, { status: 404 });
    }

    const { data: colaborador } = await supabase
      .from("colaboradores").select("nome, cpf, email").eq("id", marcacao.colaborador_id).single();

    if (!colaborador?.email) {
      return NextResponse.json({
        erro: `${colaborador?.nome || "O colaborador"} não tem e-mail cadastrado. Cadastre em RH para poder enviar o comprovante.`,
      }, { status: 422 });
    }

    const { data: unidade } = await supabase
      .from("unidades").select("nome, cnpj").eq("id", marcacao.unidade_id).single();

    const html = montarHtml({
      nsr: marcacao.nsr,
      tipo: marcacao.tipo,
      marcadoEm: marcacao.marcado_em,
      colaborador, unidade,
    });

    const resposta = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${chave}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: remetente,
        to: [colaborador.email],
        subject: `Comprovante de ponto · NSR ${marcacao.nsr} · ${ROTULO[marcacao.tipo] || marcacao.tipo}`,
        html,
      }),
    });

    const corpo = await resposta.json().catch(() => ({}));
    const base = {
      unidade_id: marcacao.unidade_id,
      colaborador_id: marcacao.colaborador_id,
      nsr: marcacao.nsr,
      meio: "email",
      destino: colaborador.email,
    };

    if (!resposta.ok) {
      const erro = corpo?.message || `Resend respondeu ${resposta.status}`;
      await registrarEntrega({ ...base, sucesso: false, erro });
      return NextResponse.json({ erro: `Não consegui enviar: ${erro}` }, { status: 502 });
    }

    await registrarEntrega({ ...base, sucesso: true });
    return NextResponse.json({ ok: true, destino: colaborador.email, nsr: marcacao.nsr });
  } catch (error) {
    console.error("ERRO COMPROVANTE E-MAIL:", error);
    return NextResponse.json({ erro: "Erro interno: " + error.message }, { status: 500 });
  }
}
