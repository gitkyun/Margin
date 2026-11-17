// npm audit을 돌려 높은 위험도 이상 취약점이 있으면 실패합니다.
// 아직 고친 버전이 없는 경고만 아래 목록에 이유·기한과 함께 예외로 둡니다.
// 고친 버전이 나오면 의존성을 올리고 그 항목을 지웁니다.
import { execSync } from "node:child_process";

const ALLOW = {
  // picomatch ReDoS. 고친 버전 없음(2026-11-18). vite·vitest 개발 도구 경유라 배포본에 실리지 않음.
  "GHSA-fc5q-39xc-vjpf": "2026-12-31",
};

const today = new Date().toISOString().slice(0, 10);
let raw;
try {
  raw = execSync("npm audit --json", { encoding: "utf8" });
} catch (error) {
  raw = error.stdout;
}
const report = JSON.parse(raw);
const blocking = [];
for (const [name, vuln] of Object.entries(report.vulnerabilities ?? {})) {
  if (!["high", "critical"].includes(vuln.severity)) continue;
  for (const via of vuln.via) {
    if (typeof via === "string") continue; // 다른 패키지 경유. 원인 패키지에서 판단
    if (!["high", "critical"].includes(via.severity)) continue;
    const id = String(via.url ?? "").split("/").pop();
    const until = ALLOW[id];
    if (until && today <= until) {
      console.log(`예외: ${name} ${id} (${until}까지)`);
      continue;
    }
    blocking.push(`${name} ${via.severity} ${id} ${via.title}`);
  }
}
if (blocking.length) {
  console.error("높은 위험도 취약점:\n" + blocking.join("\n"));
  process.exit(1);
}
console.log("높은 위험도 취약점 없음(예외 제외)");
