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
