import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Course } from "../../src/core/course/types";
import type { Question } from "../../src/core/quiz/types";
import { AppShell } from "../../src/renderer/app/AppShell";
import {
  PlaybackCoordinator,
  answerAudioPath,
  buildFeedbackPlaybackChain,
  type AudioFactory,
  type PlayableAudio,
} from "../../src/renderer/shared/media/feedback-playback";
import { defaultLocalState } from "../../src/application/state/defaults.js";
import { installSmokeCourse, smokeCourse } from "./course-fixture";

class FakeAudio implements PlayableAudio {
  volume: number;
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  played = false;
  paused = false;
  constructor(public readonly source: string, initialVolume: number) {
    this.volume = initialVolume;
  }
  play(): void { this.played = true; }
  pause(): void { this.paused = true; }
}

function makeFactory(created: FakeAudio[]): AudioFactory {
  return (source, volume) => {
    const audio = new FakeAudio(source, volume);
    created.push(audio);
    return audio;
  };
}

function source(values: number[]): { next(): number } {
  let index = 0;
  return { next: () => values[Math.min(index++, values.length - 1)] };
}

function question(overrides: Partial<Question>): Question {
  return {
    id: "q1",
    objectId: "obj",
    kind: "input",
    direction: "name-to-property",
    prompt: "Prompt",
    acceptedAnswers: ["answer"],
    ...overrides,
  };
}

describe("PlaybackCoordinator", () => {
  it("plays one source and continues only after it ends", () => {
    const created: FakeAudio[] = [];
    const coordinator = new PlaybackCoordinator(makeFactory(created));
    coordinator.play(["a", "b"]);
    expect(created.map((audio) => audio.source)).toEqual(["a"]);
    expect(created[0]?.played).toBe(true);
    created[0]!.onended?.();
    expect(created.map((audio) => audio.source)).toEqual(["a", "b"]);
    expect(created[1]?.played).toBe(true);
  });

  it("skips an empty source in the chain", () => {
    const created: FakeAudio[] = [];
    const coordinator = new PlaybackCoordinator(makeFactory(created));
    coordinator.play(["", "a"]);
    expect(created.map((audio) => audio.source)).toEqual(["a"]);
  });

  it("cancel stops the chain before the next source starts", () => {
    const created: FakeAudio[] = [];
    const coordinator = new PlaybackCoordinator(makeFactory(created));
    coordinator.play(["a", "b"]);
    coordinator.cancel();
    created[0]!.onended?.();
    expect(created).toHaveLength(1);
  });

  it("a new play request supersedes an active chain", () => {
    const created: FakeAudio[] = [];
    const coordinator = new PlaybackCoordinator(makeFactory(created));
    coordinator.play(["a", "b"]);
    coordinator.play(["x"]);
    // 旧链 a 的 ended 事件不能启动 b
    created[0]!.onended?.();
    expect(created.map((audio) => audio.source)).toEqual(["a", "x"]);
  });

  it("continues after an error and never throws", () => {
    const created: FakeAudio[] = [];
    const coordinator = new PlaybackCoordinator((sourceName, volume) => {
      const audio = new FakeAudio(sourceName, volume);
      if (sourceName === "broken") {
        // 模拟文件损坏：同步抛错
        throw new Error("not implemented");
      }
      created.push(audio);
      return audio;
    });
    expect(() => coordinator.play(["broken", "good"])).not.toThrow();
    expect(created.map((audio) => audio.source)).toEqual(["good"]);
    created[0]!.onerror?.();
    // 链已结束，不产生更多音频
    expect(created).toHaveLength(1);
  });

  it("skips a source whose play is rejected", () => {
    const created: FakeAudio[] = [];
    const coordinator = new PlaybackCoordinator((sourceName, volume) => {
      const audio = new FakeAudio(sourceName, volume);
      created.push(audio);
      return audio;
    });
    coordinator.play(["ok", "next"]);
    created[0]!.onerror?.();
    expect(created.map((audio) => audio.source)).toEqual(["ok", "next"]);
  });

  it("applies volume to new audio and to the currently playing audio", () => {
    const created: FakeAudio[] = [];
    const coordinator = new PlaybackCoordinator(makeFactory(created));
    coordinator.setVolume(0.4);
    coordinator.play(["a"]);
    expect(created[0]?.volume).toBe(0.4);
    coordinator.setVolume(0.8);
    expect(created[0]?.volume).toBe(0.8);
  });
});

