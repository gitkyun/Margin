import type { ReactNode } from "react";
import type { Editor } from "@tiptap/react";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Quote,
  Redo2,
  RemoveFormatting,
  Strikethrough,
  Undo2,
} from "lucide-react";
import { Icon } from "@/components/icons";
import { Choice } from "@/components/experience";
import { Button } from "@/components/ui/button";
import { Hint } from "@/components/ui/hint";

const ICON = 18;

/** 문단 형식: 본문과 제목 세 단계. 값은 제목 단계 숫자이고 본문은 0입니다. */
const BLOCK_OPTIONS = [
  { value: "0", label: "본문" },
  { value: "1", label: "제목 1" },
  { value: "2", label: "제목 2" },
  { value: "3", label: "제목 3" },
];
type HeadingLevel = 1 | 2 | 3;

function currentBlock(editor: Editor | null) {
  if (!editor) return "0";
  const level = ([1, 2, 3] as const).find((l) =>
    editor.isActive("heading", { level: l }),
  );
  return String(level ?? 0);
}

function Tool({
  label,
  active,
  disabled,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Hint label={label} position="bottom-center">
      <button
        type="button"
        className="editor-tool"
        aria-label={label}
        aria-pressed={active}
        disabled={disabled}
        // 누를 때 본문의 선택 영역이 풀리지 않게 합니다.
        onMouseDown={(e) => e.preventDefault()}
        onClick={onClick}
      >
        {children}
      </button>
    </Hint>
  );
}

/**
 * 글쓰기 서식 도구 줄. 문서 위에 붙어 따라오고, 왼쪽부터
 * 되돌리기 → 문단 형식 → 글자 서식 → 목록·인용 → 표 순서로 묶습니다.
 */
export function EditorToolbar({
  editor,
  outlineOpen,
  onToggleOutline,
  aiDisabled,
  aiHint,
  onAiReview,
}: {
  editor: Editor | null;
  outlineOpen: boolean;
  onToggleOutline: () => void;
  aiDisabled: boolean;
  aiHint: string;
  onAiReview: () => void;
}) {
  const chain = () => editor?.chain().focus();
  const marks = [
    {
      type: "bold",
      label: "굵게",
      glyph: Bold,
      run: () => chain()?.toggleBold().run(),
    },
    {
      type: "italic",
      label: "기울임",
      glyph: Italic,
      run: () => chain()?.toggleItalic().run(),
    },
    {
      type: "strike",
      label: "취소선",
      glyph: Strikethrough,
      run: () => chain()?.toggleStrike().run(),
    },
  ];
  const blocks = [
    {
      type: "bulletList",
      label: "글머리 목록",
      glyph: List,
      run: () => chain()?.toggleBulletList().run(),
    },
    {
      type: "orderedList",
      label: "번호 목록",
      glyph: ListOrdered,
      run: () => chain()?.toggleOrderedList().run(),
    },
    {
      type: "blockquote",
      label: "인용문",
      glyph: Quote,
      run: () => chain()?.toggleBlockquote().run(),
    },
  ];
  return (
    <div className="editor-toolbar" role="toolbar" aria-label="문서 서식">
      <Tool
        label="목차·공개 범위"
        active={outlineOpen}
        onClick={onToggleOutline}
      >
        <Icon name="menu" size={ICON} />
      </Tool>
      <i aria-hidden="true" />
      <Tool
        label="실행 취소"
        disabled={!editor?.can().undo()}
        onClick={() => chain()?.undo().run()}
      >
        <Undo2 size={ICON} />
      </Tool>
      <Tool
        label="다시 실행"
        disabled={!editor?.can().redo()}
        onClick={() => chain()?.redo().run()}
      >
        <Redo2 size={ICON} />
      </Tool>
      <i aria-hidden="true" />
      <Choice
        compact
        label="문단 형식"
        value={currentBlock(editor)}
        options={BLOCK_OPTIONS}
        onChange={(value) => {
          const level = Number(value);
          if (level)
            chain()
              ?.setHeading({ level: level as HeadingLevel })
              .run();
          else chain()?.setParagraph().run();
        }}
      />
      <i aria-hidden="true" />
      {marks.map(({ type, label, glyph: Glyph, run }) => (
        <Tool
          key={type}
          label={label}
          active={editor?.isActive(type)}
          onClick={run}
        >
          <Glyph size={ICON} />
        </Tool>
      ))}
      <i aria-hidden="true" />
      {blocks.map(({ type, label, glyph: Glyph, run }) => (
        <Tool
          key={type}
          label={label}
          active={editor?.isActive(type)}
          onClick={run}
        >
          <Glyph size={ICON} />
        </Tool>
      ))}
      <i aria-hidden="true" />
      <Tool
        label="표 추가"
        onClick={() =>
          chain()?.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()
        }
      >
        <Icon name="grid" size={ICON} />
      </Tool>
      {editor?.isActive("table") && (
        <Tool label="행 추가" onClick={() => chain()?.addRowAfter().run()}>
          <Icon name="plus" size={ICON} />
        </Tool>
      )}
      <Tool
        label="서식 지우기"
        onClick={() => chain()?.unsetAllMarks().clearNodes().run()}
      >
        <RemoveFormatting size={ICON} />
      </Tool>
      <span className="editor-toolbar-end">
        <Hint label={aiHint} position="bottom-center">
          <span>
            <Button
              size="sm"
              variant="outline"
              disabled={aiDisabled}
              onMouseDown={(e) => e.preventDefault()}
              onClick={onAiReview}
            >
              <Icon name="sparkles" size={16} />
              {editor?.state.selection.empty === false
                ? "선택 부분 AI 검토"
                : "AI 검토"}
            </Button>
          </span>
        </Hint>
      </span>
    </div>
  );
}
