"use client";

// Fidelidade (painel do dono): cartões de selo por produto, cashback e o
// cadastro pelo QR com desconto. Aqui ficam só as REGRAS
// (config_sistema.params.fidelidade). Quem dá selo, cashback e desconto é o
// banco, quando o pedido é concluído — com a FIDELIDADE-1 aplicada.

import { useMemo, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import { Download, Plus, Printer, Search, Trash2 } from "lucide-react";
import { LIMITES_FIDELIDADE } from "../../../lib/fidelidade.mjs";
import { caminhoDoCadastro } from "../../../lib/cardapio-link.mjs";
import { Alternar, Aviso, Botao, Campo, Chip, Secao, inputCls } from "./ui";

const numero = (v) => { const n = Number(String(v).replace(",", ".")); return Number.isFinite(n) ? n : 0; };

function Produtos({ todos, escolhidos, onChange }) {
  const [busca, setBusca] = useState("");
  const set = new Set(escolhidos);
  const termo = busca.trim().toLowerCase();
  const lista = todos.filter((p) => !termo || p.nome.toLowerCase().includes(termo)).slice(0, termo ? 60 : 30);
  const nomes = new Map(todos.map((p) => [p.id, p.nome]));
  const trocar = (id) => onChange(set.has(id) ? escolhidos.filter((x) => x !== id) : [...escolhidos, id].slice(0, LIMITES_FIDELIDADE.produtosPorCartao));
  return (
    <div className="space-y-2">
      <span className="block text-xs font-semibold text-hf-text-2">Produtos que valem selo ({escolhidos.length})</span>
      {escolhidos.length ? (
        <div className="flex flex-wrap gap-1.5">
          {escolhidos.map((id) => <Chip key={id} ativo onClick={() => trocar(id)} title="Tirar">{nomes.get(id) || "Produto fora do cardápio"} ×</Chip>)}
        </div>
      ) : <p className="text-xs text-hf-warning">Escolha pelo menos um produto: sem produto, o cartão não aparece.</p>}
      <span className="relative block">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-hf-muted" />
        <input className={`${inputCls} pl-9`} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar produto (café, hambúrguer…)" aria-label="Buscar produto para o cartão" />
      </span>
      <ul className="max-h-56 space-y-1 overflow-y-auto rounded-xl border border-hf-border p-1">
        {lista.map((p) => (
          <li key={p.id}>
            <label className="flex min-h-[40px] cursor-pointer items-center gap-2 rounded-lg px-2 text-sm hover:bg-hf-elevated">
              <input type="checkbox" checked={set.has(p.id)} onChange={() => trocar(p.id)} className="h-4 w-4 accent-[var(--hf-accent,#15803d)]" />
              <span className="min-w-0 flex-1 truncate">{p.nome}</span>
            </label>
          </li>
        ))}
        {!lista.length ? <li className="px-2 py-2 text-sm text-hf-muted">Nenhum produto com esse nome no cardápio.</li> : null}
      </ul>
    </div>
  );
}

export default function Fidelidade({ fidelidade, setFidelidade, produtos, livroFidelidade, unidadeId, nomeLoja }) {
  const f = fidelidade;
  const set = (campos) => setFidelidade((x) => ({ ...x, ...campos }));
  const setCb = (campos) => setFidelidade((x) => ({ ...x, cashback: { ...x.cashback, ...campos } }));
  const setCad = (campos) => setFidelidade((x) => ({ ...x, cadastro: { ...x.cadastro, ...campos } }));
  const setCartao = (i, campos) => setFidelidade((x) => ({ ...x, cartoes: x.cartoes.map((c, j) => (j === i ? { ...c, ...campos } : c)) }));
  const novoCartao = () => setFidelidade((x) => ({
    ...x,
    cartoes: [...x.cartoes, { id: `cartao-${Date.now().toString(36)}`, nome: "", produto_ids: [], selos: 10, por: "unidade", recompensa: "", validade_dias: 0, ativo: true }],
  }));
  const tirarCartao = (i) => setFidelidade((x) => ({ ...x, cartoes: x.cartoes.filter((_, j) => j !== i) }));
  const todos = useMemo(() => produtos.map((p) => ({ id: p.id, nome: p.nome })).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")), [produtos]);
  const qr = useRef(null);
  const origem = typeof window !== "undefined" ? window.location.origin : "";
  const linkCadastro = `${origem}${caminhoDoCadastro(unidadeId)}`;

  const baixarQr = () => {
    const c = qr.current?.querySelector("canvas");
    if (!c) return;
    const a = document.createElement("a");
    a.href = c.toDataURL("image/png");
    a.download = `qr-cadastro-${unidadeId}.png`;
    a.click();
  };
  const imprimirQr = () => {
    const c = qr.current?.querySelector("canvas");
    const w = c && window.open("", "_blank");
    if (!w) return;
    const titulo = String(nomeLoja || "").replace(/[<>&"]/g, "");
    w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>QR do cadastro — ${titulo}</title>
      <style>body{font-family:system-ui,sans-serif;text-align:center;margin:40px;color:#111}img{width:320px;height:320px}h1{font-size:30px;margin:0 0 8px}p{font-size:18px;margin:6px 0}</style></head>
      <body><h1>Cadastre-se e ganhe ${Number(f.cadastro.desconto_pct) || 10}% de desconto</h1><p>${f.cadastro.aplica === "sempre" ? "em todos os pedidos" : "no primeiro pedido"} pelo cardápio digital</p>
      <img src="${c.toDataURL("image/png")}" alt=""><p><strong>${titulo}</strong></p><script>window.onload=()=>{window.print()}<\/script></body></html>`);
    w.document.close();
  };

  return (
    <div className="space-y-4">
      {!livroFidelidade ? (
        <Aviso tipo="alerta">
          O banco ainda não tem o livro da fidelidade (migração FIDELIDADE-1, aguardando sua aprovação: APR-014). Até lá, o cardápio
          mostra as regras e o convite, mas ninguém ganha selo, cashback nem o desconto do cadastro.
        </Aviso>
      ) : null}
      <Secao titulo="Programa de fidelidade" subtitulo="Selo, cashback e desconto do cadastro só entram quando o pedido é marcado como pago ou entregue. Pedido cancelado volta atrás sozinho.">
        <Alternar ativo={f.ativo} onChange={(v) => set({ ativo: v })} rotulo="Programa ligado" dica={f.ativo ? "Aparece no cardápio digital." : "Desligado: nada aparece e nada é dado."} />
      </Secao>

      <Secao titulo="Cartões de selo" subtitulo="Um cartão por produto ou grupo de produtos (café, hambúrguer, drinks…). Você decide quantos selos completam o cartão e o prêmio."
        direita={f.cartoes.length < LIMITES_FIDELIDADE.cartoes ? <Botao variante="secundario" onClick={novoCartao}><Plus size={16} /> Novo cartão</Botao> : null}>
        {!f.cartoes.length ? <p className="text-sm text-hf-muted">Nenhum cartão ainda.</p> : null}
        <div className="space-y-4">
          {f.cartoes.map((c, i) => (
            <div key={c.id} className="space-y-3 rounded-2xl border border-hf-border p-3 sm:p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Alternar ativo={c.ativo !== false} onChange={(v) => setCartao(i, { ativo: v })} rotulo={c.nome || `Cartão ${i + 1}`} />
                <Botao variante="perigo" onClick={() => tirarCartao(i)} aria-label={`Tirar ${c.nome || `cartão ${i + 1}`}`}><Trash2 size={16} /> Tirar</Botao>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo rotulo="Nome do cartão" dica="Ex.: Cartão do café">
                  <input className={inputCls} value={c.nome} maxLength={40} onChange={(e) => setCartao(i, { nome: e.target.value })} />
                </Campo>
                <Campo rotulo="Prêmio" dica="Ex.: 1 café grátis. Sem prêmio, o cartão não aparece.">
                  <input className={inputCls} value={c.recompensa} maxLength={80} onChange={(e) => setCartao(i, { recompensa: e.target.value })} />
                </Campo>
                <Campo rotulo={`Selos para completar (${LIMITES_FIDELIDADE.selosMin} a ${LIMITES_FIDELIDADE.selosMax})`}>
                  <input className={inputCls} inputMode="numeric" value={c.selos} onChange={(e) => setCartao(i, { selos: Math.round(numero(e.target.value)) || "" })} />
                </Campo>
                <Campo rotulo="Selos vencem depois de" dica="Dias sem ganhar selo. 0 = não vencem.">
                  <input className={inputCls} inputMode="numeric" value={c.validade_dias} onChange={(e) => setCartao(i, { validade_dias: Math.max(0, Math.round(numero(e.target.value))) })} />
                </Campo>
              </div>
              <div className="flex flex-wrap gap-2">
                <Chip ativo={c.por !== "pedido"} onClick={() => setCartao(i, { por: "unidade" })}>1 selo por item</Chip>
                <Chip ativo={c.por === "pedido"} onClick={() => setCartao(i, { por: "pedido" })}>1 selo por pedido</Chip>
              </div>
              <Produtos todos={todos} escolhidos={c.produto_ids} onChange={(ids) => setCartao(i, { produto_ids: ids })} />
            </div>
          ))}
        </div>
      </Secao>

      <Secao titulo="Cashback" subtitulo="Uma parte do que o cliente pagou volta como crédito para o próximo pedido (nunca no mesmo).">
        <Alternar ativo={f.cashback.ativo} onChange={(v) => setCb({ ativo: v })} rotulo="Cashback ligado" />
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <Campo rotulo={`Volta em cashback (% de ${LIMITES_FIDELIDADE.pctMin} a ${LIMITES_FIDELIDADE.pctMax})`}>
            <input className={inputCls} inputMode="decimal" value={f.cashback.percentual} onChange={(e) => setCb({ percentual: e.target.value })} />
          </Campo>
          <Campo rotulo="Só em pedidos a partir de (R$)" dica="0 = qualquer valor.">
            <input className={inputCls} inputMode="decimal" value={f.cashback.minimo_pedido} onChange={(e) => setCb({ minimo_pedido: e.target.value })} />
          </Campo>
          <Campo rotulo="Até quanto do pedido pode ser pago com cashback (%)">
            <input className={inputCls} inputMode="numeric" value={f.cashback.uso_maximo_pct} onChange={(e) => setCb({ uso_maximo_pct: e.target.value })} />
          </Campo>
          <Campo rotulo="Cashback vence depois de" dica="Dias sem ganhar cashback. 0 = não vence.">
            <input className={inputCls} inputMode="numeric" value={f.cashback.validade_dias} onChange={(e) => setCb({ validade_dias: e.target.value })} />
          </Campo>
        </div>
      </Secao>

      <Secao titulo="Cadastro pelo QR (CRM)" subtitulo="O cliente lê o QR no restaurante, se cadastra (vira cliente no CRM) e ganha desconto nos pedidos pelo cardápio digital.">
        <Alternar ativo={f.cadastro.ativo} onChange={(v) => setCad({ ativo: v })} rotulo="Cadastro com desconto ligado" />
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Desconto do cadastro (%)" dica="De 1 a 50.">
            <input className={inputCls} inputMode="numeric" value={f.cadastro.desconto_pct} onChange={(e) => setCad({ desconto_pct: e.target.value })} />
          </Campo>
          <Campo rotulo="Desconto vale por" dica="Dias depois do cadastro. 0 = sem prazo.">
            <input className={inputCls} inputMode="numeric" value={f.cadastro.validade_dias} onChange={(e) => setCad({ validade_dias: e.target.value })} />
          </Campo>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <Chip ativo={f.cadastro.aplica !== "sempre"} onClick={() => setCad({ aplica: "primeiro" })}>Só no primeiro pedido</Chip>
          <Chip ativo={f.cadastro.aplica === "sempre"} onClick={() => setCad({ aplica: "sempre" })}>Em todos os pedidos</Chip>
        </div>
        <div className="mt-3 space-y-1">
          <Alternar ativo={f.cadastro.pedir_aniversario} onChange={(v) => setCad({ pedir_aniversario: v })} rotulo="Pedir aniversário (opcional para o cliente)" />
          <Alternar ativo={f.cadastro.pedir_email} onChange={(v) => setCad({ pedir_email: v })} rotulo="Pedir e-mail (opcional para o cliente)" />
        </div>
        <p className="mt-2 text-xs text-hf-muted">O cliente aceita o uso dos dados (LGPD) para se cadastrar; receber novidades é uma escolha separada dele.</p>
        <div className="mt-4 flex flex-wrap items-center gap-4 rounded-2xl border border-hf-border p-3">
          <div ref={qr} className="rounded-xl bg-white p-2"><QRCodeCanvas value={linkCadastro} size={140} marginSize={1} /></div>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="break-all text-xs text-hf-text-2">{linkCadastro}</p>
            <div className="flex flex-wrap gap-2">
              <Botao variante="secundario" onClick={baixarQr}><Download size={16} /> Baixar QR</Botao>
              <Botao variante="secundario" onClick={imprimirQr}><Printer size={16} /> Imprimir cartaz</Botao>
              <a href={caminhoDoCadastro(unidadeId)} target="_blank" rel="noreferrer" className="inline-flex min-h-[44px] items-center rounded-xl px-3 text-sm font-bold text-hf-accent hover:bg-hf-accent/5">Abrir a página</a>
            </div>
          </div>
        </div>
      </Secao>

      <Aviso>
        Pontos de programas de fora (Livelo, Esfera, Dotz…) como pagamento dependem de contrato e credencial com o parceiro — está
        registrado como pendência. Nada aqui finge essa integração.
      </Aviso>
    </div>
  );
}