describe("answerAudioPath", () => {
  it("uses the audio prompt for audio-to-name", () => {
    const result = answerAudioPath(question({ direction: "audio-to-name", media: { kind: "audio", path: "prompt.mp3" } }));
    expect(result).toBe("prompt.mp3");
  });

  it("uses the correct audio option for name-to-audio", () => {
    const result = answerAudioPath(question({
      direction: "name-to-audio",
      kind: "choice",
      acceptedAnswers: ["right"],
      options: [
        { id: "o1", label: "wrong", value: "wrong", objectId: "x", media: { kind: "audio", path: "wrong.mp3" } },
        { id: "o2", label: "right", value: "right", objectId: "y", media: { kind: "audio", path: "right.mp3" } },
      ],
    }));
    expect(result).toBe("right.mp3");
  });

  it("returns undefined when no reliable answer audio exists", () => {
    expect(answerAudioPath(question({ direction: "image-to-name", media: { kind: "image", path: "img.jpg" } }))).toBeUndefined();
    expect(answerAudioPath(question({ direction: "name-to-property" }))).toBeUndefined();
    expect(answerAudioPath(question({
      direction: "name-to-audio",
      kind: "choice",
      acceptedAnswers: ["right"],
      options: [{ id: "o1", label: "right", value: "right", objectId: "y" }], // 正确选项无媒体
    }))).toBeUndefined();
  });
});

describe("buildFeedbackPlaybackChain", () => {
  const sounds = { correct: ["correct-0.mp3", "correct-1.mp3"], incorrect: ["incorrect-0.mp3"] };

  it("uses the correct set for a fully correct answer", () => {
    const selection = buildFeedbackPlaybackChain({
      fullyCorrect: true,
      feedbackSounds: sounds,
      question: question({}),
      random: source([0]),
      previousCorrectIndex: -1,
      previousIncorrectIndex: 2,
    });
    expect(selection.chain).toEqual(["correct-0.mp3"]);
    expect(selection.correctIndex).toBe(0);
    expect(selection.incorrectIndex).toBe(2);
  });

  it("uses the incorrect set for partial, wrong and timeout results", () => {
    for (const fullyCorrect of [false]) {
      const selection = buildFeedbackPlaybackChain({
        fullyCorrect,
        feedbackSounds: sounds,
        question: question({}),
        random: source([0]),
        previousCorrectIndex: 1,
        previousIncorrectIndex: -1,
      });
      expect(selection.chain).toEqual(["incorrect-0.mp3"]);
      expect(selection.correctIndex).toBe(1);
      expect(selection.incorrectIndex).toBe(0);
    }
  });

  it("appends the answer audio after the feedback sound", () => {
    const selection = buildFeedbackPlaybackChain({
      fullyCorrect: false,
      feedbackSounds: sounds,
      question: question({ direction: "audio-to-name", media: { kind: "audio", path: "prompt.mp3" } }),
      random: source([0]),
      previousCorrectIndex: -1,
      previousIncorrectIndex: -1,
    });
    expect(selection.chain).toEqual(["incorrect-0.mp3", "prompt.mp3"]);
  });

  it("plays only the answer audio when the pool is empty", () => {
    const selection = buildFeedbackPlaybackChain({
      fullyCorrect: true,
      feedbackSounds: undefined,
      question: question({ direction: "name-to-audio", kind: "choice", acceptedAnswers: ["r"], options: [{ id: "o", label: "r", value: "r", objectId: "x", media: { kind: "audio", path: "ans.mp3" } }] }),
      random: source([0]),
      previousCorrectIndex: -1,
      previousIncorrectIndex: -1,
    });
    expect(selection.chain).toEqual(["ans.mp3"]);
    expect(selection.correctIndex).toBe(-1);
  });

  it("produces an empty chain and -1 indexes when nothing is available", () => {
    const selection = buildFeedbackPlaybackChain({
      fullyCorrect: true,
      feedbackSounds: undefined,
      question: question({}),
      random: source([0]),
      previousCorrectIndex: -1,
      previousIncorrectIndex: -1,
    });
    expect(selection.chain).toEqual([]);
    expect(selection.correctIndex).toBe(-1);
  });

  it("avoids consecutive repeats across submissions", () => {
    const first = buildFeedbackPlaybackChain({
      fullyCorrect: true,
      feedbackSounds: sounds,
      question: question({}),
      random: source([0.75]),
      previousCorrectIndex: -1,
      previousIncorrectIndex: -1,
    });
    expect(first.correctIndex).toBe(1);
    // 下一次 random 又选中 1 → 强制避重到 0
    const second = buildFeedbackPlaybackChain({
      fullyCorrect: true,
      feedbackSounds: sounds,
      question: question({}),
      random: source([0.75]),
      previousCorrectIndex: first.correctIndex,
      previousIncorrectIndex: -1,
    });
    expect(second.chain).toEqual(["correct-0.mp3"]);
    expect(second.correctIndex).toBe(0);
  });

  it("appends the answer speech chain when no reliable answer media exists (D-22)", () => {
    // 文字题（name-to-property）无答案媒体 → 回退接 answerSpeech 朗读链。
    const selection = buildFeedbackPlaybackChain({
      fullyCorrect: false,
      feedbackSounds: sounds,
      question: question({ direction: "name-to-property" }),
      random: source([0]),
      previousCorrectIndex: -1,
      previousIncorrectIndex: -1,
      answerSpeech: ["speech://C2.mp3"],
    });
    expect(selection.chain).toEqual(["incorrect-0.mp3", "speech://C2.mp3"]);
  });

  it("plays only the answer speech when no sound pool exists", () => {
    const selection = buildFeedbackPlaybackChain({
      fullyCorrect: true,
      feedbackSounds: undefined,
      question: question({ direction: "image-to-name", media: { kind: "image", path: "img.jpg" } }),
      random: source([0]),
      previousCorrectIndex: -1,
      previousIncorrectIndex: -1,
      answerSpeech: ["speech://B2.mp3"],
    });
    expect(selection.chain).toEqual(["speech://B2.mp3"]);
  });

  it("prefers the answer media over the answer speech when both exist", () => {
    const selection = buildFeedbackPlaybackChain({
      fullyCorrect: true,
      feedbackSounds: undefined,
      question: question({ direction: "audio-to-name", media: { kind: "audio", path: "prompt.mp3" } }),
      random: source([0]),
      previousCorrectIndex: -1,
      previousIncorrectIndex: -1,
      answerSpeech: ["speech://B2.mp3"],
    });
    expect(selection.chain).toEqual(["prompt.mp3"]);
  });
});

