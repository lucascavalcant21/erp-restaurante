import { supabase, isSupabaseReady } from "./supabase";

// PINs e senhas do sistema (por unidade). Se a tabela ainda não existir ou a
// unidade não tiver registro, valem os padrões abaixo — nada quebra.
export const PINS_PADRAO = {
  pin_gerente: "1234",   // libera atraso e destrava o Modo Tablet do ponto
  senha_cozinha: "1111", // sair da Estação Cozinha
  senha_bar: "2222",     // sair da Estação Bar
  senha_salao: "3333",   // sair da Estação Salão
};

export async function fetchPins(unidadeId) {
  if (!isSupabaseReady() || !unidadeId || unidadeId === "todas") return { data: { ...PINS_PADRAO } };
  try {
    const { data, error } = await supabase.from("config_pins")
      .select("*").eq("unidade_id", unidadeId).limit(1);
    if (error || !data || !data.length) return { data: { ...PINS_PADRAO } };
    const r = data[0];
    return {
      data: {
        pin_gerente: r.pin_gerente || PINS_PADRAO.pin_gerente,
        senha_cozinha: r.senha_cozinha || PINS_PADRAO.senha_cozinha,
        senha_bar: r.senha_bar || PINS_PADRAO.senha_bar,
        senha_salao: r.senha_salao || PINS_PADRAO.senha_salao,
      },
    };
  } catch {
    return { data: { ...PINS_PADRAO } };
  }
}

export async function salvarPins(unidadeId, pins) {
  if (!isSupabaseReady()) return { error: "Offline" };
  const campos = {
    pin_gerente: pins.pin_gerente || null,
    senha_cozinha: pins.senha_cozinha || null,
    senha_bar: pins.senha_bar || null,
    senha_salao: pins.senha_salao || null,
  };
  const { data: exist } = await supabase.from("config_pins")
    .select("id").eq("unidade_id", unidadeId).limit(1);
  if (exist && exist.length) {
    const { error } = await supabase.from("config_pins").update(campos).eq("id", exist[0].id);
    return { error: error?.message };
  }
  const { error } = await supabase.from("config_pins").insert([{ unidade_id: unidadeId, ...campos }]);
  return { error: error?.message };
}
