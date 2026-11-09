import { useCallback, useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  type Node,
  type NodeMouseHandler,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace";
import { useTheme } from "@/lib/theme";
import type { ResearchPhase } from "@/lib/domain";
export default function RoadmapDiagram({
  phases,
  onEdit,
}: {
  phases: ResearchPhase[];
  onEdit: (phase: ResearchPhase) => void;
}) {
  const { save } = useWorkspace(),
    { resolvedTheme } = useTheme();
  const nodes = useMemo(
    () =>
      phases.map((p, i) => ({
        id: p.id,
        position: p.position ?? {
          x: (i % 3) * 270,
          y: Math.floor(i / 3) * 160,
        },
        data: { label: p.title },
        style: {
          background: "var(--surface)",
          color: "var(--text)",
          border: "1px solid var(--line-strong)",
          borderRadius: 12,
          padding: 20,
          width: 215,
        },
      })),
    [phases],
  );
  const edges = phases.flatMap((p) =>
    p.dependsOn.map((id) => ({
      id: `${id}-${p.id}`,
      source: id,
      target: p.id,
      ariaLabel: `${phases.find((x) => x.id === id)?.title ?? "이전 단계"} 다음 ${p.title}`,
      markerEnd: { type: MarkerType.ArrowClosed },
    })),
  );
  async function persist(id: string, value: Partial<ResearchPhase>) {
    const p = phases.find((p) => p.id === id);
    if (p)
      try {
        await save("phases", { ...p, ...value });
      } catch (e) {
        toast.error((e as Error).message);
      }
  }
  return (
    <div className="roadmap-diagram">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        colorMode={resolvedTheme}
        fitView
        ariaLabelConfig={{
          "controls.ariaLabel": "관계도 보기 조절",
          "controls.zoomIn.ariaLabel": "확대",
          "controls.zoomOut.ariaLabel": "축소",
          "controls.fitView.ariaLabel": "전체 보기",
          "node.a11yDescription.default":
            "두 번 누르면 단계를 편집해요. 키보드로는 ‘시간순’ 보기에서 편집할 수 있어요.",
          "node.a11yDescription.keyboardDisabled":
            "두 번 누르면 단계를 편집해요. 키보드로는 ‘시간순’ 보기에서 편집할 수 있어요.",
          "edge.a11yDescription.default": "두 번 누르면 선을 지워요.",
          "handle.ariaLabel": "연결점",
        }}
        onNodeDoubleClick={(_, n) => onEdit(phases.find((p) => p.id === n.id)!)}
        onNodeDragStop={(_, n) => void persist(n.id, { position: n.position })}
        onConnect={(c) => {
          if (c.source === c.target) return;
          const p = phases.find((p) => p.id === c.target);
          if (p)
            void persist(p.id, {
              dependsOn: [...new Set([...p.dependsOn, c.source])],
            });
        }}
        onEdgeDoubleClick={(_, e) => {
          const p = phases.find((p) => p.id === e.target);
          if (p)
            void persist(p.id, {
              dependsOn: p.dependsOn.filter((id) => id !== e.source),
            });
        }}
      >
        <Background gap={24} />
        <Controls showInteractive={false} />
      </ReactFlow>
      <p>
        단계를 끌어 옮기고, 점끼리 이어 먼저 할 단계를 표시할 수 있어요. 선은
        ‘시간순’ 보기의 순서를 바꾸지 않아요. 단계를 두 번 누르면 편집하고, 선을
        두 번 누르면 지워요.
      </p>
    </div>
  );
}
