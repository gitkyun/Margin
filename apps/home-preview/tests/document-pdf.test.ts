import {it,expect} from 'vitest';
import {Font} from '@react-pdf/renderer';
import {fileURLToPath} from 'node:url';
import {mkdir,writeFile} from 'node:fs/promises';
import {documentPDF} from '../src/lib/document-pdf';
it('creates a fixed Korean PDF with a long table and page footers',async()=>{

 const paragraph=(text:string)=>({type:'paragraph',content:[{type:'text',text}]});
 const rows=Array.from({length:80},(_,i)=>({type:'tableRow',content:[{type:'tableCell',content:[paragraph(`항목 ${i+1}`)]},{type:'tableCell',content:[paragraph('연구 질문과 인터뷰 분석 기준을 검토합니다. 한글 내용 보존 검증입니다.')]}]}));
 const blob=await documentPDF({id:'pdf-check',researchId:'qa',documentId:'doc',number:1,title:'한글 연구 계획서 검증',content:{type:'doc',content:[{type:'heading',attrs:{level:2},content:[{type:'text',text:'연구 배경'}]},paragraph('기록과 피드백을 비교하고 수정 이유를 보존합니다.'),{type:'table',content:rows}]},text:'한글 연구 계획서 검증',createdAt:'2026-11-05T00:00:00Z',updatedAt:'2026-11-05T00:00:00Z'},fileURLToPath(new URL('../public/fonts/Pretendard-Regular.woff',import.meta.url)));
 const bytes=Buffer.from(await blob.arrayBuffer());expect(bytes.subarray(0,4).toString()).toBe('%PDF');expect(bytes.length).toBeGreaterThan(10000);
 await mkdir('../../docs/development/pdf-check-20261105',{recursive:true});await writeFile('../../docs/development/pdf-check-20261105/korean-long-table.pdf',bytes);
},30000);
