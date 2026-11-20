# 08. 데이터

새 화면이 지금의 저장 구조 위에서 어떻게 동작하는지 정합니다. **1차 범위(1~5단계)에서는 DB 마이그레이션을 하지 않습니다.** 서버에서 바뀌는 것은 Edge Function `ai-assist`의 코드뿐입니다.

## 1. 전제 [사실]

- 연구 안의 기록은 `rms_records(kind, data jsonb)` 한 표에 종류(`kind`)별로 들어갑니다. `data`에 모르는 키를 넣어도 그대로 보존됩니다. 그래서 **새 필드는 마이그레이션 없이** 넣을 수 있습니다. 한 줄은 1MB까지입니다.
- 새 `kind`를 만들려면 `rms_records_kind_check`와 `rms_save_record` 전체를 다시 정의하는 마이그레이션이 필요합니다. 그래서 새 종류를 만들지 않습니다.
- 연구 정보도 `rms_save_research`가 받은 `p_value`를 거의 그대로 `data`에 넣습니다(`supabase/migrations/20261107001631_restore_research_references.sql`에서 확인. 이후 마이그레이션이 다시 정의했을 수 있으니 구현 전에 최신 정의를 대조).
- 화면은 `rms_bootstrap()` 한 번으로 전부 불러오고(React Query, 30초마다 다시), 저장하면 전체를 다시 불러옵니다. 저장 충돌은 `updatedAt` 비교로 막습니다(SQLSTATE 40001).
- 미리보기 모드는 같은 모양의 데이터를 IndexedDB(`rms-preview-v1`)에 둡니다. 새 키도 그대로 저장됩니다. AI는 미리보기에서 실행되지 않습니다.
- 필드 이름의 기준은 `apps/home-preview/src/lib/domain.ts`입니다.

## 2. 화면의 말과 저장 이름

| 화면 | 저장 | 비고 |
|---|---|---|
| 기록(미팅) | `meetings` 한 줄, `recordType` 없음 또는 `'meeting'` | 지금과 같음 |
| 기록(서면 피드백) | `meetings` 한 줄, `recordType: 'written'` | 새 키. `status`는 처음부터 `'recorded'`, `memo`가 붙여 넣은 글 |
| 검토 요청 줄 | `reviews` + `reviewItems` + `rounds` + `responses` | 저장은 그대로. 미팅 목록에 **보여 주기만** 함 |
| 조율 중 줄 | `polls`(`status: 'open'`) | 위와 같음 |
| 원문 › 전사 | `recordings` + `rms_live_transcripts`(본인만) | 그대로 |
| 원문 › 메모 | `meetings.memo`, `memoRevision` | 그대로 |
| 형광펜(전사) | `recordings.transcriptMarks[]` | 그대로 |
| 형광펜(메모) | `meetings.memoMarks[]` | 새 키 |
| 피드백 / 결정 / 질문 | `feedback` / `decisions` / `questions` | 그대로. 결정·질문에 원문 위치 키 추가(§3.3) |
| 할 일 | `tasks` | 원문 위치·글 위치 키 추가(§3.4) |
| 수정 방법 | `plans` | 그대로 |
| 수정 결과 | `results` | 그대로 |
| 요약 | `meetings.summary` | 새 키 |
| AI 제안 | `aiCandidates`(`status: 'pending'`) | 그대로. 종류 두 개 추가(§5.2) |
| 글 | `documents`, `documentVersions` | 새 키 넷(§3.5) |
| 자료 | `materials`, `versions`, `folders` | 그대로 |
| 연구 도우미 대화 | `conversations` | 새 키 하나(§3.6) |
| 연구 흐름 | `phases`, `milestones` | 그대로 |
| 알림 | `events` | 그대로 |

## 3. 새로 쓰는 키

모두 선택(optional)입니다. 키가 없는 예전 기록은 '기본값' 열대로 읽습니다. 타입은 `domain.ts`에 추가합니다.

### 3.1 `meetings`

```ts
type TextMark = { start: number; end: number; hash: string }; // TranscriptMark와 같은 모양

interface Meeting {
  recordType?: "meeting" | "written";            // 기본 "meeting"
  sourceLabel?: "kakao" | "email" | "doc_comment" | "note" | "file" | "other"; // 서면 피드백만
  sourceFileName?: string;                       // 파일에서 가져왔을 때의 이름(표시용)
  memoMarks?: TextMark[];                        // 메모 형광펜. 200개까지
  documentIds?: ID[];                            // 준비: 보여 줄 글(지금 versionIds는 자료 버전만 담음)
  summary?: {
    text: string;                                // 3,000자까지
    runId: ID; model: string; createdAt: string; // 어느 실행에서 나왔는지
    basedOn: { memoRevision?: number; recordingId?: ID };
    editedAt?: string;                           // 사용자가 고쳤으면
  };
}
```

