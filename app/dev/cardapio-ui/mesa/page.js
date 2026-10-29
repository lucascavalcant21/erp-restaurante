"use client";

import { useEffect, useState } from "react";
import { notFound } from "next/navigation";
import CardapioDigital from "../../../components/cardapio-digital/CardapioDigital";

// O cardápio inteiro da mesa (CardapioDigital) com a cópia local dos dados
// reais (public/dev-cardapio/cardapio-real.json), em modo prévia: serve para
// ver a tela do tablet dentro do componente de verdade, sem enviar pedido.
export default function Pagina() {
  if (process.env.NODE_ENV === "production") notFound();
  const [dados, setDados] = useState(null);
  useEffect(() => { fetch("/dev-cardapio/cardapio-real.json").then((r) => r.json()).then(setDados).catch(() => setDados(false)); }, []);
  if (dados === false) return <p style={{ padding: 24 }}>Sem a cópia local do cardápio (public/dev-cardapio/cardapio-real.json).</p>;
  if (!dados) return null;
  return <CardapioDigital unidadeId={dados.unidade?.id || "seldeestrela"} inicial={dados} carregadoEm={Date.now()} mesa="12" previa />;
}
