"use client";

// Os dois formulários da ficha. Cada um monta SÓ os campos do seu tipo — o que
// não é do tipo não existe aqui (não é campo escondido nem desabilitado).
// Os dois servem para cozinha e bar: o setor é só mais um campo.
//
//   FormularioPrato       nome, categoria, setor, foto, rendimento (g),
//                           ingredientes, montagem e custos/precificação
//   FormularioPrePreparo  + responsável, rendimento, tempo, peso final,
//                           modo de preparo, armazenamento, equipamentos,
//                           alergênicos e custos

import {
  SecaoEditor, CampoFoto, SeletorSetor, CampoCategoria, ListaIngredientes, CampoInstrucoes,
  CampoRendimento, CampoRendimentoPrato, CampoPesoFinal, CampoTempoPreparo, CampoArmazenamento, CampoEquipamentos,
  CampoAlergenicos, PainelCustos, PainelCustosPrecificacao,
} from "./CamposFicha";

function Identificacao({ cfg, form, mudar, categorias, onGerenciarCategorias, comResponsavel = false, campoRendimento = null }) {
  return (
    <SecaoEditor id="ficha-identificacao" titulo="Identificação">
      <div className="flex gap-4">
        <CampoFoto imagem={form.imagem} onChange={imagem => mudar({ imagem })} />
        <div className="min-w-0 flex-1">
          <label htmlFor="ficha-nome" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">
            {cfg.id === "prato" ? "Nome do prato" : "Nome do pré-preparo"}
          </label>
          <input id="ficha-nome" value={form.nome_receita} onChange={e => mudar({ nome_receita: e.target.value })} autoComplete="off"
            placeholder={cfg.id === "prato" ? "Ex.: Picanha na brasa" : "Ex.: Tucupi reduzido"}
            className="erp-input text-lg font-black" />
        </div>
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <CampoCategoria valor={form.categoria} opcoes={categorias} onChange={categoria => mudar({ categoria })} onGerenciar={onGerenciarCategorias} />
        <SeletorSetor valor={form.departamento} onChange={departamento => mudar({ departamento })} />
        {campoRendimento}
        {comResponsavel ? (
          <div className="sm:col-span-2">
            <label htmlFor="ficha-responsavel" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-muted">Responsável</label>
            <input id="ficha-responsavel" value={form.responsavel} onChange={e => mudar({ responsavel: e.target.value })}
              placeholder="Quem responde por esta receita" className="erp-input" />
          </div>
        ) : null}
      </div>
    </SecaoEditor>
  );
}

function Ingredientes({ cfg, ingredientes }) {
  return (
    <SecaoEditor id="ficha-ingredientes" titulo="Ingredientes" destaque={cfg.destaques.includes("ingredientes")}
      descricao={cfg.id === "prato" ? "O que vai no prato e em qual quantidade." : "O que entra na produção do lote."}>
      <ListaIngredientes {...ingredientes} />
    </SecaoEditor>
  );
}

function Instrucoes({ cfg, form, mudar, itens }) {
  return (
    <SecaoEditor id="ficha-instrucoes" titulo={cfg.instrucoes.titulo} destaque={cfg.destaques.includes("instrucoes")}
      descricao={cfg.id === "prato" ? "É o padrão de montagem: siga a ordem e a foto." : "Passo a passo completo da produção."}>
      <CampoInstrucoes id="ficha-instrucoes-texto" tipo={cfg.id} valor={form.modo_preparo}
        onChange={modo_preparo => mudar({ modo_preparo })} placeholder={cfg.instrucoes.placeholder}
        nomeReceita={form.nome_receita} itens={itens} />
    </SecaoEditor>
  );
}

export function FormularioPrato(props) {
  const { cfg, form, mudar, itens, ingredientes, podeVerCustos, padroesFinanceiros } = props;
  return (
    <div className="space-y-4">
      <Identificacao {...props}
        campoRendimento={<CampoRendimentoPrato form={form} onChange={mudar} itens={itens} ajuda={cfg.rendimento.ajuda} />} />
      <Ingredientes cfg={cfg} ingredientes={ingredientes} />
      <Instrucoes cfg={cfg} form={form} mudar={mudar} itens={itens} />
      <PainelCustosPrecificacao form={form} mudar={mudar} itens={itens}
        podeVerCustos={podeVerCustos} padroes={padroesFinanceiros} />
    </div>
  );
}

export function FormularioPrePreparo(props) {
  const {
    cfg, form, mudar, itens, ingredientes, autoRendimento, setAutoRendimento,
    armazenamento, setArmazenamento, equipamentos, setEquipamentos, alergenicos, setAlergenicos,
    podeVerCustos, carregandoComplementos,
  } = props;
  const aguarde = carregandoComplementos
    ? <p className="text-sm font-semibold text-muted">Carregando...</p>
    : null;
  return (
    <div className="space-y-4">
      <Identificacao {...props} comResponsavel />

      <SecaoEditor id="ficha-producao" titulo="Produção">
        <div className="grid gap-4 sm:grid-cols-3">
          <CampoRendimento form={form} onChange={mudar} auto={autoRendimento} onAuto={setAutoRendimento} itens={itens} />
          <CampoTempoPreparo valor={form.tempo_preparo} onChange={tempo_preparo => mudar({ tempo_preparo })} />
          <CampoPesoFinal form={form} onChange={mudar} />
        </div>
      </SecaoEditor>

      <Ingredientes cfg={cfg} ingredientes={ingredientes} />
      <Instrucoes cfg={cfg} form={form} mudar={mudar} itens={itens} />

      <SecaoEditor id="ficha-armazenamento" titulo="Armazenamento e validade" destaque={cfg.destaques.includes("armazenamento")}>
        {aguarde || <CampoArmazenamento valor={armazenamento} onChange={setArmazenamento} />}
      </SecaoEditor>

      <SecaoEditor id="ficha-equipamentos" titulo="Equipamentos e utensílios" descricao="O que precisa estar à mão antes de começar.">
        {aguarde || <CampoEquipamentos selecionados={equipamentos} onChange={setEquipamentos} />}
      </SecaoEditor>

      <SecaoEditor id="ficha-alergenicos" titulo="Alergênicos" descricao="Declaração obrigatória (RDC 727/2022).">
        {aguarde || (
          <CampoAlergenicos selecionados={alergenicos} podeConter={form.alergenicos_pode_conter}
            onChange={setAlergenicos} onPodeConter={alergenicos_pode_conter => mudar({ alergenicos_pode_conter })} />
        )}
      </SecaoEditor>

      {podeVerCustos ? (
        <SecaoEditor id="ficha-custos" titulo="Custos" descricao="Calculados pelo sistema a partir dos ingredientes.">
          <PainelCustos itens={itens} form={form} />
        </SecaoEditor>
      ) : null}
    </div>
  );
}

// O formulário de cada tipo. É a única decisão "qual tela" do editor.
export const FORMULARIO_DO_TIPO = {
  prato: FormularioPrato,
  pre_preparo: FormularioPrePreparo,
};