- `memoMarks`의 `hash`는 그 범위 글자의 해시입니다. 메모는 0.8초마다 저장되므로 앞부분을 고칠 때마다 뒤 표시가 어긋납니다. 그래서 **메모를 저장할 때** 해시가 맞지 않는 표시는 같은 글자를 새 메모에서 찾아(원래 자리에서 가장 가까운 곳) `start`·`end`를 옮겨 함께 저장하고, 찾지 못한 것만 그리지 않고 남겨 둡니다. 200개 한도는 화면에서만 셉니다(서버 검사 없음). 전사 형광펜은 전사가 거의 바뀌지 않으므로 지금 규칙(해시가 다르면 그리지 않음) 그대로입니다.
- 서면 피드백은 `date`에 받은 날, `time`은 `null`, `goal`은 빈 문자열, `taskIds`·`versionIds`·`questionIds`는 빈 배열로 만듭니다.

### 3.2 `researches`

```ts
interface Research {
  meetingRecurrence?: { weekday: 0 | 1 | 2 | 3 | 4 | 5 | 6; time: string /* "HH:mm" */; everyWeeks: 1 | 2 | 3 | 4 };
}
```

'다음 미팅 잡기' 창의 날짜를 미리 채우는 데만 씁니다. 미팅을 자동으로 만들지 않습니다.

### 3.3 `decisions`, `questions`

`feedback`이 이미 가진 원문 위치 키를 같은 이름으로 씁니다: `sourceQuote?`, `sourceStart?`, `sourceEnd?`, `sourceMemoRevision?`, `audioSource?`. [사실, 코드 확인] 지금 코드는 결정·질문에 원문 위치를 저장하지 않고, 원문에서 만든 피드백도 `audioSource`만 저장합니다(`MeetingsPage.tsx` 842~944행 부근). 새로 넣습니다.

**메모에서 만든 것과 전사에서 만든 것은 저장하는 키가 다릅니다.** [사실] 서버(`rms_save_record`, `20261112000000_r2_file_storage.sql` 152~154행)는 피드백의 `sourceQuote`를 **미팅 메모 안에서** 찾고, 없으면 저장을 거절(40001)하며, 같은 글이 두 번 나오면 첫 자리로 위치를 다시 계산합니다.

| 어디서 골랐나 | 저장하는 키 |
|---|---|
| 메모 | `sourceQuote`, `sourceStart`, `sourceEnd`, `sourceMemoRevision`(서버가 첫 일치 자리로 위치를 다시 맞춤. 같은 글이 메모에 두 번 있으면 밑줄이 앞쪽에 붙을 수 있음) |
| 전사 | `audioSource`(녹음 id·시작·끝)와 표시용 `transcriptQuote`(고른 글, 2,000자까지). **`sourceQuote`는 넣지 않음** |

`transcriptQuote?: string`은 `feedback`·`decisions`·`questions`·`tasks`에 새로 생기는 선택 키입니다.

### 3.4 `tasks`

```ts
interface Task {
  sourceRecordId?: ID;        // 기록 화면에서 바로 만든 할 일의 출처 기록
  sourceQuote?: string; sourceStart?: number; sourceEnd?: number;
  sourceMemoRevision?: number;                              // 메모에서 골라 만들었을 때
  audioSource?: AudioSource; transcriptQuote?: string;     // 전사에서 골라 만들었을 때(§3.3)
  documentId?: ID;            // 이 할 일로 고칠 글
  sectionAnchor?: string;     // 글의 어느 제목 아래인지(제목 글자)
}
```

### 3.5 `documents`

```ts
interface DocumentRecord {
  origin?: "manual" | "ai";   // 연구 도우미 답변을 글로 저장했으면 "ai". 기본 "manual"
  draftedFrom?: AIContext[];  // 초안의 근거로 쓴 기록(종류·id·제목만. 본문은 담지 않음)
  humanEditedAt?: string;     // origin이 "ai"인 글을 사람이 처음 고친 시각
  folderId?: ID;              // 자료와 같은 폴더에 넣기
}
```

`type`은 지금 값(`plan` 계획서, `manuscript` 원고, `note`)을 그대로 씁니다. 연구 도우미가 만든 초안과 '메모' 글은 `note`입니다.

