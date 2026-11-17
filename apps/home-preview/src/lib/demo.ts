import {
  emptyWorkspace,
  now,
  recordBase,
  uid,
  type WorkspaceData,
  type AppUser,
} from "./domain";
export const previewUser: AppUser = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "preview@example.invalid",
  name: "김학생",
};
const dateAt = (offset: number) => {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
};
export function buildDemo(ownerId = previewUser.id): WorkspaceData {
  const data = emptyWorkspace();
  const rid = uid(),
    meetingId = uid(),
    previousId = uid(),
    time = now();
  const base = () => recordBase(rid);
  data.researches = [
    {
      id: rid,
      ownerId,
      name: "연구 도구 사용 경험",
      description: "대학원생의 연구 기록과 협업 경험을 살펴보는 가상 연구예요.",
      nextMeetingId: meetingId,
      createdAt: time,
      updatedAt: time,
    },
  ];
  const firstFeedback = {
    ...base(),
    title: "선행연구 비교 기준 보완",
    body: "선행연구를 나열하기보다 연구 목적에 맞는 비교 기준이 드러나도록 표를 보완하세요.",
    meetingId: previousId,
    sourceQuote: "연구 목적에 맞는 비교 기준이 표에 드러나야 합니다.",
    sourceMemoRevision: 1,
    status: "in_progress" as const,
    notes: "",
  };
  const secondFeedback = {
    ...base(),
    title: "연구 질문의 대상 구체화",
    body: "연구 질문에서 누구의 어떤 경험을 살펴보는지 명확히 적어 주세요.",
    meetingId: previousId,
    sourceQuote: "연구 질문은 누구의 어떤 경험을 보는지 구체화하세요.",
    sourceMemoRevision: 1,
    status: "recorded" as const,
    notes: "",
  };
  // 예외 화면 확인용: 보류·고치지 않음 상태와 아주 긴 제목.
  const heldFeedback = {
    ...base(),
    title: "참고문헌 표기 형식 통일",
    body: "참고문헌 형식은 다음 학기 투고 학술지가 정해지면 맞추기로 하고 지금은 보류해요.",
    meetingId: previousId,
    status: "held" as const,
    notes: "투고 학술지 결정 뒤 다시 보기",
  };
  const unchangedFeedback = {
    ...base(),
    title: "연구 제목에 ‘경험’ 대신 ‘인식’ 쓰기",
    body: "연구 목적이 경험을 살펴보는 것이라 제목은 그대로 두기로 했어요.",
    meetingId: previousId,
    status: "unchanged" as const,
    notes: "다음 미팅에서 이유를 설명하기",
  };
  const longTitleFeedback = {
    ...base(),
    title:
      "2장 이론적 배경에서 선행연구를 연구 대상·자료 수집 방법·분석 관점의 세 가지 기준으로 다시 묶고, 각 기준이 본 연구의 연구 질문과 어떻게 이어지는지 단락 끝마다 한 문장씩 덧붙여 주세요",
    body: "선행연구를 나열하지 말고 기준별로 묶은 뒤, 기준과 연구 질문의 연결을 드러내 주세요.",
    meetingId: previousId,
    status: "unprocessed" as const,
    notes: "",
  };
  data.feedback = [
    firstFeedback,
    secondFeedback,
    heldFeedback,
    unchangedFeedback,
    longTitleFeedback,
  ];
  data.tasks = [
    {
      ...base(),
      title: "선행연구 비교 기준 정리",
      description: "연구 목적·자료 수집·분석 관점을 기준으로 비교표 보완",
      status: "doing",
      dueDate: dateAt(2),
      priority: "high",
      feedbackIds: [firstFeedback.id],
    },
    {
      ...base(),
      title: "인터뷰 질문지 보완",
      description: "질문의 의도와 예상 답변 범위를 함께 정리",
      status: "todo",
      dueDate: dateAt(3),
      priority: "normal",
      feedbackIds: [],
    },
    {
      ...base(),
      title: "핵심 참고문헌 발췌 정리",
      description: "다음 미팅에서 설명할 근거 문장을 모으기",
      status: "done",
      dueDate: dateAt(0),
      priority: "normal",
      feedbackIds: [],
    },
    {
      // 예외 화면 확인용: 마감이 지난 할 일.
      ...base(),
      title: "연구 동의서 초안 작성",
      description: "인터뷰 참여자에게 드릴 연구 동의서 초안을 만들기",
      status: "todo",
      dueDate: dateAt(-5),
      priority: "high",
      feedbackIds: [],
    },
  ];
  data.questions = [
    {
      ...base(),
      meetingId,
      text: "비교 기준을 세 가지로 나눠도 괜찮을까요?",
      status: "open",
    },
    {
      ...base(),
      meetingId,
      text: "인터뷰 대상의 범위를 어디까지 포함할까요?",
      status: "open",
    },
  ];
  data.decisions = [
    {
      ...base(),
      meetingId: previousId,
      text: "다음 미팅에서는 비교표와 수정한 연구 질문을 함께 살펴본다.",
    },
  ];
  data.materials = [
    { ...base(), title: "선행연구 비교표", type: "draft" },
    { ...base(), title: "연구계획서", type: "draft" },
  ];
  data.versions = data.materials.map((material) => ({
    ...base(),
    materialId: material.id,
    number: 2,
    fileName:
      material.title === "선행연구 비교표"
        ? "선행연구_비교표_v2.pdf"
        : "연구계획서_v2.pdf",
    storagePath: "/demo/research-sample.pdf",
    size: 0,
    mimeType: "application/pdf",
  }));
  data.meetings = [
    {
      ...base(),
      id: meetingId,
      title: "제6차 논문 지도",
      date: dateAt(3),
      time: "14:00",
      status: "preparing",
      goal: "비교 기준이 드러나는 선행연구 표 보여주기",
      memo: "",
      memoRevision: 1,
      taskIds: data.tasks.map((t) => t.id),
      versionIds: [data.versions[0].id],
      questionIds: data.questions.map((q) => q.id),
    },
    {
      ...base(),
      id: previousId,
      title: "제5차 논문 지도",
      date: dateAt(-4),
      time: "14:00",
      status: "recorded",
      goal: "선행연구와 연구 질문 검토",
      memo:
        "연구 목적에 맞는 비교 기준이 표에 드러나야 합니다. 선행연구마다 연구 목적, 자료 수집, 분석 관점을 비교해 보세요. 연구 질문은 누구의 어떤 경험을 보는지 구체화하세요. 다음 미팅에는 비교표와 보완한 인터뷰 질문지를 가져오기로 했습니다. " +
        // 의도한 예외: 피드백·결정·잡담 어느 쪽으로도 읽힐 수 있는 모호한 문장.
        "참고문헌 형식은 일단 신경 쓰지 말고, 그건 다음 학기에 다시 보죠.",
      memoRevision: 1,
      taskIds: [],
      versionIds: [data.versions[0].id],
      questionIds: [],
    },
    {
      // 예외 화면 확인용: 지난 미팅인데 메모·녹음이 없음.
      ...base(),
      title: "제4차 논문 지도",
      date: dateAt(-11),
      time: "10:00",
      status: "preparing",
      goal: "연구 주제 범위 정하기",
      memo: "",
      memoRevision: 1,
      taskIds: [],
      versionIds: [],
      questionIds: [],
    },
    {
      // 예외 화면 확인용: 날짜를 아직 정하지 않은 미팅.
      ...base(),
      title: "제7차 논문 지도",
      date: null,
      time: null,
      status: "preparing",
      goal: "인터뷰 결과 초안 공유",
      memo: "",
      memoRevision: 1,
      taskIds: [],
      versionIds: [],
      questionIds: [],
    },
  ];
  data.results = [
    {
      ...base(),
      title: "선행연구 비교표 보완",
      description:
        "선행연구를 연구 목적·자료 수집·분석 관점으로 나누어 비교했습니다. 기존 표에 비교 기준 열과 기준 선정 이유를 추가했습니다.",
      feedbackIds: [firstFeedback.id],
      taskIds: [data.tasks[0].id],
      kind: "document",
      versionId: data.versions[0].id,
      location: "1페이지 · 비교 기준 표",
    },
    {
      ...base(),
      title: "연구 질문 구체화",
      description:
        "대학원생이 미팅 이후 연구 기록을 다시 정리하는 경험으로 연구 대상을 구체화했습니다.",
      feedbackIds: [secondFeedback.id],
      taskIds: [],
      kind: "document",
      versionId: data.versions[1].id,
      location: "2페이지 · 연구 질문",
    },
  ];
  const requestId = uid();
  data.reviews = [
    {
      ...base(),
      id: requestId,
      title: "선행연구·연구 질문 수정 결과",
      professorEmail: "professor@example.invalid",
      professorId: "00000000-0000-4000-8000-000000000002",
      status: "shared",
    },
  ];
  data.reviewItems = data.results.map((result) => ({
    id: uid(),
    requestId,
    resultId: result.id,
    title: result.title,
  }));
  data.rounds = data.reviewItems.map((item, index) => ({
    id: uid(),
    requestId,
    itemId: item.id,
    number: 1,
    title: data.results[index].title,
    description: data.results[index].description,
    feedbackExcerpt: data.feedback[index].body,
    versionId: data.versions[index].id,
    fileName: data.versions[index].fileName,
    storagePath: data.versions[index].storagePath,
    location: data.results[index].location,
    createdAt: time,
  }));
  data.responses = data.rounds.map((round, index) => ({
    id: uid(),
    roundId: round.id,
    userId: "00000000-0000-4000-8000-000000000002",
    result: index === 0 ? "changes_requested" : "confirmed",
    comment:
      index === 0
        ? "연구 목적에 맞는 비교 기준을 하나 더 보완해 주세요."
        : "수정한 연구 질문을 확인했습니다.",
    createdAt: time,
    updatedAt: time,
  }));
  return data;
}
