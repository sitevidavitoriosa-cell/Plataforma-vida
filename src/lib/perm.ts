export type Perfil = "admin" | "coordenacao" | "financeiro" | "estoque" | "decisoes" | "saude" | "visitante" | "admin_edicao" | "secretaria1" | "servo";
export type Acesso = {
  id: string; nome: string; email: string; perfil: Perfil;
  equipes: { nome: string; setores: string[] }[];
  edicoes?: string[];
  /** Restrições feitas no cadastro (só no site, dentro do perfil). Nulo = padrão do perfil. */
  permissoes?: Permissoes | null;
};
export type Permissoes = { ver: string[]; editar: string[] };

/** Áreas que aparecem como caixas de autorização no cadastro da pessoa. */
export const MODULOS: { id: string; nome: string; desc: string; editar: string | null }[] = [
  { id: "estoque", nome: "Estoque", desc: "Lista mãe, retirada e balanço", editar: "mexer nas quantidades, enviar e conferir" },
  { id: "encontristas", nome: "Encontristas (ficha)", desc: "Planilha completa dos encontristas", editar: "importar a planilha" },
  { id: "saude", nome: "Saúde", desc: "Lista de saúde e contatos de emergência", editar: "anotar observações e tirar da lista" },
  { id: "secretaria", nome: "Secretaria 1", desc: "Crachás, quartos, etiquetas e material", editar: "criar e alterar" },
  { id: "edicoes", nome: "Edições", desc: "Temporadas e seus dados", editar: "criar e alterar edições" },
  { id: "financeiro", nome: "Financeiro", desc: "Lançamentos, compras e relatório", editar: "lançar, comprar e pagar" },
  { id: "decisoes", nome: "Decisões", desc: "Registro e lista de decisões", editar: "registrar e gerar link" },
  { id: "organizacional", nome: "Organizacional", desc: "Drive de arquivos", editar: "enviar, mover, apagar e compartilhar" },
  { id: "pessoas", nome: "Pessoas", desc: "Convites, perfis e equipes", editar: "cadastrar e alterar pessoas" },
];
/** Áreas que um servo pode receber (as demais são só de administrador/coordenador). */
export const MODULOS_SERVO = ["estoque", "saude", "secretaria", "decisoes", "financeiro", "organizacional"];
/** Servo: só tem o que foi marcado no cadastro (sem marcação = nada). */
const servoTem = (a: Acesso, modulo: string, nivel: "ver" | "editar") => a.perfil === "servo" && MODULOS_SERVO.includes(modulo) && !!(nivel === "editar" ? a.permissoes?.editar : a.permissoes?.ver)?.includes(modulo);
const libera = (a: Acesso, modulo: string, nivel: "ver" | "editar") => !a.permissoes || (nivel === "editar" ? a.permissoes.editar : a.permissoes.ver).includes(modulo);

export const PERFIS: Record<Perfil, { nome: string; desc: string }> = {
  admin: { nome: "Administrador", desc: "Vê e mexe em tudo" },
  servo: { nome: "Servo", desc: "Só as áreas marcadas abaixo (ex.: Saúde, Secretaria 1)" },
  coordenacao: { nome: "Coordenação", desc: "Edições, financeiro e decisões (sem estoque e sem a ficha dos encontristas)" },
  financeiro: { nome: "Financeiro", desc: "Lançamentos e relatórios do caixa" },
  estoque: { nome: "Estoque (paiol)", desc: "Estoque de todos os setores: envia e confere o material" },
  decisoes: { nome: "Decisões", desc: "Encontristas e registro de decisões" },
  saude: { nome: "Saúde", desc: "Só dados de saúde dos encontristas" },
  admin_edicao: { nome: "Coordenador", desc: "Vê e mexe em tudo, mas só nas edições escolhidas para ele" },
  secretaria1: { nome: "Secretaria 1", desc: "Só a Secretaria 1: crachás, quartos, encontristas, saúde e o material do setor" },
  visitante: { nome: "Visitante", desc: "Só consulta (edições). Sem estoque" },
};

const ESCREVE: Record<Perfil, string[] | "*"> = {
  admin: "*",
  coordenacao: ["edicoes", "financeiro", "decisoes", "organizacional"],
  financeiro: ["financeiro"],
  estoque: ["estoque"],
  decisoes: ["decisoes"],
  saude: ["saude"],
  visitante: [],
  admin_edicao: [],
  secretaria1: [],
  servo: [],
};
const VE: Record<string, Perfil[]> = {
  financeiro: ["admin", "coordenacao", "financeiro"],
  decisoes: ["admin", "coordenacao", "decisoes", "admin_edicao"],
  encontristas: ["admin", "admin_edicao"],
  pessoas: ["admin"],
  organizacional: ["admin", "coordenacao", "financeiro", "estoque", "decisoes", "saude", "admin_edicao", "visitante"],
};

export const setoresDaEquipe = (a: Acesso | null) => (!a ? [] : a.perfil === "servo" ? [...(servoTem(a, "saude", "ver") ? ["Saúde"] : []), ...(servoTem(a, "secretaria", "ver") ? ["Secretaria 1"] : [])] : a.equipes.flatMap((e) => e.setores));

