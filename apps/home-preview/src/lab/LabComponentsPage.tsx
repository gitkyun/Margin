/**
 * 시안: 지금 부품(Montage)과 후보 부품(coss ui)을 같은 토큰으로 나란히 봅니다.
 * 제품 화면이 아니라 비교용이라 문구를 번역하지 않습니다.
 */
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tabs } from "@/components/ui/tabs";
import { Icon } from "@/components/icons";
import { Button as CossButton } from "./coss/button";
import {
  Dialog as CossDialog,
  DialogClose,
  DialogDescription as CossDialogDescription,
  DialogFooter,
  DialogHeader as CossDialogHeader,
  DialogPopup,
  DialogTitle as CossDialogTitle,
  DialogTrigger,
} from "./coss/dialog";
import { Input as CossInput } from "./coss/input";
import {
  Menu,
  MenuItem,
  MenuPopup,
  MenuSeparator,
  MenuTrigger,
} from "./coss/menu";
import {
  Tabs as CossTabs,
  TabsList,
  TabsPanel,
  TabsTab,
} from "@/components/ui/coss/tabs";
import "./lab.css";

const TAB_OPTIONS = [
  { value: "prepare", label: "준비" },
  { value: "record", label: "기록" },
  { value: "decisions", label: "결정·질문", count: 2 },
];

const TRASH_COPY =
  "공동연구자 2명이 접근할 수 없게 되고, 공유 중인 검토 요청 1건이 중지돼요. 휴지통에서 언제든 복원할 수 있어요.";

function Row({
  title,
  note,
  now,
  next,
}: {
  title: string;
  note: string;
  now: ReactNode;
  next: ReactNode;
}) {
  return (
    <section className="lab-row">
      <header>
        <h2>{title}</h2>
        <p>{note}</p>
      </header>
      <div className="lab-cell">
        <span className="lab-tag">지금 · Montage</span>
        <div className="lab-stage">{now}</div>
      </div>
      <div className="lab-cell">
        <span className="lab-tag lab-tag-next">후보 · coss ui</span>
        <div className="lab-stage">{next}</div>
      </div>
    </section>
  );
}