### 3.6 `conversations`

```ts
interface AIConversation {
  scope?: { kind: "record" | "document"; id: ID }; // 어느 화면에서 시작한 대화인지. 없으면 연구 전체
}
```

대화 목록에서 "이 기록의 대화"를 먼저 보여 주는 데 씁니다.

### 3.7 계정 설정

`user_metadata.preferences.panelSide`: `"right"`(기본) | `"left"`. 지금 설정들과 같은 평평한 키입니다(`pages/settings/use-preferences.ts`).

## 4. 계산 규칙

저장하지 않고 화면이 그때그때 계산하는 값입니다. 한 파일(`lib/record-view.ts`, 새로 만듦)에 순수 함수로 두고 테스트를 붙입니다.

### 4.0 미팅과 서면 피드백 가르기

서면 피드백도 `meetings`에 저장하므로, 지금 미팅을 세는 곳이 서면 피드백까지 세지 않게 해야 합니다.

```ts
isMeetingRecord(m) = (m.recordType ?? "meeting") === "meeting"
```

| 쓰는 곳 | 규칙 |
|---|---|
| 다음 미팅 고르기(§4.1), 달력·연구 흐름의 미팅 표시, 홈 '미팅 준비하기', 시작하기의 '미팅 기록 남기기' 완료 판단, 미팅 주기의 기준일, 메뉴 미리보기 '다음 미팅' | `isMeetingRecord`인 것만 |
| 미팅 목록, 홈 '최근 미팅', 찾기 창 '최근 본 기록', 넘어온 할 일(§4.5) | 둘 다 |

구현할 때 `meetings`를 읽는 모든 곳을 찾아(`grep -rn "\.meetings" src`) 위 표 중 어디에 해당하는지 정합니다.

### 4.1 다음 미팅

지금 규칙(`lib/home-meeting.ts`의 `selectNextMeeting`)을 그대로 씁니다. [사실, 코드 확인 2026-11-16]

- 대상: 보관하지 않은 미팅 중 `status === 'recording'`이거나, `status === 'preparing'`이면서 날짜가 오늘(서울 기준) 이후이거나 없는 것.
- 고르는 순서: ① 녹음 중 ② `research.nextMeetingId`가 가리키는 것(대상 안에 있을 때만) ③ 날짜·시각이 가까운 순(날짜 없는 것은 뒤).
- 기록 완료·취소·날짜가 지난 준비 중 미팅은 다음 미팅이 되지 않습니다. 날짜가 지난 준비 중 미팅은 홈의 '지난 미팅 기록 없음'([03](03-home.md) §3)이 따로 잡습니다.

### 4.2 미팅 목록의 줄

```
줄 = 보관하지 않은 meetings
   ∪ reviews 전체(연구 소유자·공동연구자가 볼 수 있는 것)
   ∪ polls 중 status가 open인 것
   ∪ (type=poll일 때만) polls 중 확정·취소한 것
```

`type=` 보기([04](04-meetings.md) §2.1)는 위 줄을 거릅니다: `open` = 남은 수(m) > 0인 미팅·서면 피드백, `written` = `recordType === 'written'`, `review` = 검토 요청(위에 '아직 요청하지 않은 수정 결과' 구획), `poll` = 시간 조율 전체(열린 것은 '예정', 확정·취소한 것은 '지난 조율' 묶음에 최신순).

| 묶음 | 들어가는 줄 | 순서 |
|---|---|---|
| 지금 | **이 탭에서 녹음 중인** 미팅(`RecordingProvider` 상태 기준. 저장된 `status`가 아님 — §7) | — |
| 예정 | 준비 중 미팅 가운데 날짜가 오늘 이후이거나 없는 것, 열린 시간 조율 | 날짜 가까운 순, 날짜 없는 것은 뒤 |
| 지난 기록(월별) | 기록 완료 미팅, 서면 피드백, 날짜가 지난 준비 중 미팅('기록 없음' 표시), 검토 요청 | 최신순. 기준 날짜는 미팅 `date`(+`time`), 서면 `date`, 검토 요청 `createdAt` |
| (숨김) | 취소한 미팅 | '취소한 미팅 보기'를 켜면 지난 기록 안에 |

### 4.3 기록 화면의 모드

