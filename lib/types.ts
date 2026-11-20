export type Member = { id: number; name: string; email: string };

export type Task = {
  id: string;
  name: string;
  url: string;
  status: string;
  statusType: string; // ClickUp status.type: open | custom | done | closed | unstarted
  done: boolean;
  closed: boolean;
  blocked: boolean;
  assignees: { id: number; name: string }[];
  start: string | null; // YYYY-MM-DD
  due: string | null;
  estimateH: number;
  spentH: number;
  created: string;
  updated: string;
  parent: string | null;
  typeName: string; // "Task" | "Milestone" | "Overview" | "Risk" | ...
  tags: string[];
  listId: string;
  projectKey: string;
  listName: string;
  folderId: string | null;
  folderName: string | null;
  spaceId: string;
  team: string | null;
  client: string | null;
  projectType: string | null;
  qa: boolean | null;
  fields: Record<string, string | number | boolean | null>; // all custom fields by lower-case name
};

export type Entry = {
  id: string;
  userId: number;
  userName: string;
  taskId: string | null;
  taskName: string;
  hours: number;
  billable: boolean;
  date: string; // YYYY-MM-DD
  listId: string | null;
  listName: string | null;
  folderName: string | null;
  spaceId: string | null;
};

export type RawData = {
  members: Member[];
  tasks: Task[];
  entries: Entry[];
  fetchedAt: number;
  demo: boolean;
  stale: boolean;
  warning: string | null;
  fieldsSeen: string[];
  fieldsMissing: string[];
};
