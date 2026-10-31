"use client";

// Delivery e "Mais informações": o que aparece no cartão da loja do
// cardápio de entrega e as regras que o servidor confere no pedido (pedido
// mínimo, grátis acima de). Aberto/fechado e taxa ficam na unidade — é de lá
// que o servidor tira a taxa cobrada; o resto fica na configuração do
// cardápio.

import { useState } from "react";
import Link from "next/link";
import { FORMAS_PAGAMENTO, formatarPreco } from "../../../lib/cardapio-digital.mjs";
import { Alternar, Aviso, Campo, Secao, inputCls } from "./ui";

/** "8,90", "8.90" e "1.234,50" viram número; vazio é 0. */
function lerDinheiro(t) {
  const s = String(t ?? "").trim().replace(/[R$\s]/g, "");
  if (!s) return 0;
  const n = Number(s.includes(",") ? s.replace(/\./g, "").replace(",", ".") : s);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : NaN;
}
const mostrarDinheiro = (v) => (v ? String(v.toFixed(2)).replace(".", ",") : "");

function CampoDinheiro({ rotulo, dica, valor, onChange }) {
  const [texto, setTexto] = useState(mostrarDinheiro(valor));
  const [ultimo, setUltimo] = useState(valor);
  if (ultimo !== valor && lerDinheiro(texto) !== valor) { setUltimo(valor); setTexto(mostrarDinheiro(valor)); }
  const n = lerDinheiro(texto);
  return (
    <Campo rotulo={rotulo} dica={Number.isNaN(n) ? undefined : dica}>
      <span className="flex items-center gap-2">
        <span className="text-sm font-semibold text-hf-muted">R$</span>
        <input className={inputCls} inputMode="decimal" value={texto} placeholder="0,00" maxLength={10}
          onChange={(e) => { const t = e.target.value; setTexto(t); const v = lerDinheiro(t); if (!Number.isNaN(v)) { setUltimo(v); onChange(v); } }} />
      </span>
      {Number.isNaN(n) ? <span className="mt-1 block text-[11px] font-semibold text-hf-danger">Use só números, como 8,90.</span> : null}
    </Campo>
  );
}

function CampoMinutos({ rotulo, valor, onChange }) {
  return (
    <Campo rotulo={rotulo}>
      <span className="flex items-center gap-2">
        <input className={inputCls} inputMode="numeric" value={valor || ""} placeholder="—" maxLength={3}
          onChange={(e) => { const n = Number(e.target.value.replace(/\D/g, "")); onChange(Number.isFinite(n) ? n : 0); }} />
        <span className="text-sm text-hf-muted">min</span>
      </span>
    </Campo>
  );
}