| 조건 | 모드 |
|---|---|
| 이 탭에서 이 기록을 녹음 중(`RecordingProvider`) | 녹음 |
| `status === 'recording'`인데 이 탭은 녹음 중이 아님(예전 데이터, 다른 기기, 브라우저가 꺼짐) | 기록됨 모양 + 띠 "녹음이 끝나지 않은 기록이에요." [기록 완료로 바꾸기] [준비 중으로 되돌리기] |
| `status === 'preparing'`이고 메모(`memo`)에 글자가 있음 | 녹음 없이 기록 남기는 중([04](04-meetings.md) §6.0) |
| `status === 'preparing'` | 준비. 날짜가 지났으면 위에 "미팅 날짜가 지났어요." 띠와 [기록 남기기] |
| `status === 'recorded'` 또는 `recordType === 'written'` | 기록됨 |
| `status === 'cancelled'` | 기록됨 모양 + "취소한 미팅이에요." 띠와 [취소 되돌리기]. 편집은 가능(지금과 같음) |

주소의 `mode=prepare|record`가 있으면 그 모드를 우선합니다(기록 완료한 미팅의 준비 내용을 다시 볼 때). `mode=record`인데 녹음 중이 아니면 §6.0 화면입니다. 기록 완료·취소한 미팅에 `mode=record`가 오면 무시하고 기록됨으로 엽니다(이미 끝난 기록에 녹음을 새로 붙이지 않게).

### 4.4 한 기록의 피드백·할 일

```
피드백(m) = feedback 중 meetingId === m.id, 보관 안 함
결정(m)   = decisions 중 meetingId === m.id
질문(m)   = questions 중 meetingId === m.id
할 일(m)  = tasks 중 보관 안 함 AND (sourceRecordId === m.id OR feedbackIds에 피드백(m)의 id가 하나라도 있음)
남은 수(m) = 할 일(m) 중 status !== 'done'의 수
```

할 일 하나가 두 기록에 걸칠 수 있습니다(서로 다른 미팅의 피드백 두 개에 연결). 두 기록 모두에 보이고, 한 곳에서 끝내면 두 곳 다 끝난 것으로 보입니다.

### 4.5 넘어온 할 일

준비 중인 미팅 `n`의 준비 화면에 보여 주는 목록입니다. **복사하지 않습니다.**

```
넘어온 할 일(n) = ⋃ 할 일(m) (m은 n보다 앞선 기록: 날짜가 n보다 이르거나, 날짜가 없으면 만든 시각이 이른 것)
               중 status !== 'done' 이고 n.taskIds에 아직 없는 것
```

'가져가기'를 누르면 그 id를 `n.taskIds`에 넣습니다(지금의 준비 할 일 연결 방식 그대로). 미팅을 미뤄도 할 일의 기한은 바뀌지 않습니다.

### 4.6 원문에서 위치 찾기

| 무엇 | 위치를 찾는 법 | 못 찾으면 |
|---|---|---|
| 메모에서 만든 피드백·결정·질문·할 일 | `sourceMemoRevision`이 지금 `memoRevision`과 같으면 `sourceStart`~`sourceEnd`. 다르면 `sourceQuote` 글자를 메모에서 찾아 첫 자리 | 밑줄 없이 오른쪽 열에만 보임. 상세에 "원문이 바뀌어 위치를 찾지 못했어요."와 당시 인용 |
| 전사에서 만든 것 | `audioSource.startMs`~`endMs`와 겹치는 문장(`recordings.segmentTimes`) | 위와 같음. 녹음 구간 듣기는 그대로 됨 |
| 형광펜 | `start`~`end`, `hash`가 맞을 때만 | 그리지 않음(지우지도 않음) |

### 4.7 배지에 쓰는 수

| 자리 | 계산 |
|---|---|
| 아이콘 줄 '할 일' | 보관 안 한 `tasks` 중 `status !== 'done'`. 공동연구에서는 담당이 나이거나 담당이 없는 것만 |
| 아이콘 줄 '결정·질문' | `questions` 중 `status === 'open'` |
| 아이콘 줄 '연구 도우미' 점 | 내 `aiCandidates` 중 `status === 'pending'`이 하나라도 있음 |
| '미팅' 메뉴의 점 | 내가 안 읽은 검토 응답·댓글이 있음(지금 `lib/notifications.ts`·`reads` 규칙 그대로) |
| 기록 줄의 수 | 남은 수(m). 0이면 표시하지 않음 |

### 4.8 피드백의 진행 다섯 칸

지금 계산(`lib/feedback-progress.ts`)을 그대로 씁니다. 피드백 상태(`feedback.status`)는 사용자가 바꾸는 값이고, 할 일을 모두 끝내도 저절로 바뀌지 않습니다. 대신 그때 상세에 "할 일을 모두 끝냈어요. 어떻게 고쳤는지 수정 결과로 남길 수 있어요." 한 줄과 [수정 결과 추가]를 보여 줍니다.

