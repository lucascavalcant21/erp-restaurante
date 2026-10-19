"use client";

import { CONFIG_PADRAO, aplicarNome, saudacao } from "../../../lib/cardapio-digital.mjs";
import { Alternar, Campo, Secao, inputCls } from "./ui";

const CAMPOS = [
  { k: "apresentacao", rotulo: "Apresentação (embaixo do nome da casa)", max: 140, dica: "Ex.: Cozinha paraense, brasa e drinks da casa." },
  { k: "pedir_nome", rotulo: "Como o cardápio pede o nome do cliente", max: 100 },
  { k: "boas_vindas", rotulo: "Boas-vindas", max: 160, nome: true },
  { k: "sugestao_bebida", rotulo: "Sugestão de bebida no pedido", max: 100 },
  { k: "sugestao_sobremesa", rotulo: "Sugestão de sobremesa no pedido", max: 100 },
  { k: "pedido_enviado", rotulo: "Depois que o pedido é enviado", max: 160, nome: true },
  { k: "rodape", rotulo: "Rodapé (horário, endereço, Instagram)", max: 240, longo: true },
];

export default function Textos({ config, mudar }) {
  const tx = config.textos;
  const cv = config.conversa;
  const setT = (campos) => mudar((c) => ({ ...c, textos: { ...c.textos, ...campos } }));
  const setC = (campos) => mudar((c) => ({ ...c, conversa: { ...c.conversa, ...campos } }));
  return (
    <div className="space-y-4">
      <Secao titulo="Conversa" subtitulo="Um atendimento por toques e perguntas curtas, com o que você marcou nos pratos. Não inventa nada: o que não estiver marcado, ela diz que não sabe e indica a equipe.">
        <Alternar ativo={cv.ativa} onChange={(v) => setC({ ativa: v })} rotulo="Mostrar a conversa no cardápio" />
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <Campo rotulo="Quem conversa" dica="Vazio = o nome da casa. Ex.: Dona Maria, Equipe Sel.">
            <input className={inputCls} value={cv.nome_atendente} maxLength={30} onChange={(e) => setC({ nome_atendente: e.target.value })} />
          </Campo>
          <Campo rotulo="Primeira frase depois do “Boa noite, Ana!”">
            <input className={inputCls} value={cv.intro} maxLength={140} onChange={(e) => setC({ intro: e.target.value })} placeholder={CONFIG_PADRAO.conversa.intro} />
          </Campo>
        </div>
      </Secao>

      <Secao titulo="Textos do cardápio" subtitulo="Use {nome} para o nome do cliente e {saudacao} para Bom dia / Boa tarde / Boa noite. Sem nome, a frase se ajeita sozinha.">
        <div className="space-y-3">
          {CAMPOS.map((c) => (
            <Campo key={c.k} rotulo={c.rotulo} dica={c.dica}>
              {c.longo
                ? <textarea className={`${inputCls} min-h-[80px] py-2`} value={tx[c.k]} maxLength={c.max} onChange={(e) => setT({ [c.k]: e.target.value })} />
                : <input className={inputCls} value={tx[c.k]} maxLength={c.max} onChange={(e) => setT({ [c.k]: e.target.value })} placeholder={CONFIG_PADRAO.textos[c.k] || ""} />}
              {c.nome ? (
                <span className="mt-1 block rounded-lg bg-hf-elevated/60 px-2 py-1 text-xs text-hf-text-2">
                  Com nome: “{aplicarNome(tx[c.k] || CONFIG_PADRAO.textos[c.k], { nome: "Ana", saudacao: saudacao() })}” · Sem nome: “{aplicarNome(tx[c.k] || CONFIG_PADRAO.textos[c.k], { saudacao: saudacao() })}”
                </span>
              ) : null}
            </Campo>
          ))}
        </div>
      </Secao>
    </div>
  );
}
