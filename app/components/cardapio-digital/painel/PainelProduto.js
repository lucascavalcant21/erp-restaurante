"use client";

import { useRef, useState } from "react";
import { DIAS_SEMANA, TIPOS_GRUPO, formatarPreco, normalizarGrupo, regraDoGrupo } from "../../../lib/cardapio-digital.mjs";
import { mover } from "../../../lib/cardapio-painel.mjs";
import { Icone } from "../ui";
import MenuPainel from "./MenuPainel";
import s from "./painel.module.css";

// Painel → Editar produto (protótipo PainelProduto). Só desenho e gestos: a
// página guarda o formulário (`form`) e os grupos, e grava.
//   - Nome, descrição e tempo de preparo são da FICHA técnica (a cozinha usa a mesma).
//   - Preço é o do produto de venda (o mesmo do caixa): muda em Produtos de venda.
//   - Alergênicos e pimenta vêm da ficha (só leitura): o cliente vê o que a ficha diz.
//   - Grupos de complementos servem a vários pratos: mudar aqui muda em todos.

const ALERGENOS_COMUNS = ["Glúten", "Lactose", "Ovo", "Crustáceos", "Peixe", "Amendoim", "Castanhas", "Soja"];
const ESTACOES = { cozinha: "Cozinha", bar: "Bar" };
const CANAIS_EQUIPE = ["App do garçom", "PDV / caixa"];
const ROTULOS_CANAL = { tablet: "Tablet", qr: "QR da mesa", delivery: "Delivery" };
const STATUS_CLASSE = { ok: s.statusOk, parcial: s.statusParcial, falta: s.statusFalta };
const normal = (v) => String(v || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function EditorGrupo({ inicial, onSalvar, onCancelar }) {
  const [g, setG] = useState(() => inicial || { nome: "", tipo: "adicional", min: 0, max: 1, opcoes: [{ nome: "", preco: 0 }] });
  const muda = (campo, v) => setG((x) => ({ ...x, [campo]: v }));
  const mudaOpcao = (i, campo, v) => setG((x) => ({ ...x, opcoes: x.opcoes.map((o, k) => (k === i ? { ...o, [campo]: v } : o)) }));
  const pronto = normalizarGrupo({ ...g, opcoes: g.opcoes.map((o) => ({ ...o, preco: String(o.preco).replace(",", ".") })) });
  return (
    <div className={s.editorGrupo}>
      <label className={`${s.campo} ${s.inteira}`}>Nome do grupo
        <input className={s.entrada} value={g.nome} onChange={(e) => muda("nome", e.target.value)} placeholder="Ex.: Ponto da carne" />
      </label>
      <label className={s.campo} style={{ gridColumn: "span 2" }}>Tipo
        <select className={s.entrada} value={g.tipo} onChange={(e) => muda("tipo", e.target.value)}>
          {TIPOS_GRUPO.map((t) => <option key={t.id} value={t.id}>{t.rotulo}</option>)}
        </select>
      </label>
      <label className={s.campo}>Mínimo
        <input className={s.entrada} type="number" min={0} value={g.min} disabled={g.tipo === "retirar"} onChange={(e) => muda("min", e.target.value)} />
      </label>
      <label className={s.campo}>Máximo
        <input className={s.entrada} type="number" min={1} value={g.max} onChange={(e) => muda("max", e.target.value)} />
      </label>
      {g.opcoes.map((o, i) => (
        <div key={i} className={s.opcaoEditar}>
          <input className={s.entrada} value={o.nome} placeholder={`Opção ${i + 1}`} aria-label={`Opção ${i + 1}`} onChange={(e) => mudaOpcao(i, "nome", e.target.value)} />
          <input className={s.entrada} value={g.tipo === "retirar" ? "grátis" : o.preco} disabled={g.tipo === "retirar"} inputMode="decimal" aria-label={`Preço da opção ${i + 1}`}
            onChange={(e) => mudaOpcao(i, "preco", e.target.value)} />
          <button type="button" className={s.grupoAcao} onClick={() => setG((x) => ({ ...x, opcoes: x.opcoes.filter((_, k) => k !== i) }))}>Tirar</button>
        </div>
      ))}
      <div className={s.inteira} style={{ display: "flex", gap: 8, justifyContent: "space-between", flexWrap: "wrap" }}>
        <button type="button" className={s.botaoP} onClick={() => setG((x) => ({ ...x, opcoes: [...x.opcoes, { nome: "", preco: 0 }] }))}>+ Opção</button>
        <span style={{ display: "flex", gap: 8 }}>
          <button type="button" className={s.botaoP} onClick={onCancelar}>Cancelar</button>
          <button type="button" className={s.botaoEscuro} disabled={!pronto.nome || !pronto.opcoes.length}
            onClick={() => onSalvar({ ...pronto, id: inicial?.id || pronto.id })}>
            {inicial ? "Salvar grupo" : "Criar grupo"}
          </button>
        </span>
      </div>
      <span className={`${s.campoNota} ${s.inteira}`}>{regraDoGrupo(pronto)} · mudar um grupo muda em todos os pratos que usam.</span>
    </div>
  );
}

export default function PainelProduto({
  nomeLoja, itensMenu, produto, temFicha, form, setForm, categorias = [], estacao, alergenicos, podeConter, grupos = [], setGrupos,
  usos = {}, traducoes = [], onSalvar, salvando, erros = [], mensagem, onEnviarArquivo, links = {},
}) {
  const [enviando, setEnviando] = useState(false);
  const [erroMidia, setErroMidia] = useState("");
  const [editando, setEditando] = useState(null); // id do grupo, "novo" ou null
  const [escolherGrupo, setEscolherGrupo] = useState(false);
  const [arrasteMidia, setArrasteMidia] = useState(null);
  const arquivo = useRef(null);
  const muda = (campo, v) => setForm((f) => ({ ...f, [campo]: v }));
  const capa = form.midias.find((m) => m.tipo === "foto")?.url || "";
  const ligados = form.grupos.map((id) => grupos.find((g) => g.id === id)).filter(Boolean);
  const outros = grupos.filter((g) => !form.grupos.includes(g.id));
  const marcados = new Set((alergenicos || []).map(normal));
  const extras = (alergenicos || []).filter((a) => !ALERGENOS_COMUNS.some((c) => normal(c) === normal(a)));
  const faltando = [
    !capa ? "foto do prato" : "",
  ].filter(Boolean);
  const semTraducao = traducoes.filter((t) => t.status !== "ok");
  if (semTraducao.length === 1) faltando.push(`tradução em ${semTraducao[0].nome}`);
  else if (semTraducao.length > 1) faltando.push(`tradução em ${semTraducao.length} idiomas`);

  async function enviar(e) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    setErroMidia("");
    if (f.type.startsWith("video/")) {
      if (form.midias.some((m) => m.tipo === "video")) { setErroMidia("Já tem um vídeo. Tire o atual para trocar."); return; }
      const dur = await new Promise((ok) => {
        const v = document.createElement("video");
        v.preload = "metadata";
        v.onloadedmetadata = () => { ok(v.duration); URL.revokeObjectURL(v.src); };
        v.onerror = () => ok(NaN);
        v.src = URL.createObjectURL(f);
      });
      if (!(dur <= 12)) { setErroMidia("Vídeo de até 10 segundos (curto carrega rápido no tablet)."); return; }
    } else if (form.midias.filter((m) => m.tipo === "foto").length >= 3) {
      setErroMidia("Até 3 fotos. Tire uma para colocar outra."); return;
    }
    setEnviando(true);
    const r = await onEnviarArquivo(f);
    setEnviando(false);
    if (r.erro) { setErroMidia(r.erro); return; }
    muda("midias", [...form.midias, { tipo: f.type.startsWith("video/") ? "video" : "foto", url: r.url }]);
  }

  const salvarGrupo = (g) => {
    setGrupos((lista) => (lista.some((x) => x.id === g.id) ? lista.map((x) => (x.id === g.id ? g : x)) : [...lista, g]));
    if (!form.grupos.includes(g.id)) muda("grupos", [...form.grupos, g.id]);
    setEditando(null);
  };
  const novoId = () => {
    const base = normal(form.nome).replace(/[^a-z0-9]+/g, "-").slice(0, 20) || "grupo";
    let id = `g-${base}`;
    for (let n = 2; grupos.some((g) => g.id === id); n++) id = `g-${base}-${n}`;
    return id;
  };

  return (
    <div className={s.raiz}>
      <MenuPainel atual="cardapio" nomeLoja={nomeLoja} itens={itensMenu} />
      <main className={s.conteudo}>
        <div className={s.topo}>
          <a href={links.voltar || "#"} className={s.voltar}>← Cardápio</a>
          <h1 className={s.titulo}>{form.nome || produto.nome_produto}</h1>
          <a href={links.voltar || "#"} className={s.cancelar}>Cancelar</a>
          <button type="button" className={s.salvar} onClick={onSalvar} disabled={salvando || enviando}>{salvando ? "Salvando…" : "Salvar"}</button>
        </div>
        {erros.length ? <div role="alert" className={s.erro}>{erros.join(" ")}</div> : null}
        {mensagem ? <div role="status" className={s.ok}>{mensagem}</div> : null}

        <div className={s.colunas}>
          <div className={s.formulario}>
            <section aria-labelledby="s-fotos" className={s.bloco}>
              <div className={`${s.blocoTopo} ${s.blocoTopoBase}`}>
                <h2 id="s-fotos" className={s.blocoTitulo}>Fotos e vídeo</h2>
                <span className={s.dica}>A primeira é a capa · arraste para ordenar · vídeo até 10 s, sem som</span>
              </div>
              <div className={s.midias}>
                {form.midias.map((m, i) => {
                  const ehCapa = m.tipo === "foto" && m.url === capa;
                  return (
                    <div key={m.url} draggable
                      onDragStart={() => setArrasteMidia(i)} onDragEnd={() => setArrasteMidia(null)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => { if (arrasteMidia != null && arrasteMidia !== i) muda("midias", mover(form.midias, arrasteMidia, i)); setArrasteMidia(null); }}
                      className={`${s.midia} ${ehCapa ? s.midiaCapa : ""} ${arrasteMidia === i ? s.midiaArrastando : ""}`}>
                      {m.tipo === "video"
                        ? <video className={s.midiaConteudo} src={m.url} muted playsInline preload="metadata" />
                        /* eslint-disable-next-line @next/next/no-img-element */
                        : <img className={s.midiaConteudo} src={m.url} alt="" />}
                      {m.tipo === "video" ? <Icone nome="play" tamanho={28} /> : null}
                      {ehCapa ? <span className={`${s.midiaRotulo} ${s.midiaRotuloCapa}`}>Capa</span> : null}
                      {m.tipo === "video" ? <span className={s.midiaRotulo}>Vídeo</span> : null}
                      <button type="button" className={s.midiaTirar} aria-label={`Tirar ${m.tipo === "video" ? "vídeo" : "foto"}`}
                        onClick={() => muda("midias", form.midias.filter((_, k) => k !== i))}>×</button>
                    </div>
                  );
                })}
                {form.midias.length < 4 ? (
                  <button type="button" className={s.adicionarMidia} onClick={() => arquivo.current?.click()} disabled={enviando}>
                    <Icone nome="ampliar" tamanho={22} />
                    {enviando ? "Enviando…" : "Adicionar foto ou vídeo"}
                  </button>
                ) : null}
                <input ref={arquivo} type="file" hidden accept="image/jpeg,image/png,image/webp,video/mp4,video/webm" onChange={enviar} />
              </div>
              {erroMidia ? <span role="alert" className={s.campoNota} style={{ color: "var(--cd-pimenta-texto)", fontWeight: 600 }}>{erroMidia}</span> : null}
            </section>

            <section aria-labelledby="s-info" className={`${s.bloco} ${s.blocoGrade}`}>
              <h2 id="s-info" className={`${s.blocoTitulo} ${s.inteira}`}>Informações</h2>
              <label className={`${s.campo} ${s.inteira}`}>Nome
                <input className={s.entrada} value={form.nome} disabled={!temFicha} maxLength={80} onChange={(e) => muda("nome", e.target.value)} />
                {!temFicha ? <span className={s.campoNota}>Produto sem ficha técnica: o nome é o do <a href={links.produtosDeVenda}>produto de venda</a>.</span> : null}
              </label>
              <label className={`${s.campo} ${s.inteira}`}>Descrição
                <textarea className={s.entrada} rows={3} maxLength={280} value={form.descricao} onChange={(e) => muda("descricao", e.target.value)} />
              </label>
              <label className={s.campo}>Categoria
                <select className={s.entrada} value={form.categoria_id} onChange={(e) => muda("categoria_id", e.target.value)}>
                  {categorias.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </label>
              <label className={s.campo}>Preço
                <input className={s.entrada} value={formatarPreco(produto.preco_venda)} disabled />
                <span className={s.campoNota}>É o preço do caixa. Muda em <a href={links.produtosDeVenda}>Produtos de venda</a>.</span>
              </label>
              <label className={s.campo}>Estação no KDS
                <select className={s.entrada} value={estacao} disabled><option value={estacao}>{ESTACOES[estacao] || "Cozinha"}</option></select>
                <span className={s.campoNota}>Pelo departamento da ficha. As estações chegam com o KDS novo.</span>
              </label>
              <label className={s.campo}>Tempo de preparo (min)
                <input className={s.entrada} inputMode="numeric" value={form.tempo} disabled={!temFicha} placeholder={temFicha ? "Sem tempo na ficha" : ""}
                  onChange={(e) => muda("tempo", e.target.value.replace(/\D/g, "").slice(0, 3))} />
              </label>
            </section>

            <section aria-labelledby="s-alerg" className={s.bloco}>
              <h2 id="s-alerg" className={s.blocoTitulo}>Alergênicos, pimenta e etiquetas</h2>
              {alergenicos == null ? (
                <span className={s.campoNota}>Não foi possível ler os alergênicos da ficha agora.</span>
              ) : (
                <>
                  <div className={s.chips} role="list" aria-label="Alergênicos da ficha técnica">
                    {[...ALERGENOS_COMUNS, ...extras].map((a) => (
                      <span key={a} role="listitem" className={`${s.chipFicha} ${marcados.has(normal(a)) ? s.chipFichaMarcado : ""}`}>
                        {marcados.has(normal(a)) ? `Contém ${a.toLowerCase()}` : a}
                      </span>
                    ))}
                  </div>
                  <span className={s.campoNota}>
                    {temFicha
                      ? marcados.size ? "Vêm da ficha técnica." : "A ficha ainda não tem alergênicos marcados: sem esse dado o cliente não vê selo nenhum."
                      : "Sem ficha técnica, não há como saber os alergênicos."}
                    {podeConter ? ` Pode conter traços de: ${podeConter}.` : ""}
                    {temFicha && links.ficha ? <> <a href={links.ficha}>Abrir a ficha</a></> : null}
                  </span>
                </>
              )}
              <div className={s.linhaPimenta}>
                <span>Pimenta</span>
                <div role="radiogroup" aria-label="Nível de pimenta" aria-disabled="true" className={s.niveis}>
                  {["Sem", "Leve", "Média", "Forte"].map((n) => <button key={n} type="button" role="radio" aria-checked="false" disabled className={s.nivel}>{n}</button>)}
                </div>
                <span className={s.campoNota}>Sem dado: o nível vem dos ingredientes da ficha (marcação nos insumos, próxima etapa).</span>
              </div>
            </section>

            <section aria-labelledby="s-comp" className={s.bloco}>
              <div className={s.blocoTopo}>
                <h2 id="s-comp" className={s.blocoTitulo}>Adicionais e complementos</h2>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" className={s.botaoP} onClick={() => setEscolherGrupo((v) => !v)} disabled={!outros.length}>Usar grupo existente</button>
                  <button type="button" className={s.botaoEscuro} onClick={() => setEditando("novo")}>+ Novo grupo</button>
                </div>
              </div>
              {escolherGrupo && outros.length ? (
                <label className={s.campo}>Escolha o grupo
                  <select className={s.entrada} defaultValue="" onChange={(e) => { if (e.target.value) { muda("grupos", [...form.grupos, e.target.value]); setEscolherGrupo(false); } }}>
                    <option value="" disabled>Grupos já criados</option>
                    {outros.map((g) => <option key={g.id} value={g.id}>{g.nome} · {regraDoGrupo(g)}</option>)}
                  </select>
                </label>
              ) : null}
              {editando === "novo" ? <EditorGrupo onCancelar={() => setEditando(null)} onSalvar={(g) => salvarGrupo({ ...g, id: novoId() })} /> : null}
              {!ligados.length && editando !== "novo" ? <span className={s.campoNota}>Sem adicionais: o cliente pede o prato como está, com observação.</span> : null}
              {ligados.map((g, i) => (editando === g.id ? (
                <EditorGrupo key={g.id} inicial={g} onCancelar={() => setEditando(null)} onSalvar={salvarGrupo} />
              ) : (
                <div key={g.id} className={s.grupo}>
                  <div className={s.grupoTopo}>
                    <span aria-hidden="true" className={s.alca}>⋮⋮</span>
                    <span className={s.grupoNome}>{g.nome}</span>
                    <span className={`${s.grupoRegra} ${g.min > 0 ? s.grupoRegraObrig : ""}`}>{regraDoGrupo(g)}</span>
                    <span className={s.dica}>usado em {Math.max(usos[g.id] || 0, 1)} {Math.max(usos[g.id] || 0, 1) === 1 ? "produto" : "produtos"}</span>
                    <button type="button" className={s.grupoAcao} onClick={() => setEditando(g.id)}>Editar</button>
                    {i > 0 ? <button type="button" className={s.grupoAcao} aria-label={`Subir ${g.nome}`} onClick={() => muda("grupos", mover(form.grupos, i, i - 1))}>↑</button> : null}
                    <button type="button" className={s.grupoAcao} onClick={() => muda("grupos", form.grupos.filter((x) => x !== g.id))}>Tirar deste prato</button>
                  </div>
                  {g.opcoes.map((o) => (
                    <div key={o.id} className={s.opcao}>
                      <span className={s.opcaoNome}>{o.nome}</span>
                      <span className={s.opcaoPreco}>{o.preco > 0 ? `+ ${formatarPreco(o.preco)}` : "grátis"}</span>
                      <label className={s.marcarP}>
                        <input type="checkbox" checked={!!o.esgotado}
                          onChange={(e) => setGrupos((lista) => lista.map((x) => (x.id !== g.id ? x : { ...x, opcoes: x.opcoes.map((y) => (y.id === o.id ? { ...y, esgotado: e.target.checked } : y)) })))} />
                        Esgotado
                      </label>
                    </div>
                  ))}
                </div>
              )))}
            </section>

            <section aria-labelledby="s-canais" className={s.bloco}>
              <h2 id="s-canais" className={s.blocoTitulo}>Onde aparece e quando</h2>
              <div className={s.linhaMarcar}>
                {Object.keys(form.canais).map((c) => (
                  <label key={c} className={s.marcarM}>
                    <input type="checkbox" checked={form.canais[c]} onChange={(e) => muda("canais", { ...form.canais, [c]: e.target.checked })} />
                    {ROTULOS_CANAL[c]}
                  </label>
                ))}
                {CANAIS_EQUIPE.map((c) => (
                  <label key={c} className={`${s.marcarM} ${s.marcarDesligado}`} title="A equipe vê todos os produtos ativos">
                    <input type="checkbox" checked readOnly disabled />{c}
                  </label>
                ))}
              </div>
              <div className={s.linhaMarcar}>
                <label className={s.marcarM}>
                  <input type="radio" name="disp" checked={form.horario.modo === "sempre"} onChange={() => muda("horario", { ...form.horario, modo: "sempre" })} />
                  Sempre que a loja estiver aberta
                </label>
                <label className={s.marcarM}>
                  <input type="radio" name="disp" checked={form.horario.modo === "horario"} onChange={() => muda("horario", { ...form.horario, modo: "horario" })} />
                  Só em dias e horários
                </label>
              </div>
              {form.horario.modo === "horario" ? (
                <div className={s.dias}>
                  {DIAS_SEMANA.map((d, i) => {
                    const sel = form.horario.dias_semana.includes(i);
                    return (
                      <button key={d} type="button" aria-pressed={sel} className={`${s.dia} ${sel ? s.diaSel : ""}`}
                        onClick={() => muda("horario", { ...form.horario, dias_semana: sel ? form.horario.dias_semana.filter((x) => x !== i) : [...form.horario.dias_semana, i].sort() })}>
                        {d}
                      </button>
                    );
                  })}
                  <input type="time" className={`${s.entrada} ${s.hora}`} aria-label="Início" value={form.horario.hora_inicio} onChange={(e) => muda("horario", { ...form.horario, hora_inicio: e.target.value })} />
                  até
                  <input type="time" className={`${s.entrada} ${s.hora}`} aria-label="Fim" value={form.horario.hora_fim} onChange={(e) => muda("horario", { ...form.horario, hora_fim: e.target.value })} />
                </div>
              ) : null}
              <label className={s.esgotadoCaixa}>
                <input type="checkbox" checked={form.esgotado} onChange={(e) => muda("esgotado", e.target.checked)} />
                Esgotado hoje: tirar de todos os canais até amanhã
              </label>
            </section>

            <section aria-labelledby="s-trad" className={s.bloco}>
              <div className={s.blocoTopo}>
                <h2 id="s-trad" className={s.blocoTitulo}>Traduções</h2>
                <a href={links.idiomas || "#"} className={s.botaoP} style={{ display: "inline-flex", alignItems: "center", textDecoration: "none" }}>Traduzir no editor de idiomas</a>
              </div>
              {traducoes.length ? (
                <div className={s.idiomas}>
                  {traducoes.map((t) => (
                    <a key={t.idioma} href={links.idiomas || "#"} className={s.idioma}>
                      <span className={s.idiomaNome}>{t.nome}</span>
                      <span className={`${s.idiomaStatus} ${STATUS_CLASSE[t.status]}`}>{t.rotulo}</span>
                    </a>
                  ))}
                </div>
              ) : <span className={s.campoNota}>Nenhum outro idioma ligado no cardápio.</span>}
            </section>
          </div>

          <aside aria-label="Prévia" className={s.previa}>
            <span className={s.previaRotulo}>PRÉVIA · como o cliente vê</span>
            <div className={s.previaCaixa}>
              <span className={s.previaAparelho}>Tablet</span>
              <div className={s.previaTablet}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {capa ? <img className={s.previaFotoT} src={capa} alt="" /> : <div className={s.previaFotoT} />}
                <div className={s.previaTextos}>
                  <span className={s.previaNome}>{form.nome || produto.nome_produto}</span>
                  {form.descricao ? <span className={s.previaDesc}>{form.descricao}</span> : null}
                  <span className={s.previaPreco}>{formatarPreco(produto.preco_venda)}</span>
                </div>
              </div>
            </div>
            <div className={s.previaCaixa}>
              <span className={s.previaAparelho}>Delivery (celular)</span>
              <div className={s.previaCelular}>
                <div className={s.previaCelularTextos}>
                  <span className={s.previaCelularNome}>{form.nome || produto.nome_produto}</span>
                  {form.descricao ? <span className={s.previaDesc}>{form.descricao}</span> : null}
                  <span className={s.previaCelularPreco}>{ligados.some((g) => g.min > 0 && g.opcoes.some((o) => o.preco > 0)) ? "A partir de " : ""}{formatarPreco(produto.preco_venda)}</span>
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {capa ? <img className={s.previaFotoC} src={capa} alt="" /> : <div className={s.previaFotoC} />}
              </div>
            </div>
            {faltando.length ? <div className={s.faltando}>Faltando: {faltando.join(", ")}.</div> : null}
          </aside>
        </div>
      </main>
    </div>
  );
}
