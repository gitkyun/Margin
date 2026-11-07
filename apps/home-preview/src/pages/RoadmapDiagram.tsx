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
          border: "1px solid var(--input-line)",
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
        단계를 끌어 배치하고 연결점을 이어 보세요. 두 번 눌러 단계를 편집하거나
        연결을 제거합니다.
      </p>
    </div>
  );
}
