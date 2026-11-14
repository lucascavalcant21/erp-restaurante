"use client";

// Blocos da lista de compras do Jhon (14/11/2026):
//  · "lista_compras": a lista montada; o dono tira o que não quer, junta as
//    sugestões do estoque mínimo, põe o WhatsApp de quem compra e toca em
//    "Salvar e mandar no WhatsApp" (só aí grava e abre o WhatsApp).
//  · "lista_compras_conferencia": o que veio e o que faltou; "Confirmar"
//    grava (o que faltou volta na próxima lista).
// Sem preço: a compra com valor entra pela foto da nota.

import { useMemo, useState } from "react";
import { Check, MessageCircle, Plus, X } from "lucide-react";
import { useERP } from "../../../context/ERPContext";
import { mensagemWhatsApp, linkWhatsApp } from "../../../lib/lista-compras.mjs";
import { salvarListaDeCompras } from "../../../lib/lista-compras-dados";

const qtd = (i) => (i.quantidade != null ? `${Number(i.quantidade).toLocaleString("pt-BR")} ${i.unidade || ""}`.trim() : "");

function Montar({ bloco }) {
  const { unidadeAtiva, unidadeInfo } = useERP();
  const [itens, setItens] = useState(bloco.itens || []);
  const [sug, setSug] = useState(bloco.sugestoes || []);
  const [tel, setTel] = useState(bloco.comprador?.telefone || "");
  const [nome, setNome] = useState(bloco.comprador?.nome || "");
  const [estado, setEstado] = useState("");
  const casa = unidadeInfo?.nome_fantasia || unidadeInfo?.nome || "";
  const msg = useMemo(() => mensagemWhatsApp(itens, { casa, data: bloco.data }), [itens, casa, bloco.data]);

  async function salvarEMandar() {
    setEstado("salvando");
    const lista = { data: bloco.data, itens, comprador: { nome: nome.trim() || null, telefone: tel.replace(/\D/g, "") || null }, enviadaEm: new Date().toISOString() };
    const r = await salvarListaDeCompras(unidadeAtiva, lista);
    if (r.error) { setEstado(`Não salvou: ${r.error}`); return; }
    setEstado("ok");
    window.open(linkWhatsApp(msg, tel), "_blank", "noopener,noreferrer");
  }

  return (
    <section className="mt-1 rounded-2xl border border-hf-border bg-hf-surface p-3.5 text-hf-text" aria-label="Lista de compras">
      <p className="text-[13px] font-semibold text-hf-accent">Lista de compras</p>
      <ul className="mt-2 divide-y divide-hf-border">
        {itens.map((i) => (
          <li key={i.id} className="flex min-h-[48px] items-center gap-2 py-1.5">
            <span className="min-w-0 flex-1">
              <span className="block text-[15.5px] font-semibold">{i.nomeCadastro || i.nome}</span>
              {!i.insumoId && <span className="block text-[12px] text-hf-muted">fora do cadastro</span>}
            </span>
            <span className="text-[15px] font-semibold tabular-nums">{qtd(i)}</span>
            <button type="button" aria-label={`Tirar ${i.nome}`} onClick={() => setItens(itens.filter((x) => x.id !== i.id))} className="flex h-10 w-10 items-center justify-center rounded-full text-hf-muted"><X size={16} /></button>
          </li>
        ))}
      </ul>
      {sug.length > 0 && (
        <div className="mt-2 rounded-xl bg-hf-elevated p-2.5">
          <p className="text-[13px] font-semibold text-hf-text-2">Abaixo do mínimo no estoque</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {sug.map((s) => (
              <button key={s.insumo_id} type="button" onClick={() => { setItens([...itens, { id: `s${s.insumo_id}`, nome: s.produto, nomeCadastro: s.produto, insumoId: s.insumo_id, quantidade: null, unidade: null, status: "pendente" }]); setSug(sug.filter((x) => x.insumo_id !== s.insumo_id)); }}
                className="inline-flex min-h-[40px] items-center gap-1 rounded-full border border-hf-border bg-hf-surface px-3 text-[14px] font-semibold">
                <Plus size={14} /> {s.produto} <span className="font-normal text-hf-muted">({Number(s.saldo).toLocaleString("pt-BR")} de {Number(s.minimo).toLocaleString("pt-BR")} {s.unidade})</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="mt-3 grid grid-cols-2 gap-2">
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Quem compra" aria-label="Quem compra" className="h-11 rounded-xl border border-hf-border bg-hf-surface px-3 text-[16px]" />
        <input value={tel} onChange={(e) => setTel(e.target.value)} inputMode="tel" placeholder="WhatsApp" aria-label="WhatsApp de quem compra" className="h-11 rounded-xl border border-hf-border bg-hf-surface px-3 text-[16px]" />
      </div>
      <button type="button" onClick={salvarEMandar} disabled={!itens.length || estado === "salvando"}
        className="mt-3 flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl text-[15.5px] font-semibold text-white disabled:opacity-50" style={{ background: "#128C7E" }}>
        <MessageCircle size={18} /> {estado === "ok" ? "Lista salva. Mandar de novo" : "Salvar e mandar no WhatsApp"}
      </button>
      {estado && estado !== "ok" && estado !== "salvando" && <p className="mt-1 text-[13px] text-hf-danger">{estado}</p>}
      {estado === "ok" && <p className="mt-1 text-[13px] text-hf-muted">Quando a compra voltar, diga ao Jhon: "comprei tudo, faltou…".</p>}
    </section>
  );
}

function Conferencia({ bloco }) {
  const { unidadeAtiva } = useERP();
  const [estado, setEstado] = useState("");
  async function confirmar() {
    setEstado("salvando");
    const r = await salvarListaDeCompras(unidadeAtiva, { data: bloco.data, itens: bloco.lista, comprador: bloco.comprador || null, conferidaEm: new Date().toISOString() });
    setEstado(r.error ? `Não salvou: ${r.error}` : "ok");
  }
  const linha = (i, ok) => (
    <li key={i.id} className="flex items-center gap-2 py-1.5 text-[15px]">
      {ok ? <Check size={16} className="text-hf-success" /> : <X size={16} className="text-hf-warning" />}
      <span className="flex-1">{i.nomeCadastro || i.nome}</span><span className="tabular-nums text-hf-muted">{qtd(i)}</span>
    </li>
  );
  return (
    <section className="mt-1 rounded-2xl border border-hf-border bg-hf-surface p-3.5 text-hf-text" aria-label="Conferência da compra">
      <p className="text-[13px] font-semibold text-hf-accent">Conferência da compra</p>
      {bloco.vieram.length > 0 && <ul className="mt-1">{bloco.vieram.map((i) => linha(i, true))}</ul>}
      {bloco.faltaram.length > 0 && (<><p className="mt-2 text-[13px] font-semibold text-hf-warning">Faltou (volta na próxima lista)</p><ul>{bloco.faltaram.map((i) => linha(i, false))}</ul></>)}
      <button type="button" onClick={confirmar} disabled={estado === "salvando" || estado === "ok"}
        className="mt-3 min-h-[48px] w-full rounded-xl bg-hf-menu text-[15.5px] font-semibold text-white disabled:opacity-60">
        {estado === "ok" ? "Conferência salva" : "Confirmar"}
      </button>
      {estado && estado.startsWith("Não") && <p className="mt-1 text-[13px] text-hf-danger">{estado}</p>}
    </section>
  );
}

export default function ListaDeCompras({ bloco }) {
  if (bloco?.tipo === "lista_compras") return <Montar bloco={bloco} />;
  if (bloco?.tipo === "lista_compras_conferencia") return <Conferencia bloco={bloco} />;
  return null;
}
