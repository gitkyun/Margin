import { useCallback, useEffect, useRef, useState } from "react";
import { useMicrophone } from "voice-glow";
import {
  KoreanLiveSpeech,
  recognitionConstructor,
  type SpeechSnapshot,
} from "./live-speech";

/**
 * 입력창 받아쓰기. 미팅 실시간 전사와 같은 브라우저 한국어 음성 인식을 써요.
 * 음성은 녹음하거나 저장하지 않고, 마이크 스트림은 파형 높이에만 써요.
 */
export interface Dictation {
  /** 이 브라우저가 음성 인식을 지원하는지 */
  supported: boolean;
  listening: boolean;
  /** 음량 표시에 쓰는 마이크 스트림(듣는 중에만) */
  stream: MediaStream | null;
  /** 인식 엔진이 알려 준 문제(권한 거부·네트워크 등). 없으면 빈 글자 */
  message: string;
  start(): void;
  stop(): void;
}

/** 받아쓴 글을 기존 글 뒤에 한 칸 띄워 붙여요. */
export function joinDictation(base: string, spoken: string): string {
  const head = base.trimEnd();
  const tail = spoken.trim();
  if (!tail) return base;
  return head ? `${head} ${tail}` : tail;
}

export function useDictation(
  /** 받아쓰기를 시작할 때의 입력창 글 */
  current: () => string,
  /** 인식이 바뀔 때마다 입력창에 넣을 전체 글 */
  onText: (text: string) => void,
): Dictation {
  const Constructor = recognitionConstructor();
  const mic = useMicrophone();
  const [listening, setListening] = useState(false);
  const [message, setMessage] = useState("");
  const engine = useRef<KoreanLiveSpeech | null>(null);
  const base = useRef("");
  // 받아쓰는 동안 사용자가 입력창을 직접 고쳤는지 알아내기 위해 마지막으로 넣은 글과 인식 글을 기억해요.
  const lastWritten = useRef("");
  const lastSpoken = useRef("");
  const consumed = useRef("");
  // 멈춘 뒤 늦게 도착한 인식 결과나 마이크 권한이 입력창에 글을 다시 넣지 못하게 세대를 구분해요.
  const micSession = useRef(0);
  const speechSession = useRef(0);
  const write = useRef(onText);
  write.current = onText;
  const read = useRef(current);
  read.current = current;

  const stop = useCallback(() => {
    speechSession.current += 1;
    micSession.current += 1;
    const active = engine.current;
    engine.current = null;
    setListening(false);
    mic.stop();
    // 마지막 문장이 확정될 때까지 기다렸다가 엔진을 놓아요.
    void active?.finish().finally(() => active.dispose());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = useCallback(() => {
    if (!Constructor || engine.current) return;
    base.current = read.current();
    lastWritten.current = base.current;
    lastSpoken.current = "";
    consumed.current = "";
    setMessage("");
    const mySpeech = ++speechSession.current;
    const onChange = (snapshot: SpeechSnapshot) => {
      if (speechSession.current !== mySpeech || !engine.current) return;
      // 받아쓰는 중에 직접 고친 글은 지우지 않고, 그 글을 새 기준으로 삼아 이어 붙여요.
      const shown = read.current();
      if (shown !== lastWritten.current) {
        base.current = shown;
        consumed.current = lastSpoken.current;
      }
      const spoken = snapshot.text.startsWith(consumed.current)
        ? snapshot.text.slice(consumed.current.length)
        : snapshot.text;
      lastWritten.current = joinDictation(base.current, spoken);
      lastSpoken.current = snapshot.text;
      write.current(lastWritten.current);
      if (snapshot.state === "error" || snapshot.state === "unsupported") {
        setMessage(snapshot.message);
        stop();
      }
    };
    const next = new KoreanLiveSpeech(Constructor, onChange);
    engine.current = next;
    setListening(true);
    next.start();
    // 음량 파형용. 거부돼도 받아쓰기 자체는 인식 엔진이 따로 판단해요.
    const mine = ++micSession.current;
    void mic
      .start()
      .then((granted) => {
        if (micSession.current === mine) return;
        granted?.getTracks().forEach((track) => track.stop());
        mic.stop();
      })
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [Constructor, stop]);

  // 화면을 떠나면 마이크와 인식을 놓아요.
  useEffect(
    () => () => {
      speechSession.current += 1;
      micSession.current += 1;
      mic.stop();
      engine.current?.dispose();
      engine.current = null;
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return {
    supported: !!Constructor,
    listening,
    stream: listening ? mic.stream : null,
    message,
    start,
    stop,
  };
}