## 5. 서버 함수 `ai-assist` 변경

마이그레이션은 없고 함수 코드와 `supabase/tests/backend.test.mjs`만 바뀝니다. 함수 배포는 사용자 승인 뒤에 합니다. 한도(근거 8개·합 50,000자, 질문 2,000자, 대화 10개·30,000자, 90초, 분당 6회, 같은 입력 100초 중복 방지, 월 20,000크레딧)는 그대로입니다.

### 5.1 전사문을 근거로 받기

- 근거 종류에 `recordings`를 추가합니다: `{ kind: "recordings", id: <녹음 id>, title }`.
- 서버는 `rms_live_transcripts`에서 **요청한 사람이 쓴** 전사 수정문을 읽습니다. 남의 전사는 읽지 못하고, 권한이 없으면 지금의 권한 오류를 냅니다.
- 글자 수는 50,000자 한도에 함께 셉니다. 화면은 보내기 전에 글자 수와 한도를 글자로 보여 주고(`ai-context-meter` 고리는 입력창에서 뺐음 — `kokonut-map.md`), 넘으면 보내기를 막고 두 가지를 권합니다: '형광펜 친 부분만 보내기', '구간 골라 보내기'.
- 테스트: 본인 전사는 읽힘 / 공동연구자의 전사는 거부 / 익명 거부 / 음성만 공유된 녹음의 전사도 거부.

### 5.2 `organize_meeting`이 요약과 할 일 제안도 돌려주기

- 입력: 지금의 `sourceText`(메모)·`sourceRevision`·`meetingId`에 더해 `contexts`의 `recordings` 근거를 받습니다. 메모와 전사 중 하나만 있어도 됩니다.
- [사실] 지금 서버 검사는 이 흐름을 막습니다: 근거가 정확히 `meetings` 하나여야 하고(`ai-assist/index.ts` 434~438행), 근거 글은 메모 안의 이어진 한 덩어리여야 합니다(412행). **바꿀 검사**: `organize_meeting`은 `meetings` 근거 0~1개 + 같은 미팅의 `recordings` 0~N개(합쳐 1개 이상)를 받습니다. '형광펜 친 부분만'은 구간마다 따로 근거로 보내고(근거 8개 한도 안), 서버는 구간마다 메모·전사의 부분 문자열인지 검사합니다. 구간이 8개를 넘으면 화면이 "형광펜 구간이 8개를 넘어요. 전체를 보내거나 형광펜을 줄여 주세요."로 막습니다.
- 50,000자 한도는 서버가 붙이는 근거 머리(`[근거 1] 제목`)까지 포함합니다. 화면의 글자 수 표시도 머리 몫을 더해 셉니다.
- 출력의 제안(`candidates`)에 종류 두 개를 더합니다.

```ts
interface AICandidate {
  category?: "feedback" | "decision" | "question" | "task" | "summary"; // task·summary 추가
}
```

- `summary` 제안은 한 실행에 하나, `body`가 요약 글입니다. `task` 제안은 `title`(할 일)과 `sourceQuote`(근거 문장)를 가집니다.
- 제안은 지금처럼 `aiCandidates`에 `pending`으로 남아 **본인만** 봅니다. 사용자가 '요약 저장'을 눌러야 `meetings.summary`에 들어가고(그 제안은 `adopted`), 할 일 제안은 '할 일 추가'를 눌러야 `tasks`가 됩니다.
- [사실, 코드 확인] `aiCandidates`는 서버가 저장합니다(`rms_ai_finish_v2`, category 검사 없음). `rms_adopt_candidate`는 category가 아니라 대상 종류(decisions·questions·feedback·plans·tasks)를 검사하고 만든 기록을 `private`로 고정합니다(`20261105005311_atomic_adoption.sql` 152~153행). 그래서 **할 일 제안은 `rms_adopt_candidate`로 채택**하고, **요약은 화면이 `meetings.summary`를 직접 저장한 뒤 제안의 `status`만 `adopted`로** 바꿉니다.
- [사실] 지금 `ai-assist`의 `normalizeCandidates`(`validation.ts` 303~342행)는 ① 인용을 못 찾은 후보가 하나라도 있으면 실행 전체를 실패시키고 ② `organize_meeting`에서 feedback·decision·question 말고는 거절하며 ③ 후보를 8개까지만 둡니다. **바꿀 것**: 인용을 못 찾은 후보만 빼고 그 수를 `droppedQuotes`로 돌려줌([09](09-states.md) A8), `summary`는 인용 없이 허용하고 8개 한도에서 뺌, `task`는 인용 필수.
- 원문 변경 검사(`SOURCE_CHANGED`)는 지금과 같습니다. 요약에는 인용 검증을 적용하지 않습니다(인용이 아니므로). 그래서 화면은 요약을 "연구 도우미가 쓴 요약"이라고 표시하고 원문과 구분합니다.