export function LabComponentsPage() {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("prepare");
  return (
    <main className="lab-page">
      <header className="lab-head">
        <p className="lab-eyebrow">시안 · 제품에 반영되지 않았어요</p>
        <h1>부품 비교</h1>
        <p>
          왼쪽은 지금 쓰는 Montage 부품, 오른쪽은 coss ui(Base UI) 부품이에요.
          오른쪽도 색·글자는 우리 토큰을 그대로 받아요. 직접 눌러 보고, 화면
          모드(라이트·다크)를 바꿔 보세요.
        </p>
        <nav>
          <Link to="/lab/expand">확대 전환 시안 보기 →</Link>
          <Link to="/r">내 연구로</Link>
        </nav>
      </header>

      <Row
        title="버튼"
        note="주 버튼 · 테두리 · 글자 · 위험. 눌렀을 때 반응과 포커스 고리를 비교해 보세요."
        now={
          <div className="lab-inline">
            <Button>미팅 만들기</Button>
            <Button variant="outline">
              <Icon name="plus" size={16} />
              직접 작성
            </Button>
            <Button variant="ghost">AI 제안</Button>
            <Button variant="destructive">휴지통으로 옮기기</Button>
            <Button disabled>저장</Button>
          </div>
        }
        next={
          <div className="lab-inline">
            <CossButton>미팅 만들기</CossButton>
            <CossButton variant="outline">
              <Icon name="plus" size={16} />
              직접 작성
            </CossButton>
            <CossButton variant="ghost">AI 제안</CossButton>
            <CossButton variant="destructive">휴지통으로 옮기기</CossButton>
            <CossButton disabled>저장</CossButton>
          </div>
        }
      />

      <Row
        title="대화상자"
        note="지난번 지적한 ‘아랫쪽’ 비교. 머리·본문·버튼 줄의 간격과 정렬, 열리고 닫히는 움직임을 보세요."
        now={
          <>
            <Button variant="outline" onClick={() => setOpen(true)}>
              휴지통 대화상자 열기
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogContent className="rms-dialog">
                <DialogHeader>
                  <DialogTitle>연구를 휴지통으로 옮길까요?</DialogTitle>
                  <DialogDescription>{TRASH_COPY}</DialogDescription>
                </DialogHeader>
                <div className="bottom-actions">
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    취소
                  </Button>
                  <Button variant="destructive" onClick={() => setOpen(false)}>
                    휴지통으로 옮기기
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </>
        }
        next={
          <CossDialog>
            <DialogTrigger render={<CossButton variant="outline" />}>
              휴지통 대화상자 열기
            </DialogTrigger>
            <DialogPopup>
              <CossDialogHeader>
                <CossDialogTitle>연구를 휴지통으로 옮길까요?</CossDialogTitle>
                <CossDialogDescription>{TRASH_COPY}</CossDialogDescription>
              </CossDialogHeader>
              <DialogFooter>
                <DialogClose render={<CossButton variant="ghost" />}>
                  취소
                </DialogClose>
                <DialogClose render={<CossButton variant="destructive" />}>
                  휴지통으로 옮기기
                </DialogClose>
              </DialogFooter>
            </DialogPopup>
          </CossDialog>
        }
      />

      <Row
        title="탭"
        note="오른쪽은 선택 표시가 다음 탭으로 미끄러져 이동해요."
        now={
          <Tabs
            value={tab}
            onChange={setTab}
            options={TAB_OPTIONS}
            label="미팅 탭"
          />
        }
        next={
          <div className="lab-stack">
            <CossTabs defaultValue="prepare">
              <TabsList variant="underline">
                <TabsTab value="prepare">준비</TabsTab>
                <TabsTab value="record">기록</TabsTab>
                <TabsTab value="decisions">결정·질문</TabsTab>
              </TabsList>
              <TabsPanel value="prepare" className="lab-panel">
                이번 미팅에서 보여줄 결과
              </TabsPanel>
              <TabsPanel value="record" className="lab-panel">
                미팅 메모와 녹음
              </TabsPanel>
              <TabsPanel value="decisions" className="lab-panel">
                결정 2개
              </TabsPanel>
            </CossTabs>
            <CossTabs defaultValue="left">
              <TabsList>
                <TabsTab value="left">남은 할 일</TabsTab>
                <TabsTab value="done">완료</TabsTab>
                <TabsTab value="all">전체</TabsTab>
              </TabsList>
            </CossTabs>
          </div>
        }
      />

      <Row
        title="메뉴"
        note="⋯ 더보기 메뉴. 열리는 움직임과 항목 간격을 비교해 보세요."
        now={
          <DropdownMenu>
            <DropdownMenuTrigger>
              <Button variant="outline">
                더보기
                <Icon name="more" size={16} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={() => undefined}>
                <Icon name="edit" size={16} />
                이름 바꾸기
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => undefined}>
                <Icon name="trash" size={16} />
                휴지통으로 옮기기
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
        next={
          <Menu>
            <MenuTrigger render={<CossButton variant="outline" />}>
              더보기
              <Icon name="more" size={16} />
            </MenuTrigger>
            <MenuPopup align="start">
              <MenuItem>
                <Icon name="edit" size={16} />
                이름 바꾸기
              </MenuItem>
              <MenuSeparator />
              <MenuItem variant="destructive">
                <Icon name="trash" size={16} />
                휴지통으로 옮기기
              </MenuItem>
            </MenuPopup>
          </Menu>
        }
      />

      <Row
        title="입력칸"
        note="포커스했을 때 테두리와 고리, 안내 글 색을 비교해 보세요."
        now={
          <label className="field lab-field">
            연구 이름
            <Input placeholder="예: 대학원생의 연구 도구 사용 경험" />
          </label>
        }
        next={
          <label className="lab-field lab-field-next">
            연구 이름
            <CossInput placeholder="예: 대학원생의 연구 도구 사용 경험" />
          </label>
        }
      />
    </main>
  );
}
