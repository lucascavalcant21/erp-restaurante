// CPF: só dígitos, dígitos verificadores certos (a mesma regra do banco,
// public._fidelidade_cpf na FIDELIDADE-3) e a máscara 000.000.000-00.

export function cpfValido(v) {
  const d = String(v ?? "").replace(/\D/g, "");
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return "";
  const dig = (n) => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dig(9) === Number(d[9]) && dig(10) === Number(d[10]) ? d : "";
}

/** "52998224725" → "529.982.247-25"; parcial enquanto digita. */
export function mascaraCpf(v) {
  const d = String(v ?? "").replace(/\D/g, "").slice(0, 11);
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 9)].filter(Boolean).join(".") + (d.length > 9 ? `-${d.slice(9)}` : "");
}

/** Campos do cadastro que faltam (tablet e celular; o servidor confere de novo). Só "promoções no WhatsApp" é opcional (LGPD). */
export function camposFaltando(form) {
  const f = form || {};
  const tel = String(f.telefone ?? "").replace(/\D/g, "").replace(/^55(?=\d{10,11}$)/, "");
  return [
    String(f.nome ?? "").trim().split(/\s+/).filter(Boolean).length < 2 && "nome",
    !cpfValido(f.cpf) && "cpf",
    !f.aniversario && "aniversario",
    !f.uf && "uf",
    !String(f.cidade ?? "").trim() && "cidade",
    !String(f.bairro ?? "").trim() && "bairro",
    !/^\d{10,11}$/.test(tel) && "telefone",
    !f.aceite && "aceite",
  ].filter(Boolean);
}

export const UFS = ["AC", "AL", "AM", "AP", "BA", "CE", "DF", "ES", "GO", "MA", "MG", "MS", "MT", "PA", "PB", "PE", "PI", "PR", "RJ", "RN", "RO", "RR", "RS", "SC", "SE", "SP", "TO"];
