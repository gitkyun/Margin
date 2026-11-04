import {describe,expect,it} from 'vitest'
import {normalizeCandidates,validateInput,verifySource} from './validation'
const researchId='11111111-1111-4111-8111-111111111111',meetingId='22222222-2222-4222-8222-222222222222'
describe('AI source and citation boundaries',()=>{
 it('requires a persisted meeting revision',()=>{expect(()=>validateInput({mode:'organize_meeting',researchId,meetingId,sourceText:'메모'})).toThrow()})
 it('rejects stale source text and revision',()=>{const input=validateInput({mode:'organize_meeting',researchId,meetingId,sourceText:'원문',sourceRevision:2});expect(()=>verifySource(input,{memo:'수정 원문',memoRevision:3})).toThrow();expect(()=>verifySource(input,{memo:'원문',memoRevision:1})).toThrow()})
 it('rejects a fabricated citation',()=>{expect(()=>normalizeCandidates({candidates:[{title:'수정',body:'수정한다',category:'feedback',sourceQuote:'없는 교수 지시'}]},'organize_meeting','기준을 보완해 주세요.')).toThrow()})
 it('recomputes UTF-16 positions including emoji',()=>{const source='📌 비교 기준을 보완해 주세요.';const [v]=normalizeCandidates({candidates:[{title:'기준 보완',body:'비교 기준 보완',category:'feedback',sourceQuote:'비교 기준',sourceStart:999}]},'organize_meeting',source);expect(v.sourceStart).toBe(3);expect(source.slice(v.sourceStart,v.sourceEnd)).toBe('비교 기준')})
 it('distinguishes a proposed method from original evidence',()=>{const [v]=normalizeCandidates({candidates:[{title:'관점 추가',method:'비교 열을 추가한다',expectedResult:'기준 차이를 읽을 수 있다',assumptions:'각 논문의 목적 확인 필요',requiredMaterials:'선행연구 표',suggestedTasks:['관점 정리'],sourceQuote:'기준을 보완'}]},'suggest_revisions','표를 고쳐 주세요.','비교 기준을 보완해 주세요.');expect(v.sourceQuote).toBe('기준을 보완');expect(v.sourceStart).toBeUndefined();expect(v.method).toContain('추가')})
 it('rejects missing proposal fields',()=>{expect(()=>normalizeCandidates({candidates:[{title:'방법',method:'변경',expectedResult:'결과',suggestedTasks:[]}]},'suggest_revisions','원문')).toThrow()})
})