### 5.3 새 모드 `suggest_edits`(본문 안 수정 제안) — 3단계 뒤쪽

- 입력: `documentId`, 글의 `revision`, (선택) 범위, 지시문(`question`), 근거(`contexts`: 피드백 등).
- 출력: 제안 여러 개. 각 제안은 `sourceStart`·`sourceEnd`·`sourceQuote`(지금 글자)·`body`(바꿀 글자)·`title`(이유)를 가집니다. 위치의 기준은 `documents.text`(평문, UTF-16 위치)입니다. 화면은 TipTap 문서를 같은 규칙으로 평문화하며 만든 위치표로 본문 위치에 옮기고, 옮기지 못한 제안은 보이지 않습니다. 서버는 `sourceQuote`가 그 자리의 글자와 같은지 확인하고 다르면 그 제안을 버립니다.
- `aiCandidates`에 `mode: 'suggest_edits'`, `pending`으로 저장합니다. '적용'하면 글에 반영하고 `adopted`, '적용 안 함'이면 `dismissed`.
- 글의 `revision`이 달라졌으면 `SOURCE_CHANGED`. 화면은 "글이 바뀌었어요. 다시 제안받을 수 있어요."를 보여 줍니다.

### 5.4 대화의 `scope`

[사실, 코드 확인] `conversations`는 화면이 저장합니다(`ResearchAssistant.tsx` 773·833행 부근). 서버 변경은 없고 화면이 `scope`를 함께 저장합니다.

### 5.5 바꾸지 않는 것

'초안 쓰기'는 새 모드를 만들지 않습니다. `ask_research`에 미리 적어 둔 지시문을 넣어 보내고, 받은 답을 사용자가 '글로 저장'하면 `documents`에 `type: 'note'`, `origin: 'ai'`로 만듭니다.

## 6. 누르자마자 반응하기(낙관적 갱신)

지금은 저장이 끝나고 전체를 다시 불러온 뒤에야 화면이 바뀝니다. 아래 네 가지는 누른 즉시 화면을 바꾸고 뒤에서 저장합니다. 서버는 그대로입니다.

| 동작 | 즉시 바뀌는 것 | 실패하면 |
|---|---|---|
| 할 일 체크·되돌리기 | 그 할 일의 `status`(모든 화면) | 원래대로 되돌리고 "저장하지 못했어요. 다시 시도해 주세요." |
| 질문 해결·다시 열기 | `questions.status` | 위와 같음 |
| 형광펜 칠하기·지우기 | `memoMarks` / `transcriptMarks` | 위와 같음 |
| 알림 읽음 | `events.readAt` | 조용히 되돌림 |

방법:

1. 바꾸기 전에 부트스트랩 조회를 멈춥니다(`queryClient.cancelQueries`). 30초 주기 갱신이 저장 중에 도착해 화면이 튀는 것을 막습니다.
2. 캐시에서 **그 기록 한 건만** 바꾼 사본으로 교체합니다(`setQueryData`).
3. 저장합니다. 성공하면 서버가 돌려준 그 기록(새 `updatedAt` 포함)으로 캐시의 그 한 건을 바꿉니다.
4. 실패하면 **그 기록 한 건만** 이전 값으로 되돌립니다(캐시 전체를 되돌리지 않음 — 다른 기록의 낙관적 값이 사라지지 않게). 충돌(40001)이면 그 기록만 다시 읽어 바뀐 칸만 다시 적용해 한 번 재시도하고, 또 실패하면 되돌리고 "다른 창에서 내용이 바뀌었어요."를 보여 줍니다.
5. 다시 불러온 결과가 도착했을 때, 대기 줄에 저장이 남아 있는 기록은 그 기록만 낙관적 값으로 다시 덮습니다.

**기록별 대기 줄**: 같은 id에 대한 모든 저장은 한 줄로 차례를 기다립니다. 낙관적 갱신뿐 아니라 **메모 자동 저장, 형광펜, 준비 목록(`taskIds`·`questionIds`·`documentIds`), 요약 저장, 상태 바꾸기**도 같은 미팅 한 줄을 고치므로 모두 이 줄을 거칩니다. 다음 저장은 앞 저장 응답의 `updatedAt`을 실어 보냅니다. 대기 줄은 `lib/record-save-queue.ts`(새로 만듦) 하나에 둡니다.

