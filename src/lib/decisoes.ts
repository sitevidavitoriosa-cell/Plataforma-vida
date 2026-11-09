export type BotaoDec = { id: string; nome: string; cor: string; arq?: boolean };
export const DEC_DEF: BotaoDec[] = [
  { id: "aceitou", nome: "Aceitou Jesus", cor: "#1F6F5C" },
  { id: "batismo", nome: "Batismo", cor: "#2F6FA3" },
  { id: "lider", nome: "Líder de célula", cor: "#8A5A9E" },
  { id: "anfitriao", nome: "Anfitrião de célula", cor: "#B26A1E" },
];
export const DEC_CORES: [string, string][] = [["Verde", "#1F6F5C"], ["Azul", "#2F6FA3"], ["Roxo", "#8A5A9E"], ["Laranja", "#B26A1E"], ["Vermelho", "#B4442B"]];
