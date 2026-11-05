import { redirect } from "next/navigation";

// Endereço antigo: Combos virou parte do Cardápio.
export default function CombosPage() {
  redirect("/dashboard/marmitaria/marmitas/cardapio?aba=combos");
}