글 저장(TipTap 자동 저장)과 편집 창은 다른 기록이므로 지금 방식 그대로 둡니다.

## 7. 상태가 저절로 바뀌는 곳

지금은 미팅 상태를 사용자가 직접 바꿉니다. **'녹음 중'은 저장하지 않습니다.** [사실] 지금 코드도 녹음 중 여부를 그 탭의 `RecordingProvider`에만 둡니다. 시작할 때 `recording`을 저장하면 탭이 닫히거나 브라우저가 꺼졌을 때 그 값이 영원히 남아 홈과 목록이 계속 그 기록을 '녹음 중'으로 가리키기 때문입니다. 녹음 중 표시(홈 주 행동 1번, 목록 '지금' 묶음, 상태 배지 '기록 중', 녹음 줄)는 모두 이 탭의 `RecordingProvider`로 판단합니다.

화면이 함께 바꾸는 것은 한 경우뿐입니다(미팅 한 줄 저장, 기록별 대기 줄을 거침, §6).

| 일어난 일 | 바뀌는 값 |
|---|---|
| 녹음을 저장함 | `status → 'recorded'`(그 전 값이 무엇이든. 취소한 미팅이면 바꾸지 않음) |
| 녹음을 시작함 · 녹음을 버림 | 바꾸지 않음 |

예전 데이터 등으로 `status: 'recording'`이 저장되어 있으면 §4.3의 띠로 사용자가 정리합니다. §4.1의 다음 미팅 규칙(지금 코드)은 저장된 `recording`도 대상으로 삼으므로, 이 띠가 뜬 기록은 홈 주 행동 1번이 아니라 6번 '미팅 준비하기' 자리에 "녹음이 끝나지 않은 기록이에요."로 보입니다.

메모만 적었을 때는 저절로 바꾸지 않습니다('기록 중'은 녹음 중이라는 뜻으로 쓰이므로 메모로는 바꾸지 않음). 녹음 없이 기록 남기는 화면([04](04-meetings.md) §6.0)의 [기록 완료로 바꾸기]를 눌러야 `preparing → recorded`가 됩니다. 이 버튼은 메모에 글자가 있을 때 켜지고, 미팅 날짜가 아직 오지 않았으면 "아직 미팅 날짜 전이에요. 기록 완료로 바꿀까요?" 확인을 한 번 거칩니다. 피드백 상태·교수 응답·수정 결과는 어떤 경우에도 저절로 바뀌지 않습니다.

## 8. 보관과 되돌리기

모든 기록은 `BaseRecord.archivedAt`을 가질 수 있습니다. '지우기' 대신 보관을 씁니다.

| 대상 | 지금 | 새로 |
|---|---|---|
| 할 일, 자료, 폴더, 단계, 주요 목표 | 보관·복원 있음 | 그대로 |
| 기록(미팅·서면 피드백) | 없음(취소만) | ⋯ › 보관. 목록에서 사라지고 미팅 목록 맨 아래 '보관한 기록 n개'에서 복원 |
| 피드백·결정·질문 | 없음 | 상세 ⋯ › 보관. 원문의 밑줄도 함께 숨김. 다시 찾는 곳: 할 일 창 피드백 보기의 필터 '보관함', 결정·질문 창 맨 아래 '보관한 결정 n개'·'보관한 질문 n개'(있을 때만) |
| 수정 결과 | 없음 | 상세 ⋯ › 보관. 검토 요청에 담긴 것은 보관할 수 없음(이유: "검토 요청에 들어간 수정 결과라 보관할 수 없어요."). 다시 찾는 곳: 미팅 `type=review`의 수정 결과 구획 전환 '보관함' |
| 요약 | 없음 | 요약 구획 ⋯ › 요약 지우기(`summary`를 비움). 6초 되돌리기 |
| 글 | 없음 | W1에서 보관. 버전은 그대로 |
| 형광펜 | 지우기만 | 지우면 알림에 [되돌리기] (6초) |

보관하면 6초 동안 [되돌리기]가 든 알림을 띄웁니다. 보관한 기록에 달린 피드백·할 일은 함께 숨기지 않습니다(다른 기록·검토 요청과 이어져 있을 수 있음). 대신 그 항목 상세에 "보관한 기록에서 나온 피드백이에요."를 보여 줍니다. 완전 삭제는 지금처럼 연구 단위로만 합니다.

