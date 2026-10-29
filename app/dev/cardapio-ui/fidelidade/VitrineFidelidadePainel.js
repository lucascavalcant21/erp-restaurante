"use client";

import { useState } from "react";
import { TemaCardapio } from "../../../components/cardapio-digital/ui";
import PainelFidelidade, { resultadoDoCodigo } from "../../../components/cardapio-digital/painel/PainelFidelidade";
import { normalizarFidelidade } from "../../../lib/fidelidade.mjs";

// Dados de exemplo do protótipo PainelFidelidade (Casa Brasa), para comparação.
const MENU = ["Dashboard", "Clientes (CRM)", "Disparos WhatsApp", "Campanhas automáticas", "Cardápio", "Promoções e descontos", "Recomendações",
  "Fidelidade e selos", "Menu degustação", "Vitrine e banners", "Nossa história", "Idiomas", "Configurações"]
  .map((rotulo) => ({ id: rotulo === "Fidelidade e selos" ? "fidelidade" : rotulo, rotulo, href: "#" }));
const CFG = normalizarFidelidade({
  ativo: true,
  cashback: { ativo: true, pontos_por_real: 1, valor_100: 2, validade_dias: 365 },
  cartoes: [
    { id: "tacaca", nome: "Cartão Tacacá", produto_ids: ["t"], selos: 6, recompensa: "1 Tacacá grátis", por: "unidade" },
    { id: "hh", nome: "Cartão Happy hour", produto_ids: ["c"], selos: 10, recompensa: "1 porção de isca", por: "unidade" },
  ],
});
const RETIRADAS = [
  { quando: "2026-10-20T16:12:00Z", cliente: "Rafael S.", premio: "1 Tacacá", codigo: "TCK2M8", quem: "Joana (caixa)" },
  { quando: "2026-10-19T23:40:00Z", cliente: "Carlos M.", premio: "1 porção de isca", codigo: "HHR9K1", quem: "Pedro (garçom)" },
];

export default function VitrineFidelidadePainel() {
  const [codigo, setCodigo] = useState("TCK-7F3Q2");
  const [regras, setRegras] = useState(CFG);
  return (
    <TemaCardapio style={{ minHeight: "100vh", display: "flex" }}>
      <PainelFidelidade nomeLoja="Casa Brasa" itensMenu={MENU} codigo={codigo} onCodigo={setCodigo}
        resultado={resultadoDoCodigo({ ok: true, cliente: "Manuela", final: "7777", recompensa: "1 Tacacá", cartao: "Cartão Tacacá",
          completo_em: "2026-10-20T12:00:00Z", valido_ate: "2026-11-19T12:00:00Z" })}
        regras={regras} setRegras={setRegras} cartoes={CFG.cartoes} numeros={{ tacaca: { andamento: 38, completosMes: 12 }, hh: { andamento: 21, completosMes: 5 } }}
        retiradas={RETIRADAS} ligado />
    </TemaCardapio>
  );
}
