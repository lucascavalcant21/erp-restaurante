import { cache } from "react";
import { notFound } from "next/navigation";
import { Fraunces, Playfair_Display } from "next/font/google";
import { getSupabaseServerClient } from "../../lib/server/supabase-server.mjs";
import { lerCardapioPublico } from "../../lib/server/negocio-publico.mjs";
import { limparMesa } from "../../lib/cardapio-link.mjs";
import CardapioDigital from "../../components/cardapio-digital/CardapioDigital";

// Cardápio digital do cliente (QR da mesa e link do delivery). O cardápio é
// montado no SERVIDOR (preço que vale agora, pratos ligados à ficha técnica,
// vitrine do dono) e chega pronto na primeira pintura; depois a página se
// atualiza sozinha (promoção que começa ou acaba, prato que sai do ar).
// Antes esta tela completava os pratos com descrição, foto, nota 4.9 e selo
// "Mais pedido" inventados, e caía num cardápio de demonstração (B-029).

export const dynamic = "force-dynamic";

// Fraunces com os eixos óticos: títulos grandes mais finos e macios ("SOFT").
const serifaClassica = Fraunces({ subsets: ["latin"], display: "swap", variable: "--fonte-classica", preload: false, axes: ["opsz", "SOFT"] });
const serifaEditorial = Playfair_Display({ subsets: ["latin"], display: "swap", variable: "--fonte-editorial", preload: false });

const carregar = cache(async (unidade) => {
  let db = null;
  try { db = getSupabaseServerClient(); } catch { return { ok: false, status: 503 }; }
  return lerCardapioPublico({ db, unidade });
});

export async function generateMetadata({ params }) {
  const { unidadeId } = await params;
  const r = await carregar(unidadeId);
  const nome = r.ok ? r.cardapio.unidade.nome : "";
  return {
    title: nome ? `${nome} — Cardápio` : "Cardápio",
    description: r.ok && r.cardapio.textos.apresentacao ? r.cardapio.textos.apresentacao : `Cardápio${nome ? ` do ${nome}` : ""}.`,
    manifest: null,
    appleWebApp: { capable: false, title: nome || "Cardápio" },
  };
}

export async function generateViewport({ params }) {
  const { unidadeId } = await params;
  const r = await carregar(unidadeId);
  return {
    width: "device-width",
    initialScale: 1,
    // O cliente pode dar zoom: aqui é leitura de cardápio, não tela de operação.
    maximumScale: 5,
    userScalable: true,
    viewportFit: "cover",
    themeColor: r.ok ? r.cardapio.cores.fundo : "#f6f1e8",
  };
}

export default async function CardapioPage({ params, searchParams }) {
  const { unidadeId } = await params;
  const sp = (await searchParams) || {};
  const r = await carregar(unidadeId);
  if (!r.ok && r.status === 404) notFound();
  return (
    <div className={`${serifaClassica.variable} ${serifaEditorial.variable}`}>
      <CardapioDigital
        unidadeId={unidadeId}
        inicial={r.ok ? r.cardapio : null}
        carregadoEm={r.ok ? Date.now() : null}
        mesa={limparMesa(typeof sp.mesa === "string" ? sp.mesa : "")}
        pratoInicial={typeof sp.prato === "string" ? sp.prato.slice(0, 64) : ""}
        previa={sp.previa === "1"}
      />
    </div>
  );
}