구현 때 확인: `rms_save_record`가 `meetings`·`feedback`·`documents`의 `archivedAt`을 막지 않는지(다른 종류에서 이미 쓰는 공통 키라 막지 않을 것으로 봄).

## 9. 이 브라우저에 저장하는 값

| 키 | 값 | 새로 생김 |
|---|---|---|
| `margin-panel-open` | `1` / `0` | 예 |
| `margin-panel-tab` | `assistant` / `tasks` / `log` / `materials` | 예 |
| `margin-panel-width` | 숫자(px) | 아니오 |
| `margin-panel-width-docs` | 숫자(px) | 예 |
| `margin-records-list` | 미팅 목록 접힘, '취소한 미팅 보기' | 예 |
| `margin-record-sections` | 기록 화면 오른쪽 열 다섯 구획의 접힘 | 예 |
| `margin-docs-tabs:<연구 id>` | 열어 둔 글·자료 탭 id 목록(8개까지) | 예 |
| `margin-home-tab:<연구 id>` | 홈의 마지막 목록 탭 | 예 |

없어지는 키: `rms-sidebar-collapsed`, `rms-sidebar-focus-expanded`(읽지 않게 되며 지우지는 않음). 그 밖의 키(`margin-theme` 쿠키, `margin-lang`, `margin-hour-style`, `margin-ui-sound`, 초안 저장 키 등)는 그대로입니다.

## 10. 미리보기 모드와 예시 데이터

- 미리보기의 예시 연구(`lib/demo.ts`)에 서면 피드백 기록 한 건, 메모 형광펜 두 개, 넘어온 할 일이 보이는 준비 중 미팅 한 건을 더합니다. 요약은 넣지 않습니다(AI가 만든 것처럼 보이는 글을 지어내지 않음). 요약 자리에는 "미리보기에서는 연구 도우미를 실행할 수 없어요."가 보입니다.
- 화면 캡처 검사(`scripts/qa/routes.mjs`)의 화면 목록을 새 주소로 바꿉니다([10](10-build-plan.md) §5).

## 11. 붙일 테스트

| 대상 | 테스트 |
|---|---|
| `lib/record-view.ts` | §4.2 묶음과 순서 / §4.3 모드 / §4.4 할 일 모음(두 기록에 걸친 할 일) / §4.5 넘어온 할 일(이미 가져간 것 제외, 끝낸 것 제외, 날짜 없는 기록) / §4.6 위치 찾기(판이 바뀐 메모, 인용이 사라진 경우) |
| `lib/routes.ts` | [01](01-structure.md) §3.3의 모든 줄(쿼리 보존, 기록 없는 피드백) |
| `lib/side-panel.ts` | 기본값(1440 기준), 저장소를 못 쓸 때, `?panel`을 읽고 지우기, `?detail` 값이 틀릴 때 |
| 낙관적 갱신 | 성공 / 실패 되돌리기 / 충돌 / 연달아 누르기 |
| `ai-assist` | §5.1의 권한 넷, §5.2 출력 모양, 요약만 있을 때·메모만 있을 때 |
| E2E | [10](10-build-plan.md) §4의 흐름 |

## 12. 1차에 하지 않는 것(마이그레이션이 필요한 것)

| 기능 | 왜 미루나 | 필요한 것 |
|---|---|---|
| 사진 붙이기(Q4) | 지금 저장소가 PDF·TXT·MD·음성만 받음 | 저장소 버킷 규칙, 파일 워커, 첨부 종류, 화면 |
| 서버 전사(Q5) | 새 함수·비용·동의 문구 | 전사 함수, 결과 저장 위치, 동의 문구 |
| 형광펜에 종류·메모 달기 | 지금 표시는 위치와 해시뿐 | 표시 모양 확장 또는 새 종류 |

> [사실, 2026-11-20] 형광펜 **종류**는 들어갔습니다(사용자 결정 '뜻 있는 3종'). 표시 한 칸에 `kind?: "check" | "cite"`를 더했고, 없으면 '중요'입니다(예전 표시와 같음). 표시는 `rms_records.data` 안에 있고 서버가 모양을 검사하지 않아 **마이그레이션이 필요 없었습니다**. 메모 자리 옮기기(`relocateMarks`)는 종류를 그대로 둡니다. 형광펜 **메모 달기**는 아직 하지 않았습니다.
| 발표 자료 형태(Q6) | D7로 미룸 | 형태 정의부터 |
| 실시간 함께 쓰기 | 지금은 30초마다 다시 불러오기 | 실시간 구독 |
