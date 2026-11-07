# 실제 연결 확인 · 2026-11-03

Supabase 프로젝트: `RMS Classroom Demo` (`uudfezdytzwjabxmnwfa`, Free). 신규 빈 public schema임을 확인한 뒤 `202611030001_rms.sql`을 적용했다. 공개 가입 해제와 비밀번호 최소 길이12자만 호스팅 Auth에 반영했다.

## 서버에서 통과한 항목

- 실제 학생·교수 이메일 로그인
- 비로그인 계정의 데이터 접근 거부
- 미팅·메모·피드백·작업·질문을 같은 실제 기록으로 저장
- 실제 PDF 업로드·지정 교수 다운로드·개인 메모 비공개
- 교수 항목별 다른 응답·추가 수정 이유 필수
- 학생 작업 완료와 교수 응답 분리·학생 교수 응답 거부
- v3 한 항목 재확인·v2 파일·다른 항목 응답 보존
- 공유 중지 후 자료·파일 접근 거부
- 새 세션 재로그인 뒤 실제 저장 유지
- 별도 허용 학생 계정의 다른 학생 검토·파일·재확인 접근 거부

실행 스크립트: `apps/home-preview/supabase/scripts/check-live.mjs`. 가상 자료를 생성하므로 명시적 `--apply`를 요구한다. 로컬 계정 환경을 읽고 키·비밀번호는 출력하지 않는다. 반복 실행하면 별도 가상 연구를 추가한다. 기존 연구·계정·비밀번호를 초기화하지 않는다.

## 재현

```bash
cd apps/home-preview
node --env-file=supabase/.env.provision.local supabase/scripts/check-live.mjs --apply
```

실제 계정 발급과 허용 목록은 [연결 안내](../../apps/home-preview/supabase/README.md)를 참고한다. 브라우저·실제 AI·배포의 확인 범위는 [검증 기록](../../apps/home-preview/design-qa.md)과 구분한다. 실제 사용자 연구 자료는 업로드하지 않았다.
