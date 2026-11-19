export type Color =
  | "default"
  | "gray"
  | "brown"
  | "orange"
  | "yellow"
  | "green"
  | "blue"
  | "purple"
  | "pink"
  | "red";

export type Option = { name: string; color: Color };

export type Prop =
  | { key: string; name: string; type: "text" | "date" | "person" | "url" }
  | { key: string; name: string; type: "select" | "status"; options: Option[] }
  | { key: string; name: string; type: "relation"; inverseOf?: string };

export type View = {
  id: string;
  name: string;
  type: "table" | "board" | "timeline" | "calendar";
  dateProp?: string;
  groupBy?: string;
  sortBy?: string;
  hideDone?: boolean;
};

export type DbId = "tarefas" | "projetos" | "documentos";

export type DbDef = {
  id: DbId;
  name: string;
  singular: string;
  icon: string;
  titleName: string;
  props: Prop[];
  views: View[];
  doneStatus?: string;
  autoUnblock?: { blockedBy: string; blocked: string; reopenTo: string };
};

export type DateValue = { start: string; end?: string | null };

export type PageRow = {
  id: string;
  db: string;
  title: string;
  icon: string | null;
  parent_id: string | null;
  props: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type PageFull = PageRow & { content: unknown[] | null; content_md: string | null };

export type User = { id: string; name: string; email: string | null };

export const PROJECT_TAGS: Option[] = [
  { name: "Liga-te à Habitação", color: "blue" },
  { name: "Assembleia Geral", color: "purple" },
  { name: "Sede e obra", color: "brown" },
  { name: "Viagem a Cracóvia", color: "orange" },
  { name: "Fóruns Jovens e OPJ", color: "yellow" },
  { name: "Jovens pelo Ambiente", color: "green" },
  { name: "Natal e eventos 2026", color: "red" },
  { name: "Gabinete de Juventude", color: "pink" },
  { name: "Financiamento", color: "green" },
  { name: "Administração", color: "gray" },
  { name: "Podcast", color: "purple" },
  { name: "Erasmus+", color: "blue" },
  { name: "Voluntariado", color: "pink" },
  { name: "Sistemas e app", color: "default" },
  { name: "Lar de Altura", color: "orange" },
  { name: "Escolhas", color: "red" },
];

export const DBS: Record<DbId, DbDef> = {
  tarefas: {
    id: "tarefas",
    name: "Tarefas",
    singular: "tarefa",
    icon: "square-check",
    titleName: "Tarefa",
    doneStatus: "Feita",
    autoUnblock: { blockedBy: "bloqueada_por", blocked: "Bloqueada", reopenTo: "Por fazer" },
    props: [
      {
        key: "estado",
        name: "Estado",
        type: "status",
        options: [
          { name: "Por fazer", color: "gray" },
          { name: "Em curso", color: "blue" },
          { name: "Bloqueada", color: "orange" },
          { name: "Feita", color: "green" },
        ],
      },
      {
        key: "prioridade",
        name: "Prioridade",
        type: "select",
        options: [
          { name: "Urgente", color: "red" },
          { name: "Quente", color: "orange" },
          { name: "Importante", color: "yellow" },
          { name: "A acompanhar", color: "gray" },
        ],
      },
      { key: "responsavel", name: "Responsável", type: "person" },
      { key: "prazo", name: "Prazo", type: "date" },
      { key: "projeto", name: "Projeto", type: "select", options: PROJECT_TAGS },
      { key: "notas", name: "Notas", type: "text" },
      { key: "bloqueada_por", name: "Bloqueada por", type: "relation" },
      { key: "bloqueia", name: "Bloqueia", type: "relation", inverseOf: "bloqueada_por" },
    ],
    views: [
      { id: "ativas", name: "Ativas", type: "table", sortBy: "prazo", hideDone: true },
      { id: "quadro", name: "Quadro", type: "board", groupBy: "estado" },
      { id: "por-projeto", name: "Por projeto", type: "table", groupBy: "projeto", sortBy: "prazo" },
      { id: "por-pessoa", name: "Por responsável", type: "board", groupBy: "responsavel", hideDone: true },
      { id: "linha", name: "Linha do tempo", type: "timeline", dateProp: "prazo", groupBy: "projeto" },
      { id: "calendario", name: "Calendário", type: "calendar", dateProp: "prazo" },
      { id: "todas", name: "Todas", type: "table", sortBy: "prazo" },
    ],
  },
  projetos: {
    id: "projetos",
    name: "Projetos",
    singular: "projeto",
    icon: "folder",
    titleName: "Projeto",
    doneStatus: "Concluído",
    props: [
      {
        key: "estado",
        name: "Estado",
        type: "status",
        options: [
          { name: "Em preparação", color: "gray" },
          { name: "Em curso", color: "blue" },
          { name: "Concluído", color: "green" },
        ],
      },
      {
        key: "prioridade",
        name: "Prioridade",
        type: "select",
        options: [
          { name: "Alta", color: "red" },
          { name: "Média", color: "yellow" },
          { name: "Baixa", color: "green" },
        ],
      },
      { key: "responsavel", name: "Responsável", type: "person" },
      { key: "datas", name: "Datas", type: "date" },
      { key: "resumo", name: "Resumo", type: "text" },
      { key: "etiqueta", name: "Etiqueta", type: "select", options: PROJECT_TAGS },
    ],
    views: [
      { id: "quadro", name: "Quadro", type: "board", groupBy: "estado" },
      { id: "tabela", name: "Tabela", type: "table", sortBy: "prioridade" },
      { id: "linha", name: "Linha do tempo", type: "timeline", dateProp: "datas" },
      { id: "calendario", name: "Calendário", type: "calendar", dateProp: "datas" },
    ],
  },
  documentos: {
    id: "documentos",
    name: "Documentos",
    singular: "documento",
    icon: "file-text",
    titleName: "Documento",
    props: [
      {
        key: "tipo",
        name: "Tipo",
        type: "select",
        options: [
          { name: "Ata e convocatória", color: "purple" },
          { name: "Plano", color: "blue" },
          { name: "Protocolo", color: "orange" },
          { name: "Cartaz e imagem", color: "pink" },
          { name: "Guião e programa", color: "yellow" },
          { name: "Candidatura", color: "green" },
          { name: "Declaração", color: "gray" },
          { name: "Caderno de encargos", color: "brown" },
          { name: "Ficha", color: "default" },
          { name: "Proposta", color: "red" },
          { name: "Texto", color: "default" },
        ],
      },
      {
        key: "estado",
        name: "Estado",
        type: "select",
        options: [
          { name: "Rascunho", color: "gray" },
          { name: "Em revisão", color: "yellow" },
          { name: "Final", color: "green" },
        ],
      },
      { key: "projeto", name: "Projeto", type: "select", options: PROJECT_TAGS },
      { key: "ligacao", name: "Ligação", type: "url" },
      { key: "atualizado", name: "Atualizado", type: "date" },
    ],
    views: [
      { id: "por-projeto", name: "Por projeto", type: "table", groupBy: "projeto", sortBy: "atualizado" },
      { id: "tabela", name: "Tabela", type: "table", sortBy: "atualizado" },
    ],
  },
};

export const DB_LIST = [DBS.projetos, DBS.tarefas, DBS.documentos];

export function isDbId(x: string): x is DbId {
  return x in DBS;
}
