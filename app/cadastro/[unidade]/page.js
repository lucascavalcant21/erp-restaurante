import { cache } from "react";
import { notFound } from "next/navigation";
import { Fraunces, Playfair_Display } from "next/font/google";
import { getSupabaseServerClient } from "../../lib/server/supabase-server.mjs";
import { lerCardapioPublico } from "../../lib/server/negocio-publico.mjs";
import CadastroCliente from "../../components/cardapio-digital/Cadastro";

// Cadastro do cliente pelo QR do restaurante: vira cliente do CRM e ganha o
// desconto do dono nos pedidos pelo cardápio digital. Usa a cara do cardápio
// (cores, logo, fonte) e os mesmos oito idiomas.
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
  const { unidade } = await params;
  const r = await carregar(unidade);
  const nome = r.ok ? r.cardapio.unidade.nome : "";
  return { title: nome ? `${nome} — Cadastro` : "Cadastro", manifest: null, robots: { index: false } };
}

export async function generateViewport({ params }) {
  const { unidade } = await params;
  const r = await carregar(unidade);
  return { width: "device-width", initialScale: 1, maximumScale: 5, userScalable: true, viewportFit: "cover", themeColor: r.ok ? r.cardapio.cores.fundo : "#f6f1e8" };
}

export default async function CadastroPage({ params }) {
  const { unidade } = await params;
  const r = await carregar(unidade);
  if (!r.ok && r.status === 404) notFound();
  return (
    <div className={`${serifaClassica.variable} ${serifaEditorial.variable}`}>
      <CadastroCliente unidadeId={unidade} cardapioBase={r.ok ? r.cardapio : null} />
    </div>
  );
}
