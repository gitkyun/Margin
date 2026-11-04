import type {
  AIInput,
  AIResult,
  AppUser,
  EntityKind,
  EntityMap,
  Material,
  MaterialVersion,
  Meeting,
  Question,
  Research,
  ReviewRequest,
  ReviewResponse,
  WorkspaceData,
} from "./domain";
export interface WorkspaceContextValue {
  data: WorkspaceData;
  user: AppUser;
  mode: "preview" | "connected";
  loading: boolean;
  error: string | null;
  refreshError: string | null;
  refresh(): Promise<void>;
  savePreparation(meeting: Meeting, questions: Question[]): Promise<void>;
  responseHistory(roundId: string): Promise<ReviewResponse[]>;
  save<K extends EntityKind>(
    kind: K,
    value: EntityMap[K],
  ): Promise<EntityMap[K]>;
  remove(kind: EntityKind, id: string): Promise<void>;
  saveResearch(value: Research): Promise<Research>;
  upload(
    file: File,
    material: Material,
    onProgress?: (value: number) => void,
    signal?: AbortSignal,
  ): Promise<MaterialVersion>;
  openFile(version: MaterialVersion): Promise<Blob>;
  runAI(input: AIInput, signal?: AbortSignal): Promise<AIResult>;
  createReview(input: {
    researchId: string;
    title: string;
    professorEmail: string;
    resultIds: string[];
    requestKey?: string;
  }): Promise<ReviewRequest>;
  recheck(input: {
    requestId: string;
    itemId: string;
    resultId: string;
    requestKey?: string;
  }): Promise<void>;
  respond(input: {
    roundId: string;
    result: "confirmed" | "changes_requested";
    comment: string;
  }): Promise<void>;
  comment(input: {
    roundId: string;
    body: string;
    parentId?: string;
  }): Promise<void>;
  resolveComment(id: string, resolved: boolean): Promise<void>;
  setSharing(
    requestId: string,
    status: "shared" | "stopped",
    professorEmail?: string,
  ): Promise<void>;
  markRead(roundId: string): Promise<void>;
  seedDemo(): Promise<string>;
  signOut(): Promise<void>;
}
