import { t } from "@/lib/i18n";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Icon } from "@/components/icons";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWorkspace } from "@/lib/workspace";
import {
  closeTab,
  moveTab,
  neighborTab,
  openTab,
  readTabs,
  writeTabs,
  type OpenTab,
} from "@/lib/open-tabs";
import { flushEditor } from "@/lib/editor-flush";
import "./docs.css";

const DRAG_TYPE = "application/x-margin-doc-tab";

/**
 * 글 편집(W2)·자료 보기(W3) 위의 열어 둔 탭 줄(IA v2 05 §3.2).
 * 지금 연 글·자료를 탭으로 더하고, 보관했거나 볼 수 없는 것은 조용히 뺍니다.
 */
export function DocTabsFrame({
  kind,
  children,
}: {
  kind: "w" | "m";
  children: ReactNode;
}) {
  const { researchId = "", documentId, materialId } = useParams();
  const id = (kind === "w" ? documentId : materialId) ?? "";
  const { data } = useWorkspace();
  const navigate = useNavigate();
  const [tabs, setTabs] = useState<OpenTab[]>(() => readTabs(researchId));
  const [dragFrom, setDragFrom] = useState<number | null>(null);

  const titleOf = (tab: Pick<OpenTab, "kind" | "id">) =>
    tab.kind === "w"
      ? data.documents.find(
          (d) =>
            d.id === tab.id && d.researchId === researchId && !d.archivedAt,
        )?.title
      : data.materials.find(
          (m) =>
            m.id === tab.id && m.researchId === researchId && !m.archivedAt,
        )?.title;
  const exists = (tab: OpenTab) => titleOf(tab) !== undefined;

  // 닫는 중인 탭. 저장으로 기록이 바뀌어 아래 효과가 다시 돌아도 되살리지 않습니다.
  const closing = useRef<string | null>(null);
  // 연 글·자료를 탭에 더합니다(있을 때만). 다른 창에서 바뀐 탭도 함께 읽습니다.
  useEffect(() => {
    if (!id) return;
    if (closing.current === `${kind}:${id}`) return;
    closing.current = null;
    const current = { kind, id };
    if (!exists({ ...current, seen: 0 })) return;
    const next = openTab(readTabs(researchId), current, Date.now()).filter(
      exists,
    );
    writeTabs(researchId, next);
    setTabs(next);
  }, [researchId, kind, id, data.documents, data.materials]);

  const visible = tabs.filter(exists);
  const hrefOf = (tab: Pick<OpenTab, "kind" | "id">) =>
    `/r/${researchId}/docs/${tab.kind}/${tab.id}`;
  function update(next: OpenTab[]) {
    writeTabs(researchId, next);
    setTabs(next);
  }
  /** 지금 보는 글을 떠나기 전에 저장 안 한 내용을 먼저 저장합니다(05 §3.2). */
  async function leave(href: string) {
    if (kind === "w" && id) await flushEditor(id);
    // 저장에 실패했으면 화면의 이동 보호가 '저장하지 않고 이동할까요?'를 띄웁니다.
    navigate(href);
  }
  async function close(tab: OpenTab) {
    const current = tab.kind === kind && tab.id === id;
    const neighbor = neighborTab(visible, tab);
    if (!current) {
      update(closeTab(tabs, tab));
      return;
    }
    // 지금 보던 탭을 닫으면 먼저 저장하고 옆 탭으로, 없으면 목록으로 갑니다.
    const target = neighbor ? hrefOf(neighbor) : `/r/${researchId}/docs`;
    if (kind === "w" && id && !(await flushEditor(id))) {
      // 저장하지 못했으면 탭은 그대로 두고 이동만 시도합니다(이동 보호가 확인을 띄움).
      navigate(target);
      return;
    }
    closing.current = `${tab.kind}:${tab.id}`;
    // 저장하는 사이 탭 목록이 다시 쓰였을 수 있어 저장된 목록에서 닫습니다.
    update(closeTab(readTabs(researchId), tab));
    navigate(target);
  }
  function move(from: number, to: number) {
    const a = visible[from],
      b = visible[to];
    if (!a || !b) return;
    update(moveTab(tabs, tabs.indexOf(a), tabs.indexOf(b)));
  }

  return (
    <>
      <nav className="doc-tabs" aria-label={t("열어 둔 글·자료")}>
        <Link
          className="doc-tabs-list"
          to={`/r/${researchId}/docs`}
          onClick={(event) => {
            if (event.button !== 0 || event.metaKey || event.ctrlKey) return;
            event.preventDefault();
            void leave(`/r/${researchId}/docs`);
          }}
        >
          <Icon name="list" size={16} />
          {t("목록")}
        </Link>
        <ul className="doc-tabs-row">
          {visible.map((tab, index) => {
            const title = titleOf(tab) ?? "";
            const active = tab.kind === kind && tab.id === id;
            return (
              <li
                key={`${tab.kind}:${tab.id}`}
                className="doc-tab"
                data-active={active ? "" : undefined}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.setData(DRAG_TYPE, String(index));
                  event.dataTransfer.effectAllowed = "move";
                  setDragFrom(index);
                }}
                onDragOver={(event) => {
                  if (event.dataTransfer.types.includes(DRAG_TYPE))
                    event.preventDefault();
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  if (dragFrom !== null) move(dragFrom, index);
                  setDragFrom(null);
                }}
                onDragEnd={() => setDragFrom(null)}
                onAuxClick={(event) => {
                  // 가운데 버튼으로 누르면 닫힙니다.
                  if (event.button === 1) {
                    event.preventDefault();
                    void close(tab);
                  }
                }}
              >
                <Link
                  className="doc-tab-link"
                  to={hrefOf(tab)}
                  aria-current={active ? "page" : undefined}
                  title={title}
                  onClick={(event) => {
                    // 다른 탭으로 옮길 때도 먼저 저장합니다. 새 탭으로 여는 누르기는 그대로 둡니다.
                    if (
                      active ||
                      event.button !== 0 ||
                      event.metaKey ||
                      event.ctrlKey ||
                      event.shiftKey ||
                      event.altKey
                    )
                      return;
                    event.preventDefault();
                    void leave(hrefOf(tab));
                  }}
                >
                  <Icon name={tab.kind === "w" ? "edit" : "file"} size={14} />
                  <span>{title}</span>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger>
                    <button
                      type="button"
                      className="doc-tab-button"
                      aria-label={t("{title} 탭 메뉴", { title })}
                    >
                      <Icon name="chevron-down" size={12} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {index > 0 && (
                      <DropdownMenuItem onSelect={() => move(index, index - 1)}>
                        {t("왼쪽으로")}
                      </DropdownMenuItem>
                    )}
                    {index < visible.length - 1 && (
                      <DropdownMenuItem onSelect={() => move(index, index + 1)}>
                        {t("오른쪽으로")}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onSelect={() => void close(tab)}>
                      {t("탭 닫기")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <button
                  type="button"
                  className="doc-tab-button"
                  aria-label={t("{title} 탭 닫기", { title })}
                  onClick={() => void close(tab)}
                >
                  <Icon name="close" size={12} />
                </button>
              </li>
            );
          })}
        </ul>
        <Link
          className="doc-tabs-new"
          to={`/r/${researchId}/docs?new=1`}
          aria-label={t("새 글")}
        >
          <Icon name="plus" size={16} />
        </Link>
      </nav>
      {children}
    </>
  );
}
