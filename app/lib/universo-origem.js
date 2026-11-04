// Universo (Cozinha, Bar ou Salão) aberto por último nesta aba. Guarda de onde o
// funcionário veio para o voltar de telas compartilhadas, como Validades. Em
// sessionStorage: cada aba/aparelho tem o seu e nada disso vai para o banco.
const CHAVE = "hefisto_universo_origem";

export function lerOrigem() {
  try { return sessionStorage.getItem(CHAVE); } catch { return null; }
}

export function guardarOrigem(id) {
  try { sessionStorage.setItem(CHAVE, id); } catch { /* sem armazenamento, vale a rota */ }
}

export function limparOrigem() {
  try { sessionStorage.removeItem(CHAVE); } catch { /* idem */ }
}
