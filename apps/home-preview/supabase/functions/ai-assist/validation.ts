export type Mode = 'organize_meeting' | 'suggest_revisions'
export interface AIInput { mode: Mode; researchId: string; meetingId?: string; feedbackId?: string; sourceText: string; sourceRevision?: number }
export interface Candidate { title: string; body?: string; category?: 'feedback' | 'decision' | 'question'; sourceQuote?: string; sourceStart?: number; sourceEnd?: number; method?: string; expectedResult?: string; assumptions?: string; requiredMaterials?: string; suggestedTasks?: string[] }
export class AIError extends Error { constructor(public code: string, message: string, public status = 400) { super(message); this.name = 'AIError' } }
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
function object(value: unknown): Record<string, unknown> { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AIError('INVALID_INPUT','AI 입력 형식을 확인해 주세요.'); return value as Record<string, unknown> }
function text(value: unknown, max: number, required = false): string { if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new AIError('INVALID_OUTPUT','AI 응답 형식을 확인할 수 없습니다. 다시 시도하거나 직접 작성해 주세요.',502); return value }
export function validateInput(value: unknown): AIInput {
 const input=object(value)
 if (!['organize_meeting','suggest_revisions'].includes(String(input.mode)) || !uuid.test(String(input.researchId)) || typeof input.sourceText!=='string' || !input.sourceText.trim() || input.sourceText.length>50000) throw new AIError('INVALID_INPUT','선택한 원문과 실행 종류를 확인해 주세요.')
 const mode=input.mode as Mode
 if (mode==='organize_meeting' && (!uuid.test(String(input.meetingId)) || !Number.isInteger(input.sourceRevision) || Number(input.sourceRevision)<1)) throw new AIError('INVALID_INPUT','저장한 미팅 메모와 버전을 확인해 주세요.')
 if (mode==='suggest_revisions' && !uuid.test(String(input.feedbackId))) throw new AIError('INVALID_INPUT','수정 방안을 제안받을 피드백을 선택해 주세요.')
 return {mode,researchId:String(input.researchId),sourceText:input.sourceText,...(mode==='organize_meeting'?{meetingId:String(input.meetingId),sourceRevision:Number(input.sourceRevision)}:{feedbackId:String(input.feedbackId)})}
}
export function normalizeCandidates(value: unknown,mode: Mode,source: string,originalQuote=''): Candidate[] {
 const output=object(value)
 if (!Array.isArray(output.candidates) || output.candidates.length<1 || output.candidates.length>8) throw new AIError('INVALID_OUTPUT','AI가 사용할 수 있는 후보를 반환하지 않았습니다. 직접 작성하거나 다시 시도해 주세요.',502)
 return output.candidates.map(item=>{
  const c=object(item),title=text(c.title,200,true).trim(),quote=c.sourceQuote===undefined?'':text(c.sourceQuote,20000),position=quote?source.indexOf(quote):-1
  if (quote && position<0 && !(mode==='suggest_revisions'&&originalQuote.includes(quote))) throw new AIError('UNVERIFIED_QUOTE','AI 발췌를 원문에서 찾을 수 없어 후보를 적용하지 않았습니다. 다시 시도하거나 직접 작성해 주세요.',502)
  const citation=quote?{sourceQuote:quote,...(position>=0?{sourceStart:position,sourceEnd:position+quote.length}:{})}:{}
  if (mode==='organize_meeting') {
   if (!['feedback','decision','question'].includes(String(c.category))||!quote||position<0) throw new AIError('UNVERIFIED_QUOTE','정리 후보의 원문 근거를 확인할 수 없습니다. 직접 작성하거나 다시 시도해 주세요.',502)
   return {title,category:c.category as Candidate['category'],body:text(c.body,10000,true).trim(),...citation}
  }
  if (!Array.isArray(c.suggestedTasks)||c.suggestedTasks.length>8) throw new AIError('INVALID_OUTPUT','AI 수정 방안의 작업 목록을 확인할 수 없습니다.',502)
  return {title,method:text(c.method,10000,true).trim(),expectedResult:text(c.expectedResult,10000,true).trim(),assumptions:text(c.assumptions,10000),requiredMaterials:text(c.requiredMaterials,10000),suggestedTasks:c.suggestedTasks.map(v=>text(v,500,true).trim()),...citation}
 })
}
export function verifySource(input: AIInput,stored: Record<string,unknown>): void {
 const original=input.mode==='organize_meeting'?stored.memo:stored.body
 if (typeof original!=='string'||original!==input.sourceText||(input.mode==='organize_meeting'&&stored.memoRevision!==input.sourceRevision)) throw new AIError('SOURCE_CHANGED','원문이 변경되었습니다. 저장한 내용을 다시 불러온 뒤 AI를 실행해 주세요.',409)
}