describe("manual media mutual exclusion (audio + video)", () => {
  // 客户反馈：点另一个音频时上一个必须停止（且进度归零，不双击）。
  // 互斥走 document 级捕获监听 + HTMLMediaElement 判定，<video> 同属该类，
  // 因此音频/视频任意组合都被同一逻辑覆盖。jsdom 不实现真实播放，
  // 用 spy 观测 pause()、用 defineProperty 观测 currentTime 归零。
  function fakeMedia(tag: "audio" | "video", startAt: number): HTMLMediaElement {
    const element = document.createElement(tag);
    Object.defineProperty(element, "currentTime", { value: startAt, writable: true, configurable: true });
    vi.spyOn(element, "pause").mockImplementation(() => {});
    document.body.appendChild(element);
    return element as HTMLMediaElement;
  }

  async function renderShell(): Promise<void> {
    installSmokeCourse(defaultLocalState(), smokeCourse);
    render(<AppShell />);
    await screen.findByRole("button", { name: /Open course/ });
  }

  it("stops and resets an audio when a video starts playing", async () => {
    await renderShell();
    const audio = fakeMedia("audio", 12);
    const video = fakeMedia("video", 0);
    fireEvent(audio, new Event("play"));
    fireEvent(video, new Event("play"));
    expect(audio.pause).toHaveBeenCalled();
    expect(audio.currentTime).toBe(0);
    audio.remove();
    video.remove();
  });

  it("stops and resets a video when another video starts playing", async () => {
    await renderShell();
    const first = fakeMedia("video", 7);
    const second = fakeMedia("video", 0);
    fireEvent(first, new Event("play"));
    fireEvent(second, new Event("play"));
    expect(first.pause).toHaveBeenCalled();
    expect(first.currentTime).toBe(0);
    first.remove();
    second.remove();
  });

  it("does not touch the element that is currently playing", async () => {
    await renderShell();
    const first = fakeMedia("video", 3);
    fireEvent(first, new Event("play"));
    expect(first.pause).not.toHaveBeenCalled();
    expect(first.currentTime).toBe(3);
    first.remove();
  });
});

