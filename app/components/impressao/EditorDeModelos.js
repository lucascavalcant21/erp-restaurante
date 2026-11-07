"use client";

// Editor dos modelos de impressão (cozinha, bar, conferência, recibo), com a
// prévia ao lado: a prévia é o mesmo HTML que sai na impressora.

import { useMemo, useState } from "react";
import { CAMPOS_DA_VIA, TAMANHOS, TIPOS_DE_VIA, htmlDasVias, linhasDaConta, linhasDaProducao } from "../../lib/impressao-modelos.mjs";

export const EXEMPLO_TICKET = {
  id: "a1b2c3d4", origem: "Salão", identificacao: "Mesa 5", garcom: "Caio", cliente: "Ana",
  itens: [
    { quantidade: 2, nome: "Tacacá", observacao: "Sem jambu, bem quente", pessoa: "Ana" },
    { quantidade: 1, nome: "Pato no tucupi", observacao: null, pessoa: "Bia" },
  ],
};
export const EXEMPLO_BAR = { ...EXEMPLO_TICKET, itens: [{ quantidade: 2, nome: "Suco de cupuaçu", observacao: "Sem gelo", pessoa: "Ana" }, { quantidade: 1, nome: "Caipirinha", observacao: null, pessoa: "Bia" }] };
export const EXEMPLO_CONTA = {
  tipo: "salao", mesa: 5, garcom: "Caio", cliente: "Ana", data: new Date(),
  itens: [{ nome: "Tacacá", qtd: 2, tot: 70 }, { nome: "Pato no tucupi", qtd: 1, tot: 80 }, { nome: "Suco de cupuaçu", qtd: 2, tot: 24 }],
  subtotal: 174, desconto: 0, taxa: 17.4, total: 191.4,
  porPessoa: [{ nome: "Ana", total: 95.7 }, { nome: "Bia", total: 95.7 }],
  recebidos: [{ forma: "pix", valor: 100 }, { forma: "dinheiro", valor: 100 }], troco: 8.6,
};

/** Linhas de exemplo de cada via, com o modelo do momento. */
export function linhasDeExemplo(tipo, modelos) {
  if (tipo === "cozinha") return linhasDaProducao("cozinha", EXEMPLO_TICKET, modelos);
  if (tipo === "bar") return linhasDaProducao("bar", EXEMPLO_BAR, modelos);
  return linhasDaConta(tipo, EXEMPLO_CONTA, modelos);
}

const inputCls = "min-h-[44px] w-full rounded-xl border border-hf-border bg-hf-surface px-3 text-sm text-hf-text outline-none focus:border-hf-accent disabled:opacity-60";

function Campo({ rotulo, ajuda, children }) {
  return (
    <label className="block min-w-0">
      <span className="text-xs font-bold text-hf-text-2">{rotulo}</span>
      <span className="mt-1 block">{children}</span>
      {ajuda && <span className="mt-1 block text-xs text-hf-muted">{ajuda}</span>}
    </label>
  );
}

