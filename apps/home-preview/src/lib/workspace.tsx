import { createContext, useContext, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { buildDemo } from "./demo";
import { assertConnected, friendlyError } from "./supabase";
import {
  executeAI,
  getFile,
  loadConnected,
  loadPreview,
  rpc,
  saveRecord,
  snapshotForResult,
  updatePreview,
  uploadFile,
  UploadConnectionError,
} from "./repository";
import {
  emptyWorkspace,
  now,
  uid,
  type AppUser,
  type EntityKind,
  type EntityMap,
  type Research,
  type ReviewRequest,
  type ReviewResponse,
  type WorkspaceData,
} from "./domain";
import type { WorkspaceContextValue } from "./workspace-contract";
// Preview follows the server's conflict rule instead of silently replacing another tab's edit.
function assertUnchanged(
  current: { updatedAt: string } | undefined,
  incoming: { updatedAt: string },
) {
  if (current && current.updatedAt !== incoming.updatedAt)
    throw new Error(
      "다른 창에서 이 기록을 수정했습니다. 작성한 내용은 유지됩니다. 최신 기록을 확인한 뒤 다시 저장해 주세요.",
    );
}
const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);
export function WorkspaceProvider({
  user,
  mode,
  children,
}: {
  user: AppUser;
  mode: "preview" | "connected";
  children: ReactNode;
}) {
  const cache = useQueryClient(),
    key = ["workspace", mode, user.id];
  const query = useQuery({
    queryKey: key,
    queryFn: mode === "preview" ? loadPreview : loadConnected,
    staleTime: 15000,
    refetchOnWindowFocus: true,
    refetchInterval: mode === "connected" ? 30000 : false,
    retry: 1,
  });
  const refresh = async () => {
    await cache.invalidateQueries({ queryKey: key });
  };
  const localChange = async (change: (data: WorkspaceData) => void) => {
    const data = await updatePreview(change);
    cache.setQueryData(key, data);
    return data;
  };
  async function save<K extends EntityKind>(
    kind: K,
    value: EntityMap[K],
  ): Promise<EntityMap[K]> {
    if (mode === "connected") {
      const result = await saveRecord(kind, value);
      await refresh();
      return result;
    }
    const updated = {
      ...value,
      createdBy: value.createdBy ?? user.id,
      updatedBy: user.id,
      updatedAt: now(),
      ...(kind === "documents"
        ? { revision: ((value as EntityMap["documents"]).revision ?? 0) + 1 }
        : {}),
      ...(kind === "documentVersions"
        ? {
            number:
              1 +
              (query.data?.documentVersions
                .filter(
                  (v) =>
                    v.documentId ===
                    (value as EntityMap["documentVersions"]).documentId,
                )
                .reduce((n, v) => Math.max(n, v.number), 0) ?? 0),
          }
        : {}),
    };
    await localChange((data) => {
      const list = data[kind] as EntityMap[K][];
      const index = list.findIndex((item) => item.id === value.id);
      if (index < 0) list.push(updated);
      else {
        assertUnchanged(list[index], value);
        list[index] = updated;
      }
    });
    return updated;
  }
  async function saveResearch(value: Research) {
    if (!value.name.trim()) throw new Error("연구 이름을 적어 주세요.");
    if (mode === "connected") {
      const result = await rpc<Research>("rms_save_research", {
        p_value: value,
      });
      await refresh();
      return result;
    }
    const updated = { ...value, updatedAt: now() };
    await localChange((data) => {
      const index = data.researches.findIndex((r) => r.id === value.id);
      if (index < 0) data.researches.push(updated);
      else {
        assertUnchanged(data.researches[index], value);
        data.researches[index] = updated;
      }
    });
    return updated;
  }
  const value: WorkspaceContextValue = {
    data: query.data ?? emptyWorkspace(),
    user,
    mode,
    loading: query.isLoading,
    error: !query.data && query.error ? friendlyError(query.error) : null,
    refreshError: query.data && query.error ? friendlyError(query.error) : null,
    refresh,
    save,
    saveResearch,
    async savePreparation(meeting, questions) {
      if (mode === "connected") {
        await rpc("rms_save_preparation", {
          p_meeting: meeting,
          p_questions: questions,
        });
        await refresh();
        return;
      }
      await localChange((data) => {
        for (const question of questions) {
          const at = data.questions.findIndex((q) => q.id === question.id);
          if (at < 0) data.questions.push(question);
          else {
            assertUnchanged(data.questions[at], question);
            data.questions[at] = { ...question, updatedAt: now() };
          }
        }
        const index = data.meetings.findIndex((m) => m.id === meeting.id);
        if (index < 0) throw new Error("미팅을 찾을 수 없습니다.");
        assertUnchanged(data.meetings[index], meeting);
        data.meetings[index] = { ...meeting, updatedAt: now() };
      });
    },
    async remove(kind, id) {
      if (mode === "connected") {
        await rpc("rms_delete_record", { p_kind: kind, p_id: id });
        await refresh();
        return;
      }
      await localChange((data) => {
        const record = (
          data[kind] as { id: string; archivedAt?: string }[]
        ).find((r) => r.id === id);
        if (record) record.archivedAt = now();
      });
    },
    async upload(file, material, onProgress, signal) {
      const version = await uploadFile(
        file,
        material,
        user.id,
        mode,
        onProgress,
        signal,
      );
      version.number =
        (query.data?.versions
          .filter((v) => v.materialId === material.id)
          .reduce((max, v) => Math.max(max, v.number), 0) ?? 0) + 1;
      try {
        return await save("versions", version);
      } catch {
        throw new UploadConnectionError(version);
      }
    },
    openFile: (version) => getFile(version, mode),
    runAI: async (input, signal) => {
      try {
        return await executeAI(input, signal);
      } finally {
        await refresh();
      }
    },
    async createReview(input) {
      if (mode === "connected") {
        const result = await rpc<ReviewRequest>("rms_create_review", {
          p_input: input,
        });
        await refresh();
        return result;
      }
      let result: ReviewRequest | null = null;
      await localChange((data) => {
        if (!input.resultIds.length)
          throw new Error("검토할 수정 결과를 선택해 주세요.");
        const time = now();
        result = {
          id: uid(),
          researchId: input.researchId,
          title: input.title,
          professorEmail: input.professorEmail,
          status: "shared",
          createdAt: time,
          updatedAt: time,
        };
        data.reviews.push(result);
        for (const resultId of input.resultIds) {
          const record = data.results.find(
            (r) => r.id === resultId && r.researchId === input.researchId,
          );
          if (!record) throw new Error("수정 결과를 찾을 수 없습니다.");
          const item = {
            id: uid(),
            requestId: result.id,
            resultId,
            title: record.title,
          };
          const round = snapshotForResult(
            data,
            result.id,
            item.id,
            resultId,
            1,
          );
          data.reviewItems.push(item);
          data.rounds.push(round);
        }
      });
      return result!;
    },
    async recheck(input) {
      if (mode === "connected") {
        await rpc("rms_recheck", { p_input: input });
        await refresh();
        return;
      }
      await localChange((data) => {
        const request = data.reviews.find((r) => r.id === input.requestId);
        if (!request || request.status !== "shared")
          throw new Error("공유 중인 검토에서 재확인을 요청할 수 있습니다.");
        const rounds = data.rounds.filter((r) => r.itemId === input.itemId);
        data.rounds.push(
          snapshotForResult(
            data,
            input.requestId,
            input.itemId,
            input.resultId,
            Math.max(...rounds.map((r) => r.number), 0) + 1,
          ),
        );
      });
    },
    async respond(input) {
      if (mode === "preview")
        throw new Error(
          "교수 응답은 실제 교수 계정으로 로그인한 뒤 남길 수 있습니다.",
        );
      await rpc("rms_respond", { p_input: input });
      await refresh();
    },
    async comment(input) {
      if (!input.body.trim()) throw new Error("댓글을 적어 주세요.");
      if (mode === "connected") {
        await rpc("rms_comment", { p_input: input });
        await refresh();
        return;
      }
      await localChange((data) =>
        data.comments.push({
          id: uid(),
          roundId: input.roundId,
          userId: user.id,
          authorName: user.name,
          body: input.body,
          parentId: input.parentId,
          resolved: false,
          createdAt: now(),
        }),
      );
    },
    async resolveComment(id, resolved) {
      if (mode === "connected") {
        await rpc("rms_resolve_comment", { p_id: id, p_resolved: resolved });
        await refresh();
        return;
      }
      await localChange((data) => {
        const comment = data.comments.find((c) => c.id === id);
        if (comment) comment.resolved = resolved;
      });
    },
    async setSharing(requestId, status, professorEmail) {
      if (mode === "connected") {
        await rpc("rms_set_sharing", {
          p_input: { requestId, status, professorEmail },
        });
        await refresh();
        return;
      }
      await localChange((data) => {
        const request = data.reviews.find((r) => r.id === requestId);
        if (request) {
          request.status = status;
          if (professorEmail) request.professorEmail = professorEmail;
          request.updatedAt = now();
        }
      });
    },
    async markRead(roundId) {
      if (mode === "connected") {
        await rpc("rms_mark_read", { p_round_id: roundId });
        await refresh();
        return;
      }
      await localChange((data) => {
        const index = data.reads.findIndex(
          (r) => r.roundId === roundId && r.userId === user.id,
        );
        const read = { roundId, userId: user.id, lastSeenAt: now() };
        if (index < 0) data.reads.push(read);
        else data.reads[index] = read;
      });
    },
    async responseHistory(roundId) {
      return mode === "connected"
        ? rpc<ReviewResponse[]>("rms_response_history", { p_round_id: roundId })
        : [];
    },
    async seedDemo() {
      if (mode === "preview") {
        let id = "";
        await localChange((data) => {
          const demo = buildDemo(user.id);
          Object.assign(data, demo);
          id = demo.researches[0].id;
        });
        return id;
      }
      const demo = buildDemo(user.id);
      const research = demo.researches[0];
      delete research.nextMeetingId;
      const created = await saveResearch(research);
      const meeting = {
        ...demo.meetings[1],
        taskIds: [],
        versionIds: [],
        questionIds: [],
      };
      await save("meetings", meeting);
      return created.id;
    },
    async signOut() {
      if (mode === "connected") {
        const { error } = await assertConnected().auth.signOut({
          scope: "local",
        });
        if (error)
          throw new Error(
            "로그아웃하지 못했습니다. 연결을 확인한 뒤 다시 시도해 주세요.",
          );
      }
      cache.clear();
    },
  };
  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}
export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) throw new Error("작업 공간을 불러오지 못했습니다.");
  return context;
}
