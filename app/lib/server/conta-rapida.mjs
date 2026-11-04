// Regras de servidor da conta rápida. Unidade e permissões nunca vêm do pedido.

// A unidade vem do cadastro de quem cria. Sem unidade no cadastro (super admin),
// só vale se a casa tiver uma unidade: com duas ou mais não se adivinha.
export async function unidadeDaContaRapida(db, actorRecord) {
  if (actorRecord?.unidade_principal_id) {
    const { data } = await db.from("unidades").select("*").eq("id", actorRecord.unidade_principal_id).maybeSingle();
    return data || null;
  }
  if (!actorRecord?.super_admin) return null;
  const { data } = await db.from("unidades").select("*").limit(2);
  return data?.length === 1 ? data[0] : null;
}

// Perfil já existente fica como está: o dono pode ter ajustado as permissões.
export async function perfilDaContaRapida(db, modelo, { autorId, gravarPermissoes, auditar }) {
  const achado = await db.from("perfis_acesso").select("id").eq("codigo", modelo.codigo).eq("is_current", true).maybeSingle();
  if (achado.error) throw achado.error;
  if (achado.data) return achado.data;
  const inserido = await db.from("perfis_acesso").insert({
    nome: modelo.nome, codigo: modelo.codigo, descricao: modelo.descricao,
    tipo: modelo.tipoAcesso || "funcionario", ativo: true, created_by: autorId,
  }).select().single();
  if (inserido.error) throw inserido.error;
  await gravarPermissoes(inserido.data.id);
  await auditar(inserido.data.id, { ...inserido.data, permissions: modelo.permissoes });
  return inserido.data;
}
