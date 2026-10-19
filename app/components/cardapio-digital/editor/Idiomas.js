"use client";

// Idiomas do cardápio: quais aparecem no botão de idioma do cliente e as
// traduções do que é do dono (seções, pratos, promoções, abertura, textos).
// O Héfisto não traduz sozinho: o que ficar sem tradução aparece no original,
// em português — nunca uma tradução inventada. Os botões, avisos e frases do
// atendimento já vêm prontos em cada idioma.

import { useMemo, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { camposParaTraduzir, comTraducao, lerTraducao, progressoDaTraducao } from "../../../lib/cardapio-digital.mjs";
import { IDIOMAS, TEXTOS_PADRAO, infoIdioma } from "../../../lib/cardapio-idiomas.mjs";
import { Botao, Campo, Chip, Secao, inputCls } from "./ui";

const EM_PORTUGUES = { pt: "português", en: "inglês", es: "espanhol", fr: "francês", it: "italiano", zh: "chinês (mandarim, simplificado)", ja: "japonês", ko: "coreano" };
const GRUPOS = [
  { id: "textos", rotulo: "Apresentação e rodapé" },
  { id: "categorias", rotulo: "Seções" },
  { id: "produtos", rotulo: "Pratos e drinks" },
  { id: "promocoes", rotulo: "Promoções" },
  { id: "banner", rotulo: "Abertura (banner)" },
];
const ROTULO_CAMPO = { nome: "Nome", descricao: "Descrição", harmoniza: "Combina com", titulo: "Título", texto: "Texto", apresentacao: "Apresentação", rodape: "Rodapé" };
const FRASES = [
  { k: "boas_vindas", rotulo: "Boas-vindas" },
  { k: "pedir_nome", rotulo: "Pedido do nome" },
  { k: "sugestao_bebida", rotulo: "Sugestão de bebida" },
  { k: "sugestao_sobremesa", rotulo: "Sugestão de sobremesa" },
  { k: "pedido_enviado", rotulo: "Pedido enviado" },
];
const POR_PAGINA = 30;

function Barra({ feitos, total }) {
  const pct = total ? Math.round((feitos / total) * 100) : 100;
  return (
    <span className="flex items-center gap-2">
      <span className="h-2 w-24 overflow-hidden rounded-full bg-hf-elevated" aria-hidden="true">
        <span className="block h-full rounded-full bg-hf-accent" style={{ width: `${pct}%` }} />
      </span>
      <span className="text-xs font-semibold text-hf-text-2">{feitos} de {total}</span>
    </span>
  );
}

function CampoTraducao({ item, valor, lang, onChange }) {
  const longo = item.max > 120;
  const props = { className: `${inputCls} ${longo ? "min-h-[72px] py-2" : ""}`, value: valor, maxLength: item.max, lang, placeholder: item.original, onChange: (e) => onChange(e.target.value) };
  return (
    <Campo rotulo={ROTULO_CAMPO[item.campo] || item.campo}>
      <span className="mb-1 block text-xs text-hf-muted" lang="pt-BR">Original: {item.original}</span>
      {longo ? <textarea {...props} /> : <input {...props} />}
    </Campo>
  );
}

export default function Idiomas({ config, mudar, produtos, categorias, idiomaPrevia, setIdiomaPrevia }) {
  const oferecidos = config.idiomas;
  const outros = oferecidos.filter((i) => i !== "pt");
  const [escolhido, setEscolhido] = useState(idiomaPrevia);
  // Idioma desmarcado lá em cima: a tradução passa para o próximo marcado.
  const idioma = outros.includes(escolhido) ? escolhido : outros[0] || "";
  const [aberto, setAberto] = useState("textos");
  const [busca, setBusca] = useState("");
  const [soFaltando, setSoFaltando] = useState(false);
  const [pagina, setPagina] = useState(1);

  const campos = useMemo(() => camposParaTraduzir({ config, produtos, categorias }), [config, produtos, categorias]);
  const prog = idioma ? progressoDaTraducao(campos, config.traducoes, idioma) : null;
  const info = infoIdioma(idioma);

  const alternarIdioma = (id) => {
    if (id === "pt") return;
    mudar((c) => {
      const lista = c.idiomas.includes(id) ? c.idiomas.filter((x) => x !== id) : [...c.idiomas, id];
      return { ...c, idiomas: IDIOMAS.map((i) => i.id).filter((x) => x === "pt" || lista.includes(x)) };
    });
  };
  const escolher = (id) => { setEscolhido(id); setPagina(1); setIdiomaPrevia?.(id); };
  const trocar = (item, valor) => mudar((c) => comTraducao(c, idioma, item, valor));

  // Pratos agrupados (nome, descrição, combina com) com busca e "só os que faltam".
  const pratos = useMemo(() => {
    const porId = new Map();
    for (const c of campos) if (c.grupo === "produtos") (porId.get(c.id) || porId.set(c.id, []).get(c.id)).push(c);
    const termo = busca.trim().toLowerCase();
    return [...porId.entries()]
      .filter(([, l]) => !termo || l.some((c) => c.original.toLowerCase().includes(termo)))
      .filter(([, l]) => !soFaltando || l.some((c) => !String(lerTraducao(config.traducoes, idioma, c)).trim()));
  }, [campos, busca, soFaltando, config.traducoes, idioma]);

  const porGrupo = (g) => campos.filter((c) => c.grupo === g);
  const conjuntos = (g) => {
    const m = new Map();
    for (const c of porGrupo(g)) (m.get(c.id) || m.set(c.id, []).get(c.id)).push(c);
    return [...m.entries()];
  };

  return (
    <div className="space-y-4">
      <Secao titulo="Idiomas no cardápio" subtitulo="O cliente toca no botão de idioma e escolhe um destes. O cardápio já abre no idioma do celular dele, quando é um dos marcados.">
        <div className="flex flex-wrap gap-2">
          {IDIOMAS.map((i) => (
            <Chip key={i.id} ativo={oferecidos.includes(i.id)} onClick={() => alternarIdioma(i.id)} disabled={i.id === "pt"} title={i.id === "pt" ? "O português fica sempre" : undefined}>
              {oferecidos.includes(i.id) ? <Check size={14} /> : null}
              <span lang={i.lang}>{i.nome}</span>
              {i.id !== "pt" ? <span className="text-xs font-normal text-hf-muted">({EM_PORTUGUES[i.id]})</span> : null}
            </Chip>
          ))}
        </div>
        <p className="mt-3 text-xs text-hf-muted">
          Botões, avisos, selos, alergênicos, dias e horários das promoções e as respostas da conversa já vêm traduzidos.
          O que é seu (nomes, descrições, promoções) aparece em português até você traduzir aqui; o nome original do prato
          fica embaixo do traduzido, para a equipe reconhecer quando o cliente apontar.
        </p>
      </Secao>

      {!outros.length ? null : (
        <Secao titulo="Traduções" subtitulo="Escreva como você quer que o cliente leia. Vazio = aparece o original."
          direita={prog ? <Barra feitos={prog.feitos} total={prog.total} /> : null}>
          <div role="group" aria-label="Idioma da tradução" className="mb-4 flex flex-wrap gap-2">
            {outros.map((id) => {
              const p = progressoDaTraducao(campos, config.traducoes, id);
              return (
                <Chip key={id} ativo={idioma === id} onClick={() => escolher(id)}>
                  <span lang={infoIdioma(id).lang}>{infoIdioma(id).nome}</span>
                  <span className="text-xs font-normal text-hf-muted">{p.total ? `${Math.round((p.feitos / p.total) * 100)}%` : "—"}</span>
                </Chip>
              );
            })}
          </div>

          {idioma ? (
            <div className="space-y-2">
              {GRUPOS.map((g) => {
                const pg = prog.porGrupo[g.id] || { feitos: 0, total: 0 };
                if (!pg.total && g.id !== "textos") return null;
                const abre = aberto === g.id;
                return (
                  <div key={g.id} className="rounded-xl border border-hf-border">
                    <button type="button" aria-expanded={abre} onClick={() => setAberto(abre ? "" : g.id)}
                      className="flex min-h-[48px] w-full items-center justify-between gap-3 px-3 text-left">
                      <span className="text-sm font-bold text-hf-text">{g.rotulo}</span>
                      <span className="flex items-center gap-2">
                        {pg.total ? <Barra feitos={pg.feitos} total={pg.total} /> : null}
                        <ChevronDown size={16} className={`text-hf-muted transition ${abre ? "rotate-180" : ""}`} />
                      </span>
                    </button>
                    {abre ? (
                      <div className="space-y-4 border-t border-hf-border p-3">
                        {g.id === "produtos" ? (
                          <>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="relative min-w-[200px] flex-1">
                                <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-hf-muted" />
                                <input className={`${inputCls} pl-9`} value={busca} onChange={(e) => { setBusca(e.target.value); setPagina(1); }} placeholder="Buscar prato" aria-label="Buscar prato" />
                              </span>
                              <Chip ativo={soFaltando} onClick={() => { setSoFaltando((v) => !v); setPagina(1); }}>Só os que faltam</Chip>
                            </div>
                            {pratos.slice(0, pagina * POR_PAGINA).map(([id, lista]) => {
                              const nome = lista.find((c) => c.campo === "nome");
                              return (
                                <div key={id} className="rounded-xl bg-hf-elevated/50 p-3">
                                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                    <strong className="text-sm text-hf-text" lang="pt-BR">{nome?.original}</strong>
                                    {nome && !lerTraducao(config.traducoes, idioma, nome) ? (
                                      <Botao variante="texto" className="min-h-[36px] px-2 text-xs" onClick={() => trocar(nome, nome.original)}>Manter o nome original</Botao>
                                    ) : null}
                                  </div>
                                  <div className="grid gap-3 sm:grid-cols-2">
                                    {lista.map((c) => (
                                      <CampoTraducao key={c.campo} item={c} lang={info.lang} valor={lerTraducao(config.traducoes, idioma, c)} onChange={(v) => trocar(c, v)} />
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                            {!pratos.length ? <p className="text-sm text-hf-muted">{soFaltando ? "Todos os pratos deste filtro já têm tradução." : "Nenhum prato com esse nome."}</p> : null}
                            {pratos.length > pagina * POR_PAGINA ? (
                              <Botao variante="secundario" className="w-full" onClick={() => setPagina((p) => p + 1)}>Mostrar mais {Math.min(POR_PAGINA, pratos.length - pagina * POR_PAGINA)} de {pratos.length - pagina * POR_PAGINA}</Botao>
                            ) : null}
                          </>
                        ) : g.id === "textos" ? (
                          <>
                            {porGrupo("textos").map((c) => (
                              <CampoTraducao key={c.id} item={c} lang={info.lang} valor={lerTraducao(config.traducoes, idioma, c)} onChange={(v) => trocar(c, v)} />
                            ))}
                            {!porGrupo("textos").length ? <p className="text-sm text-hf-muted">Sem apresentação nem rodapé escritos (aba Conversa e textos).</p> : null}
                            <details className="rounded-xl border border-hf-border p-3">
                              <summary className="min-h-[36px] cursor-pointer text-sm font-semibold text-hf-text">Frases do atendimento (opcional: já vêm prontas em {info.nome})</summary>
                              <div className="mt-3 space-y-3">
                                {FRASES.map((f) => (
                                  <Campo key={f.k} rotulo={f.rotulo} dica="Use {nome} para o nome do cliente. Vazio = a frase pronta mostrada no campo.">
                                    <input className={inputCls} lang={info.lang} maxLength={160} value={lerTraducao(config.traducoes, idioma, { grupo: "textos", id: f.k, campo: f.k })}
                                      placeholder={TEXTOS_PADRAO[idioma]?.[f.k] || ""} onChange={(e) => trocar({ grupo: "textos", id: f.k, campo: f.k }, e.target.value)} />
                                  </Campo>
                                ))}
                                <Campo rotulo="Primeira frase da conversa" dica="Vazio = a frase pronta mostrada no campo.">
                                  <input className={inputCls} lang={info.lang} maxLength={140} value={lerTraducao(config.traducoes, idioma, { grupo: "conversa", id: "intro", campo: "intro" })}
                                    placeholder={TEXTOS_PADRAO[idioma]?.intro || ""} onChange={(e) => trocar({ grupo: "conversa", id: "intro", campo: "intro" }, e.target.value)} />
                                </Campo>
                              </div>
                            </details>
                          </>
                        ) : (
                          conjuntos(g.id).map(([id, lista]) => (
                            <div key={id} className="grid gap-3 rounded-xl bg-hf-elevated/50 p-3 sm:grid-cols-2">
                              {lista.map((c) => (
                                <CampoTraducao key={c.campo} item={c} lang={info.lang} valor={lerTraducao(config.traducoes, idioma, c)} onChange={(v) => trocar(c, v)} />
                              ))}
                            </div>
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </Secao>
      )}
    </div>
  );
}