export default function Entrega({ config, mudar, unidade, pendenteUnidade = {}, setUnidade }) {
  const en = config.entrega;
  const info = config.info;
  const aberto = "delivery_aberto" in pendenteUnidade ? pendenteUnidade.delivery_aberto : unidade.delivery_aberto;
  const taxa = "taxa_entrega" in pendenteUnidade ? pendenteUnidade.taxa_entrega : unidade.taxa_entrega;
  const setE = (campos) => mudar((c) => ({ ...c, entrega: { ...c.entrega, ...campos } }));
  const setI = (campos) => mudar((c) => ({ ...c, info: { ...c.info, ...campos } }));
  const tempoTrocado = en.tempo_min && en.tempo_max && en.tempo_max < en.tempo_min;
  const cidade = [unidade.cidade, unidade.uf].filter(Boolean).join(" - ");

  return (
    <div className="space-y-4">
      <Secao titulo="Delivery" subtitulo="Vale para o link do delivery. O pedido na mesa (QR Code) não depende disto.">
        <Alternar ativo={aberto} onChange={(v) => setUnidade({ delivery_aberto: v })} rotulo="Recebendo pedidos de entrega"
          dica={aberto ? "O cliente consegue pedir para entregar." : "O cardápio continua aberto para ver; o pedido de entrega fica parado até você ligar de novo."} />
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <CampoDinheiro rotulo="Taxa de entrega" valor={taxa} onChange={(v) => setUnidade({ taxa_entrega: v })}
            dica={taxa > 0 ? `O cliente vê “Entrega ${formatarPreco(taxa)}”.` : "Zero = o cliente vê “Entrega grátis” e nada é cobrado de entrega."} />
          <CampoDinheiro rotulo="Pedido mínimo" valor={en.pedido_minimo} onChange={(v) => setE({ pedido_minimo: v })}
            dica={en.pedido_minimo > 0 ? "Abaixo disso o botão de enviar fica parado e o cliente vê quanto falta." : "Vazio = sem pedido mínimo."} />
          <CampoDinheiro rotulo="Entrega grátis acima de" valor={en.gratis_acima} onChange={(v) => setE({ gratis_acima: v })}
            dica={en.gratis_acima > 0 ? (taxa > 0 ? "Acima deste valor a taxa some (o servidor confere no pedido)." : "Sem taxa de entrega, isto não muda nada.") : "Vazio = a taxa vale para qualquer valor."} />
          <div className="grid grid-cols-2 gap-3">
            <CampoMinutos rotulo="Tempo de entrega: de" valor={en.tempo_min} onChange={(v) => setE({ tempo_min: v })} />
            <CampoMinutos rotulo="até" valor={en.tempo_max} onChange={(v) => setE({ tempo_max: v })} />
          </div>
        </div>
        {tempoTrocado ? <Aviso tipo="alerta" className="mt-3">O “até” está menor que o “de”. Ao salvar, os dois trocam de lugar.</Aviso> : null}
        {!en.tempo_min || !en.tempo_max ? <p className="mt-2 text-xs text-hf-muted">Sem os dois tempos, o cardápio não mostra tempo de entrega (nada de prazo inventado).</p> : null}
      </Secao>

      <Secao titulo="Retirada e pagamento" subtitulo="O que o cliente escolhe ao finalizar o pedido do delivery.">
        <Alternar ativo={en.retirada} onChange={(v) => setE({ retirada: v })} rotulo="Aceitar retirada no balcão"
          dica={en.retirada ? "O cliente escolhe Entrega ou Retirada. Na retirada não há taxa nem endereço." : "Desligado: o cliente só vê Entrega."} />
        <p className="mt-3 text-sm font-semibold text-hf-text">Formas de pagamento na entrega ou retirada</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {FORMAS_PAGAMENTO.map((f) => {
            const ligada = en.formas.includes(f.id);
            return (
              <label key={f.id} className="flex min-h-[44px] items-center gap-3 rounded-xl border border-hf-border px-3 text-sm">
                <input type="checkbox" checked={ligada} disabled={ligada && en.formas.length === 1}
                  onChange={() => setE({ formas: ligada ? en.formas.filter((x) => x !== f.id) : [...en.formas, f.id] })} />
                {f.rotulo}
              </label>
            );
          })}
        </div>
        <p className="mt-2 text-xs text-hf-muted">Pelo menos uma. Pagar pelo app (Pix ou cartão online) precisa de um intermediador de pagamento e ainda não existe.</p>
      </Secao>

      <Secao titulo="Mais informações" subtitulo="O que aparece no botão “Mais informações” do cartão da loja.">
        <Alternar ativo={info.mostrar_horario} onChange={(v) => setI({ mostrar_horario: v })} rotulo="Horário de funcionamento"
          dica={unidade.horario || "Ainda não preenchido nos dados da loja."} />
        <Alternar ativo={info.mostrar_endereco} onChange={(v) => setI({ mostrar_endereco: v })} rotulo="Endereço"
          dica={[unidade.endereco, cidade].filter(Boolean).join(" · ") || "Ainda não preenchido nos dados da loja."} />
        <Alternar ativo={info.mostrar_telefone} onChange={(v) => setI({ mostrar_telefone: v })} rotulo="Telefone (toca para ligar)"
          dica={unidade.telefone || "Ainda não preenchido nos dados da loja."} />
        <p className="mt-2 text-xs text-hf-muted">
          Endereço, telefone e horário se alteram em{" "}
          <Link href="/dashboard/configuracoes" className="font-semibold text-hf-accent underline">Configurações → dados da loja</Link>.
          A cidade aparece sempre que estiver preenchida.
        </p>
      </Secao>
    </div>
  );
}
