import { describe, expect, it } from "vitest";
import {
  AGENT_INSTRUCTIONS_MAX,
  DEFAULT_BOT_TYPE,
  agentPreferencePatch,
  readAgentProfile,
  sameAgentProfile,
} from "./research-agent";

describe("research agent preferences", () => {
  it("falls back to the default Margin bot for missing or unknown values", () => {
    expect(readAgentProfile(undefined)).toEqual({
      name: "",
      instructions: "",
      tone: "default",
      botType: DEFAULT_BOT_TYPE,
    });
    const unknown = readAgentProfile({
      agentTone: "shout",
      agentBotType: "dragon",
    });
    expect(unknown.tone).toBe("default");
    expect(unknown.botType).toBe(DEFAULT_BOT_TYPE);
    // 앱에서 뺀 형태(메카 등)는 기본 봇으로 돌아가요.
    expect(readAgentProfile({ agentBotType: "mech" }).botType).toBe(
      DEFAULT_BOT_TYPE,
    );
  });

  it("removes control characters, limits lengths and keeps a chosen bot", () => {
    const profile = readAgentProfile({
      agentName: " 콩\u0000이  봇 ",
      agentInstructions: `${"가".repeat(1200)}`,
      agentTone: "friendly",
      agentBotType: "clover",
    });
    expect(profile.name).toBe("콩이 봇");
    expect(profile.instructions).toHaveLength(AGENT_INSTRUCTIONS_MAX);
    expect(profile.tone).toBe("friendly");
    expect(profile.botType).toBe("clover");
  });

  it("saves every key so cleared values replace old ones", () => {
    const patch = agentPreferencePatch({
      name: "",
      instructions: " 짧게 ",
      tone: "concise",
      botType: "ghost",
    });
    expect(patch).toEqual({
      agentName: "",
      agentInstructions: "짧게",
      agentTone: "concise",
      agentBotType: "ghost",
    });
    expect(
      sameAgentProfile(readAgentProfile(patch), readAgentProfile(patch)),
    ).toBe(true);
  });
});
