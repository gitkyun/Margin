import { t, tc } from "@/lib/i18n";
import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  type Node,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toast } from "sonner";
import { useWorkspace } from "@/lib/workspace";
import { useTheme } from "@/lib/theme";
import { formatDate, type ResearchPhase } from "@/lib/domain";
import { StatusBadge } from "@/components/common";
import "./planning/planning.css";

type PhaseNodeData = {
  number: number;
  title: string;
  period: string;
  status: ResearchPhase["status"];
  current: boolean;
};
type PhaseNode = Node<PhaseNodeData, "phase">;

/** 단계 기간: 시작일·목표일이 다 있으면 둘 다, 아니면 목표일만 */
function phasePeriod(phase: ResearchPhase): string {
  if (phase.startDate && phase.dueDate)
    return `${formatDate(phase.startDate, { month: "short", day: "numeric" })} – ${formatDate(phase.dueDate, { month: "short", day: "numeric" })}`;
  return t("목표일 · {date}", {
    date: formatDate(phase.dueDate, { month: "short", day: "numeric" }),
  });
}

/**
 * 관계도의 단계 카드: 번호·단계명·기간·상태. 현재 단계는 브랜드 색 2px 테두리와
 * 아주 느린 테두리 빛 흐름으로 표시해요(동작 줄이기에서는 멈춰요).
 */
function PhaseCard({ data }: NodeProps<PhaseNode>) {
  return (
    <div
      className={`roadmap-node is-${data.status}${data.current ? " is-current" : ""}`}
    >
      {data.current && (
        <span className="roadmap-node-beam" aria-hidden="true" />
      )}
      <Handle type="target" position={Position.Top} />
      <span className="roadmap-node-number">
        {t("단계 {number}", { number: String(data.number).padStart(2, "0") })}
      </span>
      <strong className="roadmap-node-title">{data.title}</strong>
      <span className="roadmap-node-period">{data.period}</span>
      <StatusBadge
        tone={
          data.current ? "blue" : data.status === "done" ? "green" : "neutral"
        }
      >
        {data.current
          ? t("현재 단계")
          : data.status === "done"
            ? t("완료")
            : data.status === "active"
              ? t("진행 중")
              : t("예정")}
      </StatusBadge>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}
const nodeTypes = { phase: PhaseCard };

export default function RoadmapDiagram({
  phases,
  currentId,
  onEdit,
}: {
  phases: ResearchPhase[];
  /** 연구의 현재 단계. 없으면 강조하지 않아요. */
  currentId?: string;
  onEdit: (phase: ResearchPhase) => void;
}) {
  const { save } = useWorkspace(),
    { resolvedTheme } = useTheme();
  const nodes = useMemo(
    (): PhaseNode[] =>
      phases.map((p, i) => ({
        id: p.id,
        type: "phase",
        position: p.position ?? {
          x: (i % 3) * 270,
          y: Math.floor(i / 3) * 170,
        },
        // 화면 읽기 프로그램이 노드 이름으로 읽어요.
        ariaLabel: `${p.title} · ${phasePeriod(p)}`,
        data: {
          number: i + 1,
          title: p.title,
          period: phasePeriod(p),
          status: p.status,
          current: p.id === currentId,
        },
      })),
    [phases, currentId],
  );
  const edges = phases.flatMap((p) =>
    p.dependsOn.map((id) => ({
      id: `${id}-${p.id}`,
      source: id,
      target: p.id,
      ariaLabel: t("{from} 다음 {to}", {
        from: phases.find((x) => x.id === id)?.title ?? t("이전 단계"),
        to: p.title,
      }),
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
        nodeTypes={nodeTypes}
        colorMode={resolvedTheme}
        fitView
        ariaLabelConfig={{
          "controls.ariaLabel": t("관계도 보기 조절"),
          "controls.zoomIn.ariaLabel": t("확대"),
          "controls.zoomOut.ariaLabel": t("축소"),
          "controls.fitView.ariaLabel": tc("fit", "전체 보기"),
          "node.a11yDescription.default": t(
            "두 번 누르면 단계를 편집해요. 키보드로는 ‘시간순’ 보기에서 편집할 수 있어요.",
          ),
          "node.a11yDescription.keyboardDisabled": t(
            "두 번 누르면 단계를 편집해요. 키보드로는 ‘시간순’ 보기에서 편집할 수 있어요.",
          ),
          "edge.a11yDescription.default": t("두 번 누르면 선을 지워요."),
          "handle.ariaLabel": t("연결점"),
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
        {t(
          "단계를 끌어 옮기고, 점끼리 이어 먼저 할 단계를 표시할 수 있어요. 선은 ‘시간순’ 보기의 순서를 바꾸지 않아요. 단계를 두 번 누르면 편집하고, 선을 두 번 누르면 지워요.",
        )}
      </p>
    </div>
  );
}
