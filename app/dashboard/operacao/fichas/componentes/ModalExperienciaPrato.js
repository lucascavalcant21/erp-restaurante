"use client";

import React, { useState, useEffect } from "react";
import {
  BookOpen,
  Sparkles,
  Wine,
  ShieldAlert,
  Clock,
  Flame,
  Save,
  X,
  CheckCircle2,
  Smartphone,
  Check,
  UtensilsCrossed,
  Layers,
  ChevronRight,
  Info
} from "lucide-react";
import { salvarProduto } from "../../../../lib/vendas";
import { supabase } from "../../../../lib/supabase";

const ALERGENICOS_COMUNS = [
  { id: "glúten", label: "Contém Glúten" },
  { id: "lactose", label: "Contém Lactose" },
  { id: "frutos_do_mar", label: "Frutos do Mar / Crustáceos" },
  { id: "peixes", label: "Peixes" },
  { id: "ovos", label: "Ovos" },
  { id: "soja", label: "Soja" },
  { id: "amendoim", label: "Amendoim / Nozes" }
];

export default function ModalExperienciaPrato({
  ficha,
  produto,
  unidadeId,
  onFechar,
  onSalvo
}) {
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [sucesso, setSucesso] = useState(false);

  // Campos da Experiência
  const [historia, setHistoria] = useState(
    produto?.historia_gastronomica || ficha?.historia_gastronomica || ""
  );
  const [harmonizacao, setHarmonizacao] = useState(
    produto?.harmonizacao || ficha?.harmonizacao || ""
  );
  const [descricao, setDescricao] = useState(
    produto?.descricao || ficha?.descricao || ""
  );
  const [tempoPreparo, setTempoPreparo] = useState(
    produto?.tempo_preparo_base || ficha?.tempo_preparo || 20
  );
  const [destaque, setDestaque] = useState(
    Boolean(produto?.destaque_experience ?? ficha?.destaque_experience)
  );

  // Alérgenos selecionados
  const [alergenicosSel, setAlergenicosSel] = useState(() => {
    const raw = String(produto?.alergenicos || ficha?.alergenicos || "").toLowerCase();
    return ALERGENICOS_COMUNS.filter(a => raw.includes(a.id)).map(a => a.id);
  });

  const [abaPreview, setAbaPreview] = useState(false);

  const toggleAlergeno = (id) => {
    setAlergenicosSel(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // Gerador de História Cultural com IA (Gastronomia & Tradições)
  const gerarHistoriaComIA = () => {
    const nome = ficha?.nome_receita || produto?.nome_produto || "Prato Autoral";
    const nomeMinusculo = nome.toLowerCase();

    if (nomeMinusculo.includes("pirarucu")) {
      setHistoria(
        "O Pirarucu (Arapaima gigas) é o gigante sagrado das águas amazônicas. Manejado de forma sustentável pelas comunidades ribeirinhas, sua carne tenra e nobre é o pilar da culinária amazônica ancestral, unindo força ribeirinha e refinamento gastronômico contemporâneo."
      );
    } else if (nomeMinusculo.includes("tambaqui") || nomeMinusculo.includes("costela")) {
      setHistoria(
        "O Tambaqui é o símbolo do sabor dos rios de várzea. Alimentado naturalmente por sementes e frutos caídos das matas inundadas, suas costelas e cortes nobres trazem uma untuosidade marcante e textura inconfundível que definem a identidade gastronômica do Norte brasileiro."
      );
    } else if (nomeMinusculo.includes("moqueca")) {
      setHistoria(
        "Preparação de herança afro-indígena secular, a moqueca celebra o casamento entre os pescados frescos, o leite de coco aromático e o azeite de dendê. Um prato que conta a história dos encontros culturais brasileiros em cada colherada fumegante."
      );
    } else if (nomeMinusculo.includes("picanha") || nomeMinusculo.includes("angus") || nomeMinusculo.includes("filé")) {
      setHistoria(
        "Corte nobre selecionado de procedência certificada, grelhado na brasa para selar todos os sucos naturais. A combinação de crosta caramelizada e marmoreio equilibrado entrega uma experiência de maciez e sabor inigualável à mesa."
      );
    } else if (nomeMinusculo.includes("drink") || nomeMinusculo.includes("caipirinha")) {
      setHistoria(
        "Coquetel autoral pensado para equilibrar frescor e intensidade botânica. Une frutas frescas regionais a destilados selecionados, criando uma sinestesia refrescante perfeita para abrir o apetite e celebrar encontros."
      );
    } else {
      setHistoria(
        `Criação gastronômica autoral que valoriza ingredientes frescos e técnicas culinárias precisas. Desenvolvido para oferecer harmonia de texturas, contrastes de sabor e uma narrativa que honra a terra e os produtores artesanais.`
      );
    }
  };

  // Gerador de Harmonização com IA
  const gerarHarmonizacaoComIA = () => {
    const nome = (ficha?.nome_receita || produto?.nome_produto || "").toLowerCase();
    const categoria = (ficha?.categoria || produto?.categoria || "").toLowerCase();

    if (nome.includes("peixe") || nome.includes("pirarucu") || nome.includes("tambaqui") || nome.includes("moqueca")) {
      setHarmonizacao("Harmoniza com Vinho Branco Sauvignon Blanc fresco ou Caipirinha aromática de Caju e limão cravo.");
    } else if (nome.includes("carne") || nome.includes("picanha") || nome.includes("angus") || categoria.includes("carne")) {
      setHarmonizacao("Combina com Vinho Tinto Malbec encorpado, Cerveja IPA artesanal ou Drink clássico com notas amadeiradas.");
    } else if (categoria.includes("sobremesa") || nome.includes("chocolate") || nome.includes("doce")) {
      setHarmonizacao("Perfeito com Café Espresso de grãos especiais, Vinho de Sobremesa Porto ou Licor de Cupuaçu.");
    } else {
      setHarmonizacao("Harmoniza com Drinks cítricos refrescantes ou Cerveja artesanal Lager de alta drinkability.");
    }
  };

  // Salvar no banco
  const salvarExperiencia = async () => {
    setSalvando(true);
    setErro("");
    setSucesso(false);

    try {
      const stringAlergenos = alergenicosSel
        .map(id => ALERGENICOS_COMUNS.find(a => a.id === id)?.label)
        .filter(Boolean)
        .join(", ");

      const payload = {
        descricao: descricao.trim(),
        historia_gastronomica: historia.trim(),
        harmonizacao: harmonizacao.trim(),
        tempo_preparo_base: Number(tempoPreparo) || 15,
        destaque_experience: Boolean(destaque),
        alergenicos: stringAlergenos || null
      };

      // 1. Se existir produto vinculado, atualiza via salvarProduto
      if (produto?.id) {
        payload.id = produto.id;
        const res = await salvarProduto(payload);
        if (res.error) throw new Error(res.error);
      } else {
        // Se ainda não há produto do cardápio, tenta localizar pelo nome ou criar
        const { data: prodExistente } = await supabase
          .from("produtos")
          .select("id")
          .eq("unidade_id", unidadeId)
          .eq("nome_produto", ficha?.nome_receita)
          .maybeSingle();

        if (prodExistente?.id) {
          payload.id = prodExistente.id;
          const res = await salvarProduto(payload);
          if (res.error) throw new Error(res.error);
        } else {
          // Cria produto no cardápio vinculado a esta ficha
          payload.unidade_id = unidadeId;
          payload.nome_produto = ficha?.nome_receita;
          payload.categoria = ficha?.categoria || "Pratos Principais";
          payload.departamento = ficha?.departamento || "cozinha";
          payload.preco_venda = Number(ficha?.preco_venda) || 0;
          payload.ficha_id = ficha?.id;
          payload.ativo = true;

          const res = await salvarProduto(payload);
          if (res.error) throw new Error(res.error);
        }
      }

      setSucesso(true);
      setTimeout(() => {
        if (onSalvo) onSalvo();
        onFechar();
      }, 1200);
    } catch (err) {
      setErro(err.message || "Falha ao gravar experiência do prato.");
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 animate-in fade-in">
      <div className="bg-[#181310] border border-amber-800/40 w-full max-w-3xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[92vh] text-[#f7efe8]">
        
        {/* CABEÇALHO */}
        <div className="p-4 sm:p-5 border-b border-amber-900/30 flex items-center justify-between bg-[#221a16]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-600/20 text-amber-400 border border-amber-600/30 flex items-center justify-center">
              <BookOpen size={20} />
            </div>
            <div>
              <span className="text-3xs uppercase tracking-wider font-black text-amber-400 block">
                Héfisto Experience • Héfisto Discover
              </span>
              <h2 className="text-base sm:text-lg font-black text-amber-50">
                Experiência do Prato: {ficha?.nome_receita || produto?.nome_produto}
              </h2>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setAbaPreview(!abaPreview)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 border ${
                abaPreview
                  ? "bg-amber-600 text-white border-amber-500 shadow-sm"
                  : "bg-[#2c221d] text-amber-200 border-amber-900/40 hover:bg-[#382b25]"
              }`}
            >
              <Smartphone size={14} />
              <span>{abaPreview ? "Editar Dados" : "Preview Celular"}</span>
            </button>

            <button onClick={onFechar} className="p-2 text-amber-300 hover:text-white" aria-label="Fechar">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* CORPO */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          
          {erro && (
            <div className="p-3 bg-red-950/40 border border-red-800/40 rounded-2xl text-red-200 text-xs flex items-center gap-2">
              <ShieldAlert size={16} className="shrink-0 text-red-400" />
              <span>{erro}</span>
            </div>
          )}

          {sucesso && (
            <div className="p-3 bg-emerald-950/50 border border-emerald-700/50 rounded-2xl text-emerald-200 text-xs flex items-center gap-2 animate-bounce">
              <CheckCircle2 size={16} className="shrink-0 text-emerald-400" />
              <span>Experiência gastronômica gravada com sucesso no Héfisto Experience!</span>
            </div>
          )}

          {abaPreview ? (
            /* PREVIEW MOBILE DE COMO O CLIENTE VÊ NO EXPERIENCE */
            <div className="flex flex-col items-center justify-center py-4">
              <p className="text-xs text-amber-300/70 mb-3 text-center">
                Visualização de como este prato é apresentado ao cliente na mesa do Seldeestrela:
              </p>

              <div className="w-full max-w-sm bg-[#130f0d] border-2 border-amber-700/40 rounded-3xl p-4 shadow-2xl text-[#f9f4ef] space-y-3">
                <div className="h-44 bg-[#261e19] rounded-2xl overflow-hidden relative flex items-center justify-center border border-amber-950/50">
                  {produto?.imagem_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={produto.imagem_url} alt="Prato" className="w-full h-full object-cover" />
                  ) : (
                    <UtensilsCrossed size={40} className="text-amber-700/30" />
                  )}
                  {destaque && (
                    <span className="absolute top-2 left-2 bg-amber-500 text-amber-950 text-3xs font-black px-2 py-0.5 rounded-md uppercase tracking-wider shadow">
                      Chef
                    </span>
                  )}
                </div>

                <div>
                  <div className="flex justify-between items-start">
                    <h3 className="font-black text-base text-amber-50">{ficha?.nome_receita || produto?.nome_produto}</h3>
                    <span className="font-black text-amber-400 text-sm">
                      {Number(produto?.preco_venda || ficha?.preco_venda || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}
                    </span>
                  </div>
                  <p className="text-xs text-amber-200/70 mt-1 leading-relaxed">
                    {descricao || "Deliciosa preparação gastronômica artesanal."}
                  </p>
                </div>

                {harmonizacao && (
                  <div className="bg-amber-950/40 border border-amber-800/30 p-2.5 rounded-xl flex items-start gap-2">
                    <Wine size={16} className="text-rose-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-3xs font-black uppercase text-amber-300 tracking-wider block">Harmonização Sugerida</span>
                      <p className="text-3xs text-amber-100/90">{harmonizacao}</p>
                    </div>
                  </div>
                )}

                {historia && (
                  <div className="bg-[#1e1713] border border-amber-600/30 p-3 rounded-xl space-y-1">
                    <span className="text-3xs font-black uppercase text-amber-400 flex items-center gap-1">
                      <Sparkles size={11} /> Héfisto Discover • História do Prato
                    </span>
                    <p className="text-3xs text-amber-200/80 leading-relaxed italic">
                      &quot;{historia}&quot;
                    </p>
                  </div>
                )}

                {alergenicosSel.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-1">
                    {alergenicosSel.map(id => (
                      <span key={id} className="text-3xs px-2 py-0.5 rounded-md bg-amber-950/60 text-amber-300 border border-amber-800/40">
                        {ALERGENICOS_COMUNS.find(a => a.id === id)?.label}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* FORMULÁRIO DE CONFIGURAÇÃO */
            <div className="space-y-4">
              
              {/* Descrição Apetitosa no Cardápio */}
              <div>
                <label className="text-xs font-bold text-amber-200 block mb-1">
                  Descrição Curta (Exibida no Cardápio Digital)
                </label>
                <textarea
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  placeholder="Ex: Pirarucu fresco selado na brasa com crosta de castanha-do-pará e molho aveludado de moqueca..."
                  rows={2}
                  className="w-full bg-[#120e0c] border border-amber-900/35 rounded-2xl p-3 text-xs text-amber-100 placeholder:text-amber-500/30 outline-none focus:border-amber-500 resize-none"
                />
              </div>

              {/* História Cultural & Narrativa Gastronômica (Héfisto Discover) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-amber-200 flex items-center gap-1.5">
                    <Sparkles size={14} className="text-amber-400" />
                    <span>História Gastronômica & Origem Cultural (Héfisto Discover)</span>
                  </label>
                  <button
                    type="button"
                    onClick={gerarHistoriaComIA}
                    className="text-3xs font-bold text-amber-400 hover:text-amber-200 flex items-center gap-1 transition"
                  >
                    <Sparkles size={12} />
                    <span>✨ Escrever com IA</span>
                  </button>
                </div>
                <textarea
                  value={historia}
                  onChange={(e) => setHistoria(e.target.value)}
                  placeholder="Conte a história das origens dos ingredientes, tradições indígenas, manejo sustentável nos rios amazônicos..."
                  rows={4}
                  className="w-full bg-[#120e0c] border border-amber-900/35 rounded-2xl p-3 text-xs text-amber-100 placeholder:text-amber-500/30 outline-none focus:border-amber-500 leading-relaxed resize-none"
                />
                <p className="text-3xs text-amber-400/60 mt-1">
                  Esta narrativa é lida pelo cliente ao tocar em &quot;Descubra a história deste prato&quot; e pode ser narrada por voz.
                </p>
              </div>

              {/* Harmonização Recomendada */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-amber-200 flex items-center gap-1.5">
                    <Wine size={14} className="text-rose-400" />
                    <span>Harmonização Sugerida (Bebida, Vinho ou Coquetel)</span>
                  </label>
                  <button
                    type="button"
                    onClick={gerarHarmonizacaoComIA}
                    className="text-3xs font-bold text-rose-400 hover:text-rose-200 flex items-center gap-1 transition"
                  >
                    <Sparkles size={12} />
                    <span>✨ Sugerir com IA</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={harmonizacao}
                  onChange={(e) => setHarmonizacao(e.target.value)}
                  placeholder="Ex: Harmoniza perfeitamente com Caipirinha de Caju ou Vinho Branco Sauvignon Blanc..."
                  className="w-full bg-[#120e0c] border border-amber-900/35 rounded-2xl p-3 text-xs text-amber-100 placeholder:text-amber-500/30 outline-none focus:border-amber-500"
                />
              </div>

              {/* Tempo Médio & Destaque do Chef */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-xs font-bold text-amber-200 block mb-1">
                    Tempo Médio de Preparo (minutos)
                  </label>
                  <div className="flex items-center gap-2 bg-[#120e0c] border border-amber-900/35 rounded-2xl px-3 py-2">
                    <Clock size={16} className="text-amber-400 shrink-0" />
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={tempoPreparo}
                      onChange={(e) => setTempoPreparo(e.target.value)}
                      className="bg-transparent text-xs font-mono font-bold text-amber-100 outline-none w-full"
                    />
                  </div>
                </div>

                <div className="flex items-center">
                  <label className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#120e0c] border border-amber-900/35 w-full cursor-pointer hover:border-amber-700/50 transition">
                    <input
                      type="checkbox"
                      checked={destaque}
                      onChange={(e) => setDestaque(e.target.checked)}
                      className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
                    />
                    <div>
                      <span className="text-xs font-bold text-amber-100 block">Destaque do Chef</span>
                      <span className="text-3xs text-amber-400/60 block">Exibe selo especial no cardápio digital</span>
                    </div>
                  </label>
                </div>
              </div>

              {/* Alérgenos Conhecidos */}
              <div className="pt-2">
                <label className="text-xs font-bold text-amber-200 flex items-center gap-1.5 mb-2">
                  <ShieldAlert size={14} className="text-amber-400" />
                  <span>Alérgenos Conhecidos (Informações de Segurança do Alimento)</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ALERGENICOS_COMUNS.map(a => {
                    const sel = alergenicosSel.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => toggleAlergeno(a.id)}
                        className={`p-2.5 rounded-xl border text-xs font-semibold text-left transition flex items-center justify-between ${
                          sel
                            ? "bg-amber-600/25 border-amber-500 text-amber-100"
                            : "bg-[#120e0c] border-amber-900/30 text-amber-300/60 hover:border-amber-700/40"
                        }`}
                      >
                        <span className="text-3xs">{a.label}</span>
                        {sel && <Check size={14} className="text-amber-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          )}

        </div>

        {/* RODAPÉ */}
        <div className="p-4 border-t border-amber-900/30 bg-[#221a16] flex items-center justify-between">
          <button
            onClick={onFechar}
            className="px-4 py-2 text-xs font-bold text-amber-300/80 hover:text-white transition"
          >
            Cancelar
          </button>

          <button
            onClick={salvarExperiencia}
            disabled={salvando}
            className="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-bold rounded-2xl shadow-lg shadow-amber-950/40 transition active:scale-95 flex items-center gap-2 disabled:opacity-50"
          >
            <Save size={16} />
            <span>{salvando ? "Salvando no Experience..." : "Gravar Experiência"}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
