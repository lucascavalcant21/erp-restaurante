"use client";

// Etapa "Orçamento": a proposta que o cliente recebe (PDF e WhatsApp).
// Organização do modelo do dono (05/11/2026): cabeçalho com logo e fotos, dados
// do evento, cardápio por parte com quantidade + item por categoria, serviços,
// total do orçamento e condições gerais. Visual Seldeestrela: branco e dourado.
// Regras em app/lib/evento-proposta.mjs; o texto das condições é o modelo da
// casa (config_sistema.params.proposta_eventos), editado aqui mesmo uma vez.
// Só preço: nunca custo, ficha ou margem.

import { useEffect, useState } from "react";
import { ChevronDown, Download, Loader2, Plus, Save, Send, Trash2 } from "lucide-react";
import { textoDoOrcamento, linkWhatsApp, incluidoNaProposta } from "../../../../../lib/evento-orcamento.mjs";
import { cardapioComQuantidades, fotosDoCardapio, valoresDaProposta, pagamentoDaProposta, normalizarModeloProposta, textoEmLinhas } from "../../../../../lib/evento-proposta.mjs";
import { fetchModeloProposta, salvarModeloProposta } from "../../../../../lib/parametros";
import { parseNumero } from "../../../../../lib/ficha-calculos.mjs";
import { fmtReais } from "../../../../../lib/valor-percentual.mjs";
import { Campo, Numero } from "./ui";