export default function EditorDeModelos({ modelos, onChange, podeEditar }) {
  const [tipo, setTipo] = useState("cozinha");
  const [largura, setLargura] = useState("80mm");
  const v = modelos[tipo];
  const grupo = tipo === "cozinha" || tipo === "bar" ? "producao" : "conta";
  const mudarVia = (parcial) => onChange({ ...modelos, [tipo]: { ...v, ...parcial } });
  const mudarCasa = (parcial) => onChange({ ...modelos, casa: { ...modelos.casa, ...parcial } });
  const previa = useMemo(() => htmlDasVias([linhasDeExemplo(tipo, modelos)], { largura }), [tipo, modelos, largura]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" role="tablist" aria-label="Via">
        {Object.entries(TIPOS_DE_VIA).map(([id, t]) => (
          <button key={id} type="button" role="tab" aria-selected={tipo === id} onClick={() => setTipo(id)}
            className={`min-h-[52px] rounded-xl border px-3 py-2 text-left transition ${tipo === id ? "border-hf-accent bg-hf-accent/10" : "border-hf-border bg-hf-surface hover:bg-hf-elevated"}`}>
            <span className="block text-sm font-black text-hf-text">{t.rotulo}</span>
            <span className="block text-[11px] leading-tight text-hf-text-2">{t.descricao}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
        <div className="space-y-4">
          <section className="space-y-3 rounded-2xl border border-hf-border bg-hf-surface p-4">
            <h3 className="text-sm font-black text-hf-text">Textos da via</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Título"><input className={inputCls} value={v.titulo} maxLength={40} disabled={!podeEditar} onChange={(e) => mudarVia({ titulo: e.target.value })} /></Campo>
              <Campo rotulo={grupo === "producao" ? "Tamanho dos itens" : "Tamanho do título e dos itens"}>
                <select className={inputCls} value={v.tamanho} disabled={!podeEditar} onChange={(e) => mudarVia({ tamanho: e.target.value })}>
                  {Object.entries(TAMANHOS).map(([id, r]) => <option key={id} value={id}>{r}</option>)}
                </select>
              </Campo>
            </div>
            <Campo rotulo="Cabeçalho" ajuda="Aparece no alto, centralizado. Uma linha por linha do papel.">
              <textarea className={`${inputCls} min-h-[72px] py-2`} value={v.cabecalho} maxLength={300} disabled={!podeEditar} onChange={(e) => mudarVia({ cabecalho: e.target.value })} />
            </Campo>
            <Campo rotulo="Rodapé">
              <textarea className={`${inputCls} min-h-[72px] py-2`} value={v.rodape} maxLength={300} disabled={!podeEditar} onChange={(e) => mudarVia({ rodape: e.target.value })} />
            </Campo>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Cópias">
                <select className={inputCls} value={v.copias} disabled={!podeEditar} onChange={(e) => mudarVia({ copias: Number(e.target.value) })}>
                  {[1, 2, 3].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </Campo>
              <label className="flex min-h-[44px] items-center gap-3 self-end text-sm text-hf-text">
                <input type="checkbox" className="h-5 w-5 accent-hf-accent" checked={v.cortar} disabled={!podeEditar} onChange={(e) => mudarVia({ cortar: e.target.checked })} />
                Cortar o papel no fim (térmicas com guilhotina)
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-hf-border bg-hf-surface p-4">
            <h3 className="text-sm font-black text-hf-text">O que aparece</h3>
            <div className="mt-2 grid gap-1 sm:grid-cols-2">
              {CAMPOS_DA_VIA[grupo].map(([campo, rotulo]) => (
                <label key={campo} className="flex min-h-[44px] items-center gap-3 rounded-lg px-1 text-sm text-hf-text hover:bg-hf-elevated">
                  <input type="checkbox" className="h-5 w-5 shrink-0 accent-hf-accent" checked={!!v.mostrar[campo]} disabled={!podeEditar}
                    onChange={(e) => mudarVia({ mostrar: { ...v.mostrar, [campo]: e.target.checked } })} />
                  {rotulo}
                </label>
              ))}
            </div>
          </section>

          <section className="space-y-3 rounded-2xl border border-hf-border bg-hf-surface p-4">
            <div>
              <h3 className="text-sm font-black text-hf-text">Dados da casa</h3>
              <p className="text-xs text-hf-text-2">Valem para todas as vias que mostram nome, CNPJ, endereço ou telefone.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo rotulo="Nome"><input className={inputCls} value={modelos.casa.nome} maxLength={60} disabled={!podeEditar} onChange={(e) => mudarCasa({ nome: e.target.value })} /></Campo>
              <Campo rotulo="CNPJ"><input className={inputCls} value={modelos.casa.documento} maxLength={30} inputMode="numeric" disabled={!podeEditar} onChange={(e) => mudarCasa({ documento: e.target.value })} /></Campo>
              <Campo rotulo="Endereço"><input className={inputCls} value={modelos.casa.endereco} maxLength={120} disabled={!podeEditar} onChange={(e) => mudarCasa({ endereco: e.target.value })} /></Campo>
              <Campo rotulo="Telefone"><input className={inputCls} value={modelos.casa.telefone} maxLength={30} inputMode="tel" disabled={!podeEditar} onChange={(e) => mudarCasa({ telefone: e.target.value })} /></Campo>
            </div>
          </section>
        </div>

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-sm font-black text-hf-text">Prévia</h3>
            <div className="flex rounded-lg border border-hf-border p-0.5" role="group" aria-label="Largura do papel">
              {["80mm", "58mm"].map((l) => (
                <button key={l} type="button" onClick={() => setLargura(l)} aria-pressed={largura === l}
                  className={`min-h-[36px] rounded-md px-3 text-xs font-bold ${largura === l ? "bg-hf-accent text-hf-accent-fg" : "text-hf-text-2"}`}>{l.replace("mm", " mm")}</button>
              ))}
            </div>
          </div>
          <div className="flex justify-center overflow-hidden rounded-2xl border border-hf-border bg-hf-elevated p-3">
            <iframe title={`Prévia: ${TIPOS_DE_VIA[tipo].rotulo}`} srcDoc={previa} sandbox=""
              className="h-[520px] max-w-full rounded bg-white shadow" style={{ width: largura === "58mm" ? 240 : 320 }} />
          </div>
          <p className="mt-2 text-xs text-hf-muted">Exemplo com dados fictícios. Na térmica por rede, USB ou Bluetooth, o texto sai sem acentos para funcionar em qualquer modelo.</p>
        </aside>
      </div>
    </div>
  );
}
