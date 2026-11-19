import { t } from "@/lib/i18n";
import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/icons";
import { PdfViewer } from "@/components/PdfViewer";
import { useWorkspace } from "@/lib/workspace";
import { koreanScore } from "@/lib/hangul-search";
import { friendlyError } from "@/lib/supabase";
import { readPDFPage } from "@/lib/pdf-text";
import { docRows, type DocRow } from "@/lib/docs-list";
import {
  documentTypeLabel,
  domainOf,
  materialTypeLabel,
  sinceLabel,
} from "@/lib/docs-labels";
import { takeAlongMeeting, withVersion } from "@/lib/materials-panel";
import type { AIContext } from "@/lib/domain";
import { DocReadOnly } from "./DocReadOnly";
import "./materials-panel.css";

/**
 * 자료 창(IA v2 P4, 06 §5). 다른 화면을 보면서 글·자료를 찾아 곁에서 훑어봅니다. 편집은 여기서 하지 않습니다.
 * 목록은 최근 고친 순이고, 줄을 누르면 창 안에서 훑어보기가 열립니다(목록은 숨길 뿐이라 찾기·스크롤이 남음).
 */
export function MaterialsPanel({
  researchId,
  onClose,
  onAsk,
}: {
  researchId: string;
  onClose(): void;
  /** [연구 도우미에게 묻기]: 이 근거 칩을 놓고 연구 도우미 창을 엽니다. */
  onAsk(context: AIContext): void;
}) {
  const { data } = useWorkspace();
  const [query, setQuery] = useState("");
  const [openKey, setOpenKey] = useState<string | null>(null);
  const rows = docRows(
    data,
    researchId,
    { kind: "all", folder: "", query, sort: "recent" },
    (text, q) => koreanScore(text, q) > 0,
  );
  const all = query
    ? docRows(data, researchId, { kind: "all", folder: "", sort: "recent" })
    : rows;
  // 훑어보는 줄은 찾기 결과에서 빠져도 그대로 보여 줍니다.
  const open = all.find((row) => `${row.kind}:${row.id}` === openKey);
  const docsHref = `/r/${researchId}/docs`;

  return (
    <section
      className="materials-panel"
      aria-labelledby="materials-panel-heading"
    >
      <header className="materials-panel-head">
        <h2 id="materials-panel-heading">{t("글·자료")}</h2>
        <Button
          variant="ghost"
          size="icon-sm"
          className="ia-panel-close"
          aria-label={t("글·자료 창 닫기")}
          onClick={onClose}
        >
          <Icon name="close" size={18} />
        </Button>
      </header>
      <div className="materials-panel-list" hidden={!!open}>
        {all.length > 0 && (
          <input
            className="materials-panel-search"
            type="search"
            value={query}
            aria-label={t("글·자료에서 찾기")}
            placeholder={t("글·자료에서 찾기")}
            onChange={(event) => setQuery(event.target.value)}
          />
        )}
        {rows.length > 0 && (
          <ul className="materials-panel-rows">
            {rows.map((row) => (
              <li key={`${row.kind}:${row.id}`}>
                <button
                  type="button"
                  className="materials-panel-row"
                  onClick={() => setOpenKey(`${row.kind}:${row.id}`)}
                >
                  <Icon name={rowIcon(row)} size={16} />
                  <span className="materials-panel-row-title">{row.title}</span>
                  <small>{sinceLabel(row.updatedAt)}</small>
                  <span className="sr-only">
                    {row.kind === "writing" ? t("글") : t("자료")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {all.length > 0 && !rows.length && (
          <p className="item-detail-empty">
            {t("조건에 맞는 글이나 자료가 없어요.")}
          </p>
        )}
        {!all.length && (
          <div className="materials-panel-empty">
            <p className="item-detail-empty">
              {t("아직 글이나 자료가 없어요.")}
            </p>
            <Button variant="outline" size="sm" asChild>
              <Link to={docsHref}>{t("글·자료로 가기")}</Link>
            </Button>
          </div>
        )}
      </div>
      {open && (
        <Peek
          key={openKey}
          row={open}
          researchId={researchId}
          onBack={() => setOpenKey(null)}
          onAsk={onAsk}
        />
      )}
    </section>
  );
}

function rowIcon(row: DocRow): string {
  if (row.kind === "writing") return "edit";
  return row.material.externalUrl ? "link" : "file";
}

/** 훑어보기(06 §5): 글은 읽기 전용 본문, PDF는 작은 보기(쪽 넘기기), 링크는 주소. */
function Peek({
  row,
  researchId,
  onBack,
  onAsk,
}: {
  row: DocRow;
  researchId: string;
  onBack(): void;
  onAsk(context: AIContext): void;
}) {
  const { data, save, openFile } = useWorkspace();
  const location = useLocation();
  const [page, setPage] = useState(1);
  const [asking, setAsking] = useState(false);
  const [taking, setTaking] = useState(false);
  const base = `/r/${researchId}/docs`;
  const href =
    row.kind === "writing" ? `${base}/w/${row.id}` : `${base}/m/${row.id}`;
  const link = row.kind === "material" ? row.material.externalUrl : undefined;
  const latest = row.kind === "material" ? row.latest : undefined;
  const meeting = takeAlongMeeting(
    location.pathname,
    data.meetings,
    researchId,
  );
  const taken = !!(meeting && latest && !withVersion(meeting, latest));

  async function ask() {
    if (row.kind === "writing") {
      const d = row.document;
      onAsk({
        kind: "documents",
        id: d.id,
        title: d.title,
        revision: d.revision,
      });
      return;
    }
    if (!latest) return;
    setAsking(true);
    try {
      // PDF는 보고 있는 쪽의 글자를 근거로 보냅니다(서버가 판·쪽·글자를 함께 받음).
      const { text } = await readPDFPage(await openFile(latest), page);
      onAsk({
        kind: "versions",
        id: latest.id,
        title: `${row.material.title} v${latest.number}`,
        page,
        text,
      });
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setAsking(false);
    }
  }

  async function takeAlong() {
    if (!meeting || !latest) return;
    const current = data.meetings.find((m) => m.id === meeting.id) ?? meeting;
    const next = withVersion(current, latest);
    if (!next) return;
    setTaking(true);
    try {
      await save("meetings", next);
      toast.success(t("이 미팅에 가져갔어요."));
    } catch (error) {
      toast.error(friendlyError(error));
    } finally {
      setTaking(false);
    }
  }

  const meta =
    row.kind === "writing"
      ? [
          documentTypeLabel(row.document.type),
          t("{count}자", { count: row.document.text.length.toLocaleString() }),
          sinceLabel(row.updatedAt),
        ]
      : link
        ? [t("링크"), domainOf(link)]
        : [
            materialTypeLabel(row.material.type),
            latest ? `v${latest.number}` : t("파일 없음"),
            sinceLabel(row.updatedAt),
          ];

  return (
    <article className="materials-peek" aria-labelledby="materials-peek-title">
      <Button
        variant="ghost"
        size="sm"
        className="materials-peek-back"
        onClick={onBack}
      >
        <Icon name="arrow-left" size={16} />
        {t("목록")}
      </Button>
      <h3 id="materials-peek-title">{row.title}</h3>
      <p className="materials-peek-meta">{meta.filter(Boolean).join(" · ")}</p>
      <div className="materials-peek-actions">
        {link ? (
          <Button variant="outline" size="sm" asChild>
            <a href={link} target="_blank" rel="noopener noreferrer">
              {t("링크 열기")}
            </a>
          </Button>
        ) : (
          <Button variant="outline" size="sm" asChild>
            <Link to={href}>{t("열기")}</Link>
          </Button>
        )}
        {(row.kind === "writing" || latest) && (
          <Button
            variant="outline"
            size="sm"
            disabled={asking}
            onClick={() => void ask()}
          >
            <Icon name="sparkles" size={16} />
            {asking ? t("읽는 중") : t("연구 도우미에게 묻기")}
          </Button>
        )}
        {meeting && latest && (
          <Button
            variant="outline"
            size="sm"
            disabled={taken || taking}
            onClick={() => void takeAlong()}
          >
            {taken ? t("이 미팅에 가져갔어요") : t("이 미팅에 가져가기")}
          </Button>
        )}
      </div>
      {row.kind === "writing" ? (
        row.document.text.trim() ? (
          <DocReadOnly content={row.document.content} />
        ) : (
          <p className="item-detail-empty">{t("아직 내용이 없어요.")}</p>
        )
      ) : link ? (
        <p className="materials-peek-url">{link}</p>
      ) : latest ? (
        <div className="materials-peek-pdf">
          <PdfViewer version={latest} onPageChange={setPage} />
        </div>
      ) : (
        <p className="item-detail-empty">{t("올린 파일이 없어요.")}</p>
      )}
    </article>
  );
}