const OURO = "#C5A15A";
const OURO_ESCURO = "#7A5C1E";
const exato = { printColorAdjust: "exact", WebkitPrintColorAdjust: "exact" };
const fmtData = (iso) => (iso ? new Date(`${String(iso).slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR") : "");
const fmtQ = (n) => (n == null ? "" : Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 1 }));
const campoCls = "w-full rounded-xl border border-hf-border bg-hf-surface px-3 py-2 text-sm font-medium text-hf-text outline-none focus:border-hf-accent";

function Faixa({ children }) {
  return <h2 className="px-4 py-2 text-center text-lg font-semibold tracking-wide text-white" style={{ background: OURO, fontFamily: "Georgia, 'Times New Roman', serif", ...exato }}>{children}</h2>;
}
function TituloCondicao({ children }) {
  return <h3 className="mt-5 border px-3 py-1 text-center text-xs font-bold uppercase tracking-wider" style={{ borderColor: OURO, color: OURO_ESCURO }}>{children}</h3>;
}

// Editor do modelo da casa (vale para todas as propostas)
function EditorModelo({ modelo, setModelo, onSalvar, salvando, logoCardapio }) {
  const mudar = (fn) => setModelo((m) => { const n = structuredClone(m); fn(n); return n; });
  return (
    <details className="basis-full rounded-2xl border border-hf-border bg-hf-surface p-4">
      <summary className="flex cursor-pointer items-center gap-2 text-sm font-black text-hf-text"><ChevronDown size={16} /> Modelo da proposta (empresa, condições, pagamento) — vale para todos os eventos</summary>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Campo rotulo="Logo (endereço da imagem)" ajuda={logoCardapio && !modelo.logo_url ? "Em branco: usa o logo do Cardápio digital." : "Cole o link da imagem do logo."}>
          <input value={modelo.logo_url} onChange={(e) => mudar((m) => { m.logo_url = e.target.value; })} placeholder="https://…" className={campoCls} />
        </Campo>
        <Campo rotulo="Frase de boas-vindas"><input value={modelo.boas_vindas} onChange={(e) => mudar((m) => { m.boas_vindas = e.target.value; })} className={campoCls} /></Campo>
        <Campo rotulo="Razão social"><input value={modelo.empresa.razao_social} onChange={(e) => mudar((m) => { m.empresa.razao_social = e.target.value; })} placeholder="Seldeestrela …" className={campoCls} /></Campo>
        <Campo rotulo="CNPJ"><input value={modelo.empresa.cnpj} onChange={(e) => mudar((m) => { m.empresa.cnpj = e.target.value; })} placeholder="00.000.000/0000-00" className={campoCls} /></Campo>
        <Campo rotulo="Endereço"><input value={modelo.empresa.endereco} onChange={(e) => mudar((m) => { m.empresa.endereco = e.target.value; })} className={campoCls} /></Campo>
        <Campo rotulo="Representante"><input value={modelo.empresa.representante} onChange={(e) => mudar((m) => { m.empresa.representante = e.target.value; })} className={campoCls} /></Campo>
        <Campo rotulo="Assinatura: nome"><input value={modelo.assinatura.nome} onChange={(e) => mudar((m) => { m.assinatura.nome = e.target.value; })} className={campoCls} /></Campo>
        <Campo rotulo="Assinatura: telefone"><input value={modelo.assinatura.telefone} onChange={(e) => mudar((m) => { m.assinatura.telefone = e.target.value; })} className={campoCls} /></Campo>
        <Campo rotulo="Entrada (%)"><Numero valor={modelo.pagamento.entrada_pct} onChange={(v) => mudar((m) => { m.pagamento.entrada_pct = v; })} sufixo="%" /></Campo>
        <Campo rotulo="Restante até (dias antes do evento)"><Numero valor={modelo.pagamento.restante_dias} onChange={(v) => mudar((m) => { m.pagamento.restante_dias = v; })} sufixo="dias" /></Campo>
        <Campo rotulo="Parcelas no cartão"><Numero valor={modelo.pagamento.parcelas} onChange={(v) => mudar((m) => { m.pagamento.parcelas = v; })} sufixo="x" /></Campo>
        <Campo rotulo="Extras pagos até (dias depois)"><Numero valor={modelo.pagamento.extras_dias} onChange={(v) => mudar((m) => { m.pagamento.extras_dias = v; })} sufixo="dias" /></Campo>
      </div>
      <div className="mt-4 space-y-3">
        {modelo.secoes.map((s, k) => (
          <div key={s.id} className="rounded-xl border border-hf-border p-3">
            <div className="flex gap-2">
              <input value={s.titulo} onChange={(e) => mudar((m) => { m.secoes[k].titulo = e.target.value; })} aria-label="Título da condição" className={`${campoCls} font-bold`} />
              <button type="button" onClick={() => mudar((m) => { m.secoes.splice(k, 1); })} aria-label={`Remover ${s.titulo || "condição"}`} className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-hf-muted hover:text-hf-danger"><Trash2 size={16} /></button>
            </div>
            <textarea value={s.texto} onChange={(e) => mudar((m) => { m.secoes[k].texto = e.target.value; })} rows={3} placeholder="Uma regra por linha" aria-label={`Regras de ${s.titulo}`} className={`${campoCls} mt-2`} />
          </div>
        ))}
        <button type="button" onClick={() => mudar((m) => { m.secoes.push({ id: `s${Date.now()}`, titulo: "", texto: "" }); })} className="inline-flex items-center gap-1 text-sm font-bold text-hf-accent"><Plus size={15} /> Condição</button>
      </div>
      <button type="button" onClick={onSalvar} disabled={salvando} className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-hf-accent px-5 text-sm font-black text-hf-accent-fg disabled:opacity-50">{salvando ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar modelo</button>
    </details>
  );
}

export function EtapaProposta({ orc, setOrc, resumo: r, unidadeAtiva, casa, telefoneCasa = "", eventoId = "", criadoEm = null }) {
  const prop = orc.proposta || {};
  const c = orc.cliente || {};
  const mudarProp = (m) => setOrc((o) => ({ ...o, proposta: { ...(o.proposta || {}), ...m } }));
  const mudarCliente = (m) => setOrc((o) => ({ ...o, cliente: { ...o.cliente, ...m } }));
  const [modelo, setModelo] = useState(() => normalizarModeloProposta(null));
  const [logoCardapio, setLogoCardapio] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState("");

  useEffect(() => {
    if (!unidadeAtiva) return;
    let vivo = true;
    fetchModeloProposta(unidadeAtiva).then((res) => { if (!vivo) return; setModelo(normalizarModeloProposta(res.data)); setLogoCardapio(res.logoCardapio || ""); });
    return () => { vivo = false; };
  }, [unidadeAtiva]);

  async function salvarModelo() {
    setSalvando(true);
    const res = await salvarModeloProposta(unidadeAtiva, modelo);
    setSalvando(false);
    setAviso(res?.error ? `Não salvou: ${res.error}` : "Modelo salvo: vale para todas as propostas.");
    setTimeout(() => setAviso(""), 3500);
  }

  const partes = cardapioComQuantidades(orc, r);
  const fotos = fotosDoCardapio(r);
  const incluso = incluidoNaProposta(orc);
  const valores = valoresDaProposta(r, { soTotal: !!prop.so_total });
  const pag = pagamentoDaProposta(valores.total, modelo.pagamento);
  const logo = modelo.logo_url || logoCardapio;
  const validade = Math.round(parseNumero(prop.validade_dias));
  const enviar = () => window.open(linkWhatsApp(c.cliente_telefone, textoDoOrcamento(orc, r, { casa })), "_blank", "noopener");
  const info = [
    ["Nome", c.cliente_nome], ["Telefone", c.cliente_telefone], ["Evento", c.nome_evento],
    ["Data", fmtData(c.data_evento)], ["Horário", c.hora_inicio ? `${c.hora_inicio}${c.hora_fim ? ` às ${c.hora_fim}` : ""}` : ""],
    ["Local do evento", c.local_evento], ["Decorador", c.decorador], ["Número de pessoas", r.convidados ? `${r.convidados} pessoas${r.criancas ? ` (${r.criancas} crianças)` : ""}` : ""],
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2 print:hidden">
        <button type="button" onClick={() => window.print()} className="inline-flex h-11 items-center gap-2 rounded-full bg-hf-accent px-5 text-sm font-black text-hf-accent-fg"><Download size={16} /> Baixar PDF</button>
        <button type="button" onClick={enviar} className="inline-flex h-11 items-center gap-2 rounded-full bg-[#1fa855] px-5 text-sm font-bold text-white hover:bg-[#188f47]"><Send size={16} /> Enviar pelo WhatsApp</button>
        <label className="inline-flex h-11 items-center gap-2 rounded-full border border-hf-border bg-hf-surface px-4 text-sm font-bold text-hf-text">
          <input type="checkbox" checked={!!prop.so_total} onChange={(e) => mudarProp({ so_total: e.target.checked })} className="h-4 w-4 accent-[#C5A15A]" /> Mostrar só o total
        </label>
        <div className="grid basis-full gap-3 rounded-2xl border border-hf-border bg-hf-surface p-4 sm:grid-cols-4">
          <Campo rotulo="Validade"><Numero valor={prop.validade_dias} onChange={(v) => mudarProp({ validade_dias: v })} sufixo="dias" /></Campo>
          <Campo rotulo="Solicitado em"><input type="date" value={prop.data_solicitacao || String(criadoEm || "").slice(0, 10)} onChange={(e) => mudarProp({ data_solicitacao: e.target.value })} className={campoCls} /></Campo>
          <Campo rotulo="Decorador"><input value={c.decorador || ""} onChange={(e) => mudarCliente({ decorador: e.target.value })} placeholder="Opcional" className={campoCls} /></Campo>
          <Campo rotulo="Condições só deste evento"><input value={prop.condicoes || ""} onChange={(e) => mudarProp({ condicoes: e.target.value })} placeholder="Opcional" className={campoCls} /></Campo>
        </div>
        <EditorModelo modelo={modelo} setModelo={setModelo} onSalvar={salvarModelo} salvando={salvando} logoCardapio={logoCardapio} />
        {aviso && <p role="status" className="basis-full rounded-full bg-hf-elevated px-4 py-2 text-sm font-bold text-hf-text">{aviso}</p>}
        <p className="basis-full text-xs font-medium text-hf-muted">No PDF, escolha “Salvar como PDF” na janela de impressão. O WhatsApp abre com o texto pronto{c.cliente_telefone ? "" : " (sem número: escolha o contato)"}; quem envia é você.</p>
      </div>

      {/* A proposta (o que o cliente recebe) */}
      <article id="orcamento-cliente" className="mx-auto w-full max-w-[820px] bg-white text-[#252525] shadow-sm print:max-w-none print:shadow-none" style={exato}>
        <div className="px-6 pt-6 sm:px-10">
          {/* Cabeçalho */}
          <header className="relative flex items-center justify-center gap-4 overflow-hidden rounded-t-2xl border-b-4 px-4 py-6" style={{ borderColor: OURO, background: "#FBF8F1", ...exato }}>
            {fotos[0] && <img src={fotos[0]} alt="" className="hidden h-36 w-28 rounded-t-full object-cover sm:block" />}
            <div className="flex-1 text-center">
              {logo ? <img src={logo} alt={casa || "Logo"} className="mx-auto max-h-20 object-contain" /> : <p className="text-3xl font-bold" style={{ fontFamily: "Georgia, serif", color: OURO_ESCURO }}>{casa || "Seldeestrela"}</p>}
              <p className="mx-auto mt-3 w-fit border-y px-6 py-1 text-xl tracking-[0.3em]" style={{ borderColor: OURO, color: OURO_ESCURO, fontFamily: "Georgia, serif" }}>ORÇAMENTO</p>
            </div>
            {fotos[1] && <img src={fotos[1]} alt="" className="hidden h-36 w-28 rounded-t-full object-cover sm:block" />}
          </header>
          <div className="mt-3 text-right text-xs font-semibold" style={{ color: OURO_ESCURO }}>
            {(prop.data_solicitacao || criadoEm) && <p>Data de solicitação do orçamento: {fmtData(prop.data_solicitacao || criadoEm)}</p>}
            <p>Data de envio do orçamento: {new Date().toLocaleDateString("pt-BR")}</p>
            {validade > 0 && <p>Válido por {validade} dias</p>}
          </div>
          {modelo.boas_vindas && <p className="mt-4 text-center text-sm">{modelo.boas_vindas}</p>}

          {/* Informações do evento */}
          <section className="mt-6 break-inside-avoid">
            <h2 className="text-center text-2xl" style={{ fontFamily: "Georgia, serif", color: OURO_ESCURO }}>Informações sobre o evento</h2>
            <dl className="mx-auto mt-3 grid max-w-lg grid-cols-[150px_1fr] gap-x-4 gap-y-1 text-sm">
              {info.map(([rot, val]) => (
                <div key={rot} className="contents">
                  <dt className="text-right font-bold">{rot}:</dt>
                  <dd className="text-[#52525B]">{val || ""}</dd>
                </div>
              ))}
            </dl>
            {modelo.aviso_reserva && <p className="mt-2 text-center text-xs italic" style={{ color: OURO_ESCURO }}>*{modelo.aviso_reserva}</p>}
          </section>

          {/* Cardápio por parte: quantidade + item */}
          {partes.length === 0 && <p className="mt-6 text-center text-sm text-[#71717A]">O cardápio ainda não foi montado.</p>}
          {partes.map((p) => (
            <section key={p.secao} className="mt-6 break-inside-avoid overflow-hidden rounded-xl border" style={{ borderColor: OURO }}>
              <Faixa>{p.rotulo}</Faixa>
              <table className="w-full text-sm" style={{ background: "#FBF8F1", ...exato }}>
                <tbody>
                  {p.categorias.map((g) => (
                    <FragmentoCategoria key={g.categoria} g={g} unica={p.categorias.length === 1 && g.categoria === "Outros"} />
                  ))}
                </tbody>
              </table>
            </section>
          ))}

          {/* Serviços e itens inclusos */}
          {(incluso.equipe.length > 0 || incluso.servicos.length > 0) && (
            <section className="mt-4 break-inside-avoid overflow-hidden rounded-xl border" style={{ borderColor: OURO }}>
              <Faixa>Serviços inclusos</Faixa>
              <table className="w-full text-sm" style={{ background: "#FBF8F1", ...exato }}>
                <tbody>
                  {incluso.equipe.map((e) => { const [nome, q] = e.split(" × "); return <tr key={e}><td className="w-20 py-1 text-center tabular-nums">{q || 1}</td><td className="py-1 pr-3">{nome}</td></tr>; })}
                  {incluso.servicos.map((s) => <tr key={s}><td className="w-20 py-1 text-center">1</td><td className="py-1 pr-3">{s}</td></tr>)}
                </tbody>
              </table>
            </section>
          )}

          {/* Total */}
          <section className="mt-6 break-inside-avoid">
            {valores.linhas.length > 0 && (
              <table className="w-full text-sm">
                <tbody>
                  {valores.linhas.map((l) => <tr key={l.rotulo} className="border-b border-[#E5E7EB]"><td className="py-1.5">{l.rotulo}</td><td className="py-1.5 text-right tabular-nums">{fmtReais(l.valor)}</td></tr>)}
                </tbody>
              </table>
            )}
            <div className="mt-2 flex items-center justify-between rounded-xl px-5 py-3" style={{ background: "#F5EEDC", ...exato }}>
              <span className="text-xl tracking-wider" style={{ fontFamily: "Georgia, serif", color: OURO_ESCURO }}>TOTAL DO ORÇAMENTO</span>
              <span className="text-xl font-black tabular-nums" style={{ color: OURO_ESCURO }}>{valores.total != null ? fmtReais(valores.total) : "A definir"}</span>
            </div>
          </section>
        </div>

        {/* Condições gerais (página própria na impressão) */}
        <div className="px-6 pb-10 pt-8 sm:px-10">
          <Faixa>Condições gerais para realização do evento</Faixa>
          <TituloCondicao>Identificação do contratante</TituloCondicao>
          <div className="mt-2 space-y-2 text-sm">
            {[["Nome completo", c.cliente_nome], ["RG", ""], ["CPF", ""], ["Data de nascimento", ""], ["Profissão e empresa", ""], ["E-mail", ""]].map(([rot, val]) => (
              <p key={rot} className="flex gap-2"><span className="font-semibold">{rot}:</span><span className="flex-1 border-b border-dotted border-[#D1D5DB]">{val || ""}</span></p>
            ))}
          </div>
          {(modelo.empresa.razao_social || modelo.empresa.cnpj) && (
            <>
              <TituloCondicao>Identificação</TituloCondicao>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
                <li>CONTRATADA: {[modelo.empresa.razao_social, modelo.empresa.cnpj && `CNPJ ${modelo.empresa.cnpj}`, modelo.empresa.endereco, modelo.empresa.representante && `representada por ${modelo.empresa.representante}`].filter(Boolean).join(", ")}.</li>
                <li>CONTRATANTE: as informações constam no cabeçalho deste orçamento.</li>
                <li>As condições gerais deste orçamento são aceitas pelo contratante na confirmação do evento.</li>
              </ol>
            </>
          )}
          {modelo.secoes.filter((s) => textoEmLinhas(s.texto).length).map((s) => (
            <div key={s.id} className="break-inside-avoid">
              <TituloCondicao>{s.titulo}</TituloCondicao>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">{textoEmLinhas(s.texto).map((l, k) => <li key={k}>{l}</li>)}</ol>
            </div>
          ))}
          {prop.condicoes && (
            <div className="break-inside-avoid">
              <TituloCondicao>Condições deste evento</TituloCondicao>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">{textoEmLinhas(prop.condicoes).map((l, k) => <li key={k}>{l}</li>)}</ol>
            </div>
          )}
          <div className="break-inside-avoid">
            <TituloCondicao>Pagamento</TituloCondicao>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
              <li>Este orçamento não garante a reserva da data: a reserva é feita com a confirmação do evento e o pagamento da entrada.</li>
              {validade > 0 && <li>Orçamento válido por {validade} dias; depois disso os valores podem mudar.</li>}
              <li>Prazo de pagamento:</li>
            </ol>
            <table className="mx-auto mt-2 w-full max-w-md border text-sm" style={{ borderColor: "#D1D5DB" }}>
              <tbody>
                <tr className="border-b" style={{ borderColor: "#D1D5DB" }}><td className="border-r px-3 py-1.5 text-center" style={{ borderColor: "#D1D5DB" }}>{fmtQ(pag.entradaPct)}%{pag.entrada != null ? ` · ${fmtReais(pag.entrada)}` : ""}</td><td className="px-3 py-1.5 text-center">Entrada</td></tr>
                <tr><td className="border-r px-3 py-1.5 text-center" style={{ borderColor: "#D1D5DB" }}>{fmtQ(pag.restantePct)}%{pag.restante != null ? ` · ${fmtReais(pag.restante)}` : ""}</td><td className="px-3 py-1.5 text-center">{pag.restanteDias ? `Até ${pag.restanteDias} dias antes do evento` : "Até o dia do evento"}</td></tr>
              </tbody>
            </table>
            <ol start={4} className="mt-2 list-decimal space-y-1 pl-5 text-sm">
              {pag.extrasDias > 0 && <li>Extras devem ser pagos até {pag.extrasDias} dias depois do evento.</li>}
              {pag.parcelas > 1 && <li>Parcelamos em até {pag.parcelas}x no cartão.</li>}
            </ol>
          </div>
          {c.observacoes && (
            <div className="break-inside-avoid">
              <TituloCondicao>Observações do evento</TituloCondicao>
              <p className="mt-2 whitespace-pre-line text-sm">{c.observacoes}</p>
            </div>
          )}

          {/* Assinatura e aceite */}
          <div className="mt-8 break-inside-avoid">
            <div className="text-right text-sm">
              <p className="font-bold" style={{ color: OURO_ESCURO }}>Atenciosamente</p>
              {(modelo.assinatura.nome || casa) && <p className="text-[#52525B]">{modelo.assinatura.nome || casa}</p>}
              {(modelo.assinatura.telefone || telefoneCasa) && <p className="text-[#52525B]">{modelo.assinatura.telefone || telefoneCasa}</p>}
            </div>
            <div className="mt-12 grid grid-cols-2 gap-10 text-center text-xs text-[#52525B]">
              <div className="border-t border-[#A1A1AA] pt-1.5">{modelo.empresa.razao_social || casa || "Contratada"}</div>
              <div className="border-t border-[#A1A1AA] pt-1.5">De acordo: {c.cliente_nome || "Contratante"}</div>
            </div>
          </div>
        </div>
      </article>
    </div>
  );
}

function FragmentoCategoria({ g, unica }) {
  return (
    <>
      {!unica && <tr><td /><td className="pt-2 font-bold">{g.categoria}</td></tr>}
      {g.itens.map((i, k) => (
        <tr key={k} className="align-top">
          <td className="w-20 py-1 text-center tabular-nums">{i.quantidade != null ? `${fmtQ(i.quantidade)}${i.detalhe ? ` ${i.detalhe}` : ""}` : ""}</td>
          <td className="py-1 pr-3">{i.nome}{i.descricao ? <span className="block text-xs text-[#52525B]">{i.descricao}</span> : null}</td>
        </tr>
      ))}
    </>
  );
}
