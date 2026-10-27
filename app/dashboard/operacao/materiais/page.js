"use client";
// Entrada dos materiais da casa: cada grupo tem a sua tela e o seu estoque
// (pedido do dono, 27/10/2026: "quero cada uma separada").
import Link from "next/link";
import { Sparkles, Droplets, Package, Boxes, ChevronRight } from "lucide-react";
import { PageHeader, PageBody } from "../../../components/ui";
import { GRUPOS_MATERIAIS } from "../../../lib/materiais.mjs";

const ICONE = { limpeza: Sparkles, maquina: Droplets, embalagens: Package };

export default function MateriaisPage() {
  return (
    <div className="min-h-screen">
      <PageHeader title="Limpeza, máquina e embalagens" subtitle="Cada um com o seu cadastro e o seu estoque" icon={Boxes} />
      <PageBody>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {GRUPOS_MATERIAIS.map((g) => {
            const I = ICONE[g.id];
            return (
              <Link key={g.id} href={g.rota} className="rounded-2xl p-4 flex items-start gap-3 transition hover:-translate-y-0.5" style={{ background: "var(--card)", border: "1px solid var(--line)" }}>
                <span className="w-11 h-11 rounded-xl grid place-items-center shrink-0" style={{ background: "var(--elevated)" }}><I size={20} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block font-bold" style={{ color: "var(--fg)" }}>{g.titulo}</span>
                  <span className="block text-sm" style={{ color: "var(--dim)" }}>{g.descricao}</span>
                  <span className="block text-xs font-bold mt-1" style={{ color: "var(--dim)" }}>Estoque: {g.locais.map((l) => l.rotulo).join(", ")}</span>
                </span>
                <ChevronRight size={18} className="shrink-0 mt-1" />
              </Link>
            );
          })}
        </div>
      </PageBody>
    </div>
  );
}