describe("AppShell feedback playback integration", () => {
  it("answers normally with feedback sounds present and never blocks the next step", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const feedbackCourse: Course = {
      ...smokeCourse,
      feedbackSounds: {
        correct: ["znawca-media://correct-0", "znawca-media://correct-1"],
        incorrect: ["znawca-media://incorrect-0"],
      },
    };
    installSmokeCourse(defaultLocalState(), feedbackCourse);
    render(<AppShell />);
    fireEvent.click(await screen.findByRole("button", { name: /Open course/ }));
    fireEvent.click(screen.getByRole("button", { name: /Begin learning/i }));
    fireEvent.change(screen.getByRole("textbox", { name: "Your answer" }), { target: { value: "Cuculus canorus" } });
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));
    expect(screen.getByText(/^Correct$/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    expect(screen.getByText("1 / 8 mastered")).toBeVisible();
  });

  it("answers normally when the sound pool is empty (no blocking)", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    installSmokeCourse(defaultLocalState(), smokeCourse); // 无 feedbackSounds
    render(<AppShell />);
    fireEvent.click(await screen.findByRole("button", { name: /Open course/ }));
    fireEvent.click(screen.getByRole("button", { name: /Begin learning/i }));
    fireEvent.change(screen.getByRole("textbox", { name: "Your answer" }), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));
    expect(screen.getByText(/^Not quite$/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    expect(screen.getByText("0 / 8 mastered")).toBeVisible();
  });

  const sounds = {
    correct: ["znawca-media://correct-0", "znawca-media://correct-1"],
    incorrect: ["znawca-media://incorrect-0"],
  };
  const feedbackCourse = { ...smokeCourse, feedbackSounds: sounds };
  const dietCourse: Course = {
    ...smokeCourse,
    columns: [{ index: 2, title: "Diet", displayTitle: "Diet", filterOnly: false }],
    items: smokeCourse.items.map((item) => ({ ...item, values: { Diet: item.values["Diet"]! } })),
  };

  it("plays the correct sound set for a fully correct answer", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const play = vi.spyOn(PlaybackCoordinator.prototype, "play").mockImplementation(() => {});
    installSmokeCourse(defaultLocalState(), feedbackCourse);
    render(<AppShell />);
    fireEvent.click(await screen.findByRole("button", { name: /Open course/ }));
    fireEvent.click(screen.getByRole("button", { name: /Begin learning/i }));
    fireEvent.change(screen.getByRole("textbox", { name: "Your answer" }), { target: { value: "Cuculus canorus" } });
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));
    expect(screen.getByText(/^Correct$/)).toBeVisible();
    expect(play).toHaveBeenCalledWith(["znawca-media://correct-0"]);
  });

  it("plays the incorrect sound set for a wrong answer", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const play = vi.spyOn(PlaybackCoordinator.prototype, "play").mockImplementation(() => {});
    installSmokeCourse(defaultLocalState(), feedbackCourse);
    render(<AppShell />);
    fireEvent.click(await screen.findByRole("button", { name: /Open course/ }));
    fireEvent.click(screen.getByRole("button", { name: /Begin learning/i }));
    fireEvent.change(screen.getByRole("textbox", { name: "Your answer" }), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));
    expect(screen.getByText(/^Not quite$/)).toBeVisible();
    expect(play).toHaveBeenCalledWith(["znawca-media://incorrect-0"]);
  });

  it("plays the incorrect sound set for a partially correct multi-part answer", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const play = vi.spyOn(PlaybackCoordinator.prototype, "play").mockImplementation(() => {});
    installSmokeCourse(defaultLocalState(), { ...dietCourse, feedbackSounds: sounds });
    render(<AppShell />);
    fireEvent.click(await screen.findByRole("button", { name: /Open course/ }));
    fireEvent.click(screen.getByRole("button", { name: /Begin learning/i }));
    // Diet 的完整答案是 "insects; seeds; nuts"；只答 "insects" 是部分正确。
    fireEvent.change(screen.getByRole("textbox", { name: "Your answer" }), { target: { value: "insects" } });
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));
    expect(screen.getByText(/^Not quite$/)).toBeVisible();
    expect(play).toHaveBeenCalledWith(["znawca-media://incorrect-0"]);
  });

  it("plays the incorrect sound set when the testing timer expires", async () => {
    try {
      vi.spyOn(Math, "random").mockReturnValue(0);
      const play = vi.spyOn(PlaybackCoordinator.prototype, "play").mockImplementation(() => {});
      installSmokeCourse(defaultLocalState(), feedbackCourse);
      render(<AppShell />);
      fireEvent.click(await screen.findByRole("button", { name: /Open course/ }));
      fireEvent.click(screen.getByRole("button", { name: /^Testing/ }));
      fireEvent.click(screen.getByRole("button", { name: /^Per-question timer/ }));
      fireEvent.click(screen.getByRole("button", { name: "10s" }));
      // 在开始会话前切换到 fake timers，使 Session 的倒计时 setInterval 走 fake 时钟。
      vi.useFakeTimers();
      fireEvent.click(screen.getByRole("button", { name: /Begin Testing/i }));
      // 推进超过 10 秒触发超时，超时按错误处理（incorrect 集合）。
      await act(async () => { vi.advanceTimersByTime(11000); });
      expect(screen.getByText(/^Not quite$/)).toBeVisible();
      expect(play).toHaveBeenCalledWith(["znawca-media://incorrect-0"]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("cancels the playback chain when advancing to the next question", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const cancel = vi.spyOn(PlaybackCoordinator.prototype, "cancel");
    installSmokeCourse(defaultLocalState(), feedbackCourse);
    render(<AppShell />);
    fireEvent.click(await screen.findByRole("button", { name: /Open course/ }));
    fireEvent.click(screen.getByRole("button", { name: /Begin learning/i }));
    fireEvent.change(screen.getByRole("textbox", { name: "Your answer" }), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "Check answer" }));
    // submit 内部也会 cancel，先清零再验证“切题”这一动作触发 cancel。
    cancel.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Next question" }));
    expect(cancel).toHaveBeenCalled();
  });
});
