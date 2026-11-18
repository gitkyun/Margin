/**
 * 열어 둔 탭 줄(IA v2 05 §3.2)이 글을 떠나기 전에 "저장 안 한 내용을 먼저 저장"하도록
 * 지금 열린 글 편집기가 저장 함수를 맡겨 두는 곳입니다. 글 id 하나에 함수 하나.
 * 저장에 실패하면 false를 돌려주고, 그때는 화면의 이동 보호(이동 확인)가 이어서 맡습니다.
 */
type Flush = () => Promise<boolean>;

const flushers = new Map<string, Flush>();

/** 편집기가 열릴 때 등록하고, 돌려받은 함수로 닫힐 때 풉니다. */
export function registerFlush(documentId: string, flush: Flush): () => void {
  flushers.set(documentId, flush);
  return () => {
    if (flushers.get(documentId) === flush) flushers.delete(documentId);
  };
}

/** 저장할 것이 없거나 열린 편집기가 없으면 true. 저장하다 오류가 나면 false. */
export async function flushEditor(documentId: string): Promise<boolean> {
  const flush = flushers.get(documentId);
  if (!flush) return true;
  try {
    return await flush();
  } catch {
    return false;
  }
}

/**
 * 연구 도우미 답 아래 [이 글에 넣기](IA v2 06 §2.4): 열려 있는 글 편집기가 "커서 자리에 넣기"를 맡겨 둡니다.
 * 넣은 내용은 편집기의 되돌리기로 되돌릴 수 있습니다.
 */
type Insert = (answer: string) => void;
const inserters = new Map<string, Insert>();

export function registerInsert(documentId: string, insert: Insert): () => void {
  inserters.set(documentId, insert);
  return () => {
    if (inserters.get(documentId) === insert) inserters.delete(documentId);
  };
}

/** 그 글의 편집기가 열려 있으면 넣고 true, 아니면 false */
export function insertIntoEditor(documentId: string, answer: string): boolean {
  const insert = inserters.get(documentId);
  if (!insert) return false;
  insert(answer);
  return true;
}

export function canInsertInto(documentId: string): boolean {
  return inserters.has(documentId);
}

/**
 * 연구 도우미 '이어서'의 [수정 제안 받기](IA v2 06 §2.4): 열려 있는 글 편집기가 본문 안 수정 제안 창 열기를 맡겨 둡니다.
 * 보내기 전에 범위와 지시를 고르는 창은 글 화면의 것 그대로입니다.
 */
type OpenSuggest = () => void;
const suggesters = new Map<string, OpenSuggest>();

export function registerSuggest(
  documentId: string,
  open: OpenSuggest,
): () => void {
  suggesters.set(documentId, open);
  return () => {
    if (suggesters.get(documentId) === open) suggesters.delete(documentId);
  };
}

/** 그 글의 편집기가 열려 있으면 수정 제안 창을 열고 true */
export function openSuggestEdits(documentId: string): boolean {
  const open = suggesters.get(documentId);
  if (!open) return false;
  open();
  return true;
}

export function canSuggestIn(documentId: string): boolean {
  return suggesters.has(documentId);
}