export function podeVer(a: Acesso | null, modulo: string): boolean {
  if (!a) return false;
  if (a.perfil === "servo") return modulo === "inicio" || (modulo === "setores" ? servoTem(a, "saude", "ver") || servoTem(a, "secretaria", "ver") : servoTem(a, modulo, "ver"));
  if (modulo !== "inicio" && modulo !== "setores" && MODULOS.some((m) => m.id === modulo) && !libera(a, modulo, "ver")) return false;
  if (modulo === "setores" && a.permissoes && !libera(a, "saude", "ver") && !libera(a, "secretaria", "ver")) return false;
  if (a.perfil === "secretaria1") return modulo === "inicio" || modulo === "setores";
  if (modulo === "estoque") return podeVerEstoque(a);
  if (modulo === "setores") return ["admin", "estoque", "saude", "admin_edicao", "secretaria1"].includes(a.perfil) || setoresDaEquipe(a).length > 0;
  const l = VE[modulo];
  return !l || l.includes(a.perfil);
}

export function podeEscrever(a: Acesso | null, modulo: string, setor?: string): boolean {
  if (!a) return false;
  if (a.perfil === "servo") return servoTem(a, modulo, "editar") || (modulo === "estoque" && !!setor && servoTem(a, "estoque", "ver") && setoresDaEquipe(a).includes(setor));
  if (MODULOS.some((m) => m.id === modulo) && !libera(a, modulo, "editar")) return false;
  const e = ESCREVE[a.perfil];
  if (e === "*" || e.includes(modulo)) return true;
  if (modulo === "estoque" && setor) return setoresDaEquipe(a).includes(setor);
  return false;
}

/** Ficha completa (planilha de encontristas): só administrador. */
export const podeVerFicha = (a: Acesso | null) => !!a && ["admin", "admin_edicao"].includes(a.perfil) && libera(a, "encontristas", "ver");
/** Importar a planilha dos encontristas. */
export const podeEditarFicha = (a: Acesso | null) => podeVerFicha(a) && !!a && libera(a, "encontristas", "editar");
/** Lista de saúde (somente dados de saúde): administrador e equipe de Saúde. */
export const podeVerSaude = (a: Acesso | null) => !!a && (servoTem(a, "saude", "ver") || ["admin", "saude", "admin_edicao", "secretaria1"].includes(a.perfil) && libera(a, "saude", "ver"));
/** Secretaria 1 (crachás e quartos): administrador ou quem está na equipe com esse setor. */
export const podeSecretaria = (a: Acesso | null) => !!a && (a.perfil === "servo" ? servoTem(a, "secretaria", "ver") : ["admin", "admin_edicao", "secretaria1"].includes(a.perfil) || setoresDaEquipe(a).includes("Secretaria 1")) && libera(a, "secretaria", "ver");
/** Estoque (geral e por setor). */
export const podeVerEstoque = (a: Acesso | null) => !!a && (servoTem(a, "estoque", "ver") || ["admin", "estoque", "admin_edicao"].includes(a.perfil) && libera(a, "estoque", "ver"));
/** Paiol: quem guarda o material, registra o envio e confere o balanço (administrador, coordenação, estoque; admin de edição nas edições dele). */
export const ehPaiol = (a: Acesso | null) => !!a && (servoTem(a, "estoque", "editar") || ["admin", "estoque", "admin_edicao"].includes(a.perfil) && libera(a, "estoque", "editar"));
/** Enviar material e fechar balanço: quem edita o setor, ou o admin de edição (na edição dele). */
export const podeEnviar = (a: Acesso | null, setor: string) => !!a && (podeEscrever(a, "estoque", setor) || a.perfil === "admin_edicao");

/** O que o perfil permite por padrão em cada área (sem restrições). Serve de ponto de partida das caixas de autorização. */
export function baseDoPerfil(perfil: Perfil): Permissoes {
  if (perfil === "servo") return { ver: MODULOS_SERVO, editar: MODULOS.filter((m) => m.editar && MODULOS_SERVO.includes(m.id)).map((m) => m.id) };
  const a: Acesso = { id: "", nome: "", email: "", perfil, equipes: [], permissoes: null };
  const ver = (id: string) => (id === "estoque" ? podeVerEstoque(a) : id === "encontristas" ? podeVerFicha(a) : id === "saude" ? podeVerSaude(a) : id === "secretaria" ? podeSecretaria(a) : podeVer(a, id));
  const editar = (id: string) => (id === "estoque" ? ehPaiol(a) || podeEscrever(a, "estoque") : id === "encontristas" ? podeVerFicha(a) : id === "secretaria" ? podeSecretaria(a) : id === "pessoas" ? perfil === "admin" : podeEscrever(a, id));
  const v = MODULOS.filter((m) => ver(m.id)).map((m) => m.id);
  return { ver: v, editar: MODULOS.filter((m) => m.editar && v.includes(m.id) && editar(m.id)).map((m) => m.id) };
}
/** Compara com o padrão do perfil: se não mudou nada, não guarda restrição. */
export const igualAoPadrao = (perfil: Perfil, p: Permissoes) => { if (perfil === "servo") return false; const b = baseDoPerfil(perfil); const eq = (x: string[], y: string[]) => x.length === y.length && x.every((i) => y.includes(i)); return eq(b.ver, p.ver) && eq(b.editar, p.editar); };
