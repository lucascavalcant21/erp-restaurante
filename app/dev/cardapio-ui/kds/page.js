"use client";

import { useEffect, useMemo, useState } from "react";
import { notFound } from "next/navigation";
import { TemaCardapio } from "../../../components/cardapio-digital/ui";
import QuadroKDS from "../../../components/kds/QuadroKDS";
import { quadroKDS, tempoMedioKDS } from "../../../lib/kds-fila.mjs";

// KDS com os pedidos de exemplo do protótipo, só para comparar o desenho.
// A tela de verdade é /dashboard/cozinha/kds (pedidos_itens do banco).
const MIN = 60000;
function exemplo(agora) {
  const t = (id, tipo, cliente, ident, min, seg, itens) => ({
    id, tipo_pedido: tipo, cliente, identificacao: ident, status: "aberto", created_at: new Date(agora - min * MIN - seg * 1000).toISOString(),
    itens: itens.map((i, n) => ({ id: `${id}-${n}`, setor: "cozinha", updated_at: new Date(agora - 5 * MIN).toISOString(), ...i })),
  });
  return [
    t("49aa", "qrcode", "[MESA 5] Ana", null, 21, 0, [{ nome: "Feijoada completa", quantidade: 1, status: "pendente", observacao: "Extra: Couve extra" }]),
    t("52bb", "qrcode", "[MESA 7] João", null, 3, 12, [
      { nome: "Frango ao chimichurri", quantidade: 2, status: "pendente", observacao: "Acompanhamento: Arroz biro-biro · Molho à parte" },
      { nome: "Picanha na brasa", quantidade: 1, status: "pendente", observacao: "PARA VIAGEM · Ponto: Ao ponto · Sem: Cebola" },
    ]),
    t("53cc", "delivery", "Marcos", null, 1, 40, [{ nome: "Costela no fogo de chão", quantidade: 1, status: "pendente", observacao: "PARA VIAGEM · Acompanhamento: Mandioca cozida · ALERGIA: crustáceos" }]),
    t("47dd", "qrcode", "[MESA 12] Lu", null, 12, 5, [{ nome: "Picanha na brasa", quantidade: 1, status: "preparando", observacao: "Ponto: Ao ponto · Extra: Queijo coalho · Sem cebola no vinagrete" }]),
    t("44ee", "salao", null, "Mesa 3", 26, 10, [
      { nome: "Linguiça artesanal", quantidade: 3, status: "preparando" },
      { nome: "Arroz biro-biro", quantidade: 1, status: "preparando" },
    ]),
    t("48ff", "qrcode", "[MESA 12] Lu", null, 12, 0, [{ nome: "Caipirinha de limão", quantidade: 2, status: "pronto", setor: "bar" }]),
    t("45gg", "qrcode", "[MESA 9] Rita", null, 16, 0, [{ nome: "Pudim de leite", quantidade: 1, status: "pronto", observacao: "PARA VIAGEM" }]),
  ];
}

export default function Pagina() {
  if (process.env.NODE_ENV === "production") notFound();
  const [agora, setAgora] = useState(0);
  const [base, setBase] = useState(0);
  useEffect(() => { const n = Date.now(); setBase(n); setAgora(n); const i = setInterval(() => setAgora(Date.now()), 1000); return () => clearInterval(i); }, []);
  const tickets = useMemo(() => (base ? exemplo(base) : []), [base]);
  const quadro = useMemo(() => quadroKDS(tickets, agora || Date.now()), [tickets, agora]);
  if (!base) return null;
  return (
    <TemaCardapio>
      <QuadroKDS quadro={quadro} tempoMedio={tempoMedioKDS(quadro)} agora={agora} setor="todos" onSetor={() => {}}
        estacoes={[{ id: "todos", nome: "Todas", qtd: 7 }, { id: "cozinha", nome: "Cozinha", qtd: 6 }, { id: "bar", nome: "Bar", qtd: 1 }]}
        impressos={{ "48ff": new Date(base - 7 * MIN).toISOString(), "45gg": new Date(base - 5 * MIN).toISOString() }}
        onIniciar={() => {}} onPronto={() => {}} onReimprimir={() => {}} onEntregue={() => {}} />
    </TemaCardapio>
  );
}
