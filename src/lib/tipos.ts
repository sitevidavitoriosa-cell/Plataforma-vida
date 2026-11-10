export type Item = { id: string; nome: string; setor: string; un: string; qtd: number; min: number; cons: boolean; preco: number; obs: string | null; alugado?: boolean };
export type Edicao = { id: string; nome: string; data_ini: string | null; data_fim: string | null; local: string | null; resp: string | null; enc: number; status: "planejada" | "aberta" | "fechada"; tipo: "rede" | "base" | "kids" | "beone"; cor: string | null; rede2: string | null; dados_limpos_em?: string | null };
export type Envio = { edicao_id: string; item_id: string; env: number; comp: number; volta: number | null; aplicado: number | null; informado?: boolean; volta_informada?: number | null };
export type Equipe = { id: string; nome: string; setores: string[] };
export type Pessoa = { id: string; user_id: string | null; nome: string; email: string; perfil: string; ativo: boolean; telefone: string | null; codigo: string | null; codigo_expira: string | null; equipe_membros: { equipe_id: string }[]; pessoa_edicoes?: { edicao_id: string }[] };

export const fmtN = (n: number | null | undefined) => (n == null ? "0" : Number.isInteger(Number(n)) ? String(n) : String(Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 2 })));
export const norm = (t: string) => (t || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
export const num = (t: string): number => { const v = Number(String(t).replace(/\./g, "").replace(",", ".")); return isFinite(v) ? v : NaN; };
export const dmy = (d: string | null) => (d ? d.split("-").reverse().join("/") : "");
export const brl = (n: number) => Number(n || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
