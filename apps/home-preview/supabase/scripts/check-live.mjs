#!/usr/bin/env node
// Explicit --apply only. Uses fictional data in the linked classroom project.
import { createClient } from "@supabase/supabase-js";
import { readFile, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
if (!process.argv.includes("--apply"))
  throw new Error(
    "가상 시연 기록을 생성합니다. 실행하려면 --apply를 지정하세요.",
  );
const config = Object.fromEntries(
  (await readFile(".env.local", "utf8"))
    .trim()
    .split("\n")
    .map((s) => s.split(/=(.*)/s).slice(0, 2)),
);
const url = process.env.SUPABASE_URL,
  key = config.VITE_SUPABASE_PUBLISHABLE_KEY;
if (
  !url ||
  !key ||
  !process.env.RMS_STUDENT_PASSWORD ||
  !process.env.RMS_PROFESSOR_PASSWORD
)
  throw new Error("비공개 시연 계정 환경을 설정하세요.");
const client = () =>
  createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const student = client(),
  professor = client(),
  anonymous = client(),
  checks = [];
const ok = (label) => {
  checks.push(label);
  console.log(`PASS ${label}`);
};
const rpc = async (c, name, args = {}) => {
  const r = await c.rpc(name, args);
  if (r.error) throw new Error(`${name}: ${r.error.message}`);
  return r.data;
};
const signIn = async (c, role) => {
  const { data, error } = await c.auth.signInWithPassword({
    email: process.env[`RMS_${role}_EMAIL`],
    password: process.env[`RMS_${role}_PASSWORD`],
  });
  assert.ifError(error);
  return data.user;
};
const studentUser = await signIn(student, "STUDENT");
await signIn(professor, "PROFESSOR");
ok("실제 학생·교수 이메일 로그인");
const anon = await anonymous.rpc("rms_bootstrap");
assert(anon.error);
ok("비로그인 계정의 데이터 접근 거부");
const stamp = () => new Date().toISOString(),
  researchId = randomUUID();
const base = () => ({
  id: randomUUID(),
  researchId,
  createdAt: stamp(),
  updatedAt: stamp(),
});
let research = await rpc(student, "rms_save_research", {
  p_value: {
    id: researchId,
    ownerId: studentUser.id,
    name: "연구 도구 사용 경험 · 가상 시연",
    description: "실제 연결 검증을 위해 만든 가상 연구입니다.",
    createdAt: stamp(),
    updatedAt: stamp(),
  },
});
const save = async (kind, value) =>
  rpc(student, "rms_save_record", { p_kind: kind, p_value: value });
let meeting = await save("meetings", {
  ...base(),
  title: "제5차 논문 지도",
  date: "2026-11-03",
  time: "14:00",
  status: "recorded",
  goal: "선행연구 비교 기준 검토",
  memo: "연구 목적에 맞는 비교 기준이 표에 드러나야 합니다. 연구 질문은 누구의 어떤 경험을 보는지 구체화하세요. 다음 미팅에는 비교표와 보완한 질문지를 가져오세요.",
  memoRevision: 1,
  taskIds: [],
  versionIds: [],
  questionIds: [],
});
let feedback = await save("feedback", {
  ...base(),
  meetingId: meeting.id,
  title: "선행연구 비교 기준 보완",
  body: "연구 목적에 맞는 비교 기준이 표에 드러나야 합니다.",
  sourceQuote: "연구 목적에 맞는 비교 기준이 표에 드러나야 합니다.",
  sourceMemoRevision: 1,
  sourceStart: 0,
  sourceEnd: 29,
  status: "unprocessed",
  notes: "교수에게 공개하지 않는 학생 메모",
});
let secondFeedback = await save("feedback", {
  ...base(),
  meetingId: meeting.id,
  title: "연구 질문 구체화",
  body: "연구 질문은 누구의 어떤 경험을 보는지 구체화하세요.",
  status: "unprocessed",
  notes: "",
});
let task = await save("tasks", {
  ...base(),
  title: "선행연구 비교 기준 정리",
  description: "연구 목적·자료 수집·분석 관점을 나누어 비교표 보완",
  status: "doing",
  dueDate: "2026-11-06",
  priority: "high",
  feedbackIds: [feedback.id],
});
let nextMeeting = await save("meetings", {
  ...base(),
  title: "제6차 논문 지도",
  date: "2026-11-06",
  time: "14:00",
  status: "preparing",
  goal: "비교 기준과 구체화한 연구 질문 설명",
  memo: "",
  memoRevision: 1,
  taskIds: [],
  versionIds: [],
  questionIds: [],
});
const question = {
  ...base(),
  meetingId: nextMeeting.id,
  text: "비교 기준 세 가지가 연구 목적에 적절한가요?",
  status: "open",
};
nextMeeting = await rpc(student, "rms_save_preparation", {
  p_meeting: { ...nextMeeting, taskIds: [task.id], questionIds: [question.id] },
  p_questions: [question],
});
research = await rpc(student, "rms_save_research", {
  p_value: { ...research, nextMeetingId: nextMeeting.id },
});
ok("미팅·메모·피드백·작업·질문을 같은 실제 기록으로 저장");
const material = await save("materials", {
  ...base(),
  title: "선행연구 비교표와 연구계획서",
  type: "draft",
});
const bytes = await readFile("public/demo/research-sample.pdf");
async function upload(number) {
  const version = {
    ...base(),
    materialId: material.id,
    number,
    fileName: `가상_연구계획서_v${number}.pdf`,
    size: bytes.length,
    mimeType: "application/pdf",
  };
  version.storagePath = `${studentUser.id}/${researchId}/${version.id}.pdf`;
  const { error } = await student.storage
    .from("research-files")
    .upload(version.storagePath, bytes, {
      contentType: "application/pdf",
      upsert: false,
    });
  assert.ifError(error);
  return save("versions", version);
}
const v2 = await upload(2);
let result1 = await save("results", {
  ...base(),
  title: "선행연구 비교표 보완",
  description:
    "연구 목적과 자료 수집·분석 관점이 보이도록 비교표를 정리했습니다.",
  feedbackIds: [feedback.id],
  taskIds: [task.id],
  kind: "document",
  versionId: v2.id,
  location: "1페이지 · 비교 기준 표",
});
const result2 = await save("results", {
  ...base(),
  title: "연구 질문 구체화",
  description: "대상과 경험이 드러나도록 연구 질문을 구체화했습니다.",
  feedbackIds: [secondFeedback.id],
  taskIds: [],
  kind: "document",
  versionId: v2.id,
  location: "2페이지 · 연구 질문",
});
const review = await rpc(student, "rms_create_review", {
  p_input: {
    researchId,
    title: "제5차 지도 반영 결과",
    professorEmail: process.env.RMS_PROFESSOR_EMAIL,
    resultIds: [result1.id, result2.id],
    requestKey: randomUUID(),
  },
});
let shared = await rpc(professor, "rms_bootstrap");
assert.equal(shared.researches.length, 0);
assert.equal(shared.feedback.length, 0);
assert.equal(shared.tasks.length, 0);
assert.equal(shared.rounds.filter((r) => r.requestId === review.id).length, 2);
const item1 = shared.reviewItems.find((i) => i.resultId === result1.id),
  item2 = shared.reviewItems.find((i) => i.resultId === result2.id),
  round1 = shared.rounds.find((r) => r.itemId === item1.id),
  round2 = shared.rounds.find((r) => r.itemId === item2.id);
const downloaded = await professor.storage
  .from("research-files")
  .download(v2.storagePath);
assert.ifError(downloaded.error);
assert.equal(downloaded.data.size, bytes.length);
ok("실제 PDF 업로드·지정 교수 다운로드·개인 메모 비공개");
const unreasoned = await professor.rpc("rms_respond", {
  p_input: { roundId: round1.id, result: "changes_requested", comment: "" },
});
assert(unreasoned.error);
await rpc(professor, "rms_respond", {
  p_input: {
    roundId: round1.id,
    result: "changes_requested",
    comment: "연구 목적에 맞는 비교 기준을 하나 더 보완해 주세요.",
  },
});
await rpc(professor, "rms_respond", {
  p_input: {
    roundId: round2.id,
    result: "confirmed",
    comment: "수정한 연구 질문을 확인했습니다.",
  },
});
ok("교수 항목별 다른 응답·추가 수정 이유 필수");
const studentResponse = await student.rpc("rms_respond", {
  p_input: { roundId: round1.id, result: "confirmed", comment: "" },
});
assert(studentResponse.error);
task = await save("tasks", { ...task, status: "done" });
let data = await rpc(student, "rms_bootstrap");
assert.equal(
  data.responses.find((r) => r.roundId === round1.id).result,
  "changes_requested",
);
assert.equal(data.tasks.find((t) => t.id === task.id).status, "done");
ok("학생 작업 완료와 교수 응답 분리·학생 교수 응답 거부");
const comment = await rpc(professor, "rms_comment", {
  p_input: {
    roundId: round1.id,
    body: "비교 기준의 선택 이유도 함께 적어 주세요.",
  },
});
await rpc(student, "rms_comment", {
  p_input: {
    roundId: round1.id,
    body: "선택 이유를 표 아래에 추가하겠습니다.",
    parentId: comment.id,
  },
});
const v3 = await upload(3);
result1 = await save("results", {
  ...result1,
  description: "비교 기준의 선택 이유를 표 아래에 추가했습니다.",
  versionId: v3.id,
});
await rpc(student, "rms_recheck", {
  p_input: {
    requestId: review.id,
    itemId: item1.id,
    resultId: result1.id,
    requestKey: randomUUID(),
  },
});
data = await rpc(student, "rms_bootstrap");
assert.equal(data.rounds.find((r) => r.id === round1.id).versionId, v2.id);
assert.equal(data.rounds.filter((r) => r.itemId === item1.id).length, 2);
assert.equal(data.rounds.filter((r) => r.itemId === item2.id).length, 1);
assert.equal(
  data.responses.find((r) => r.roundId === round2.id).result,
  "confirmed",
);
ok("v3 한 항목 재확인·v2 파일·다른 항목 응답 보존");
await rpc(student, "rms_set_sharing", {
  p_input: { requestId: review.id, status: "stopped" },
});
shared = await rpc(professor, "rms_bootstrap");
assert(!shared.reviews.some((r) => r.id === review.id));
assert(
  (await professor.storage.from("research-files").download(v3.storagePath))
    .error,
);
ok("공유 중지 후 자료·파일 접근 거부");
await rpc(student, "rms_set_sharing", {
  p_input: { requestId: review.id, status: "shared" },
});
const relog = client();
await signIn(relog, "STUDENT");
data = await rpc(relog, "rms_bootstrap");
assert(data.researches.some((r) => r.id === researchId));
assert(data.versions.some((v) => v.id === v3.id));
ok("새 세션 재로그인 뒤 실제 저장 유지");
const report = {
  checkedAt: stamp(),
  projectRef: "uudfezdytzwjabxmnwfa",
  researchId,
  reviewId: review.id,
  checks,
  notChecked: [
    "브라우저 로그인·키보드·반응형 전체",
    "실제 Gemini API",
    "Cloudflare Pages 배포",
    "제3의 실제 학생 계정 접근",
  ],
};
await writeFile(
  "supabase/live-check.local.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report));
await student.auth.signOut();
await professor.auth.signOut();
await relog.auth.signOut();
