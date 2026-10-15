import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Course, SpeechAudioAsset } from "../../src/core/course/types";
import { defaultLocalState } from "../../src/application/state/defaults.js";
import { PlaybackCoordinator } from "../../src/renderer/shared/media/feedback-playback";
import { AppShell } from "../../src/renderer/app/AppShell";
import { installSmokeCourse, smokeCourse } from "./course-fixture";

// ZNAWCA-15 S3 自动验收（WORKBUDDY-TASKS.md §5，D-23）：
// 1. 文字题出现时自动播放问题单元格音频（题目本身是媒体时不播）。
// 2. 问题行与文字答案按钮有扬声器图标。
// 3. 点击扬声器只触发播放，不选中选项、不提交答案。

const SPEECH_URL = (coordinate: string): string => `znawca-media://speech/${coordinate}`;

// 坐标命名的朗读资产：A 列=名称（V1 nameColumnIndex 缺省 1）、B=Scientific name、C=Diet；
// 行 2..5 对应四个对象；B1-F/B1-R、C1-F/C1-R 为双向标题题干。
const speechAssets: SpeechAudioAsset[] = [
  "A2", "A3", "A4", "A5",
  "B1-F", "B1-R", "C1-F", "C1-R",
  "B2", "B3", "B4", "B5",
  "C2", "C3", "C4", "C5",
].map((coordinate) => ({ file: `${coordinate}.mp3`, url: SPEECH_URL(coordinate) }));

const speechCourse: Course = { ...smokeCourse, speech: speechAssets };

function mediaAsset(id: string, kind: "image") {
  return { kind, path: `C:/Courses/Media/${id}.jpg`, extension: "jpg", source: "standard" as const };
}

const mediaSpeechCourse: Course = {
  ...speechCourse,
  id: "media-speech-course",
  title: "Media Speech Course",
  directory: "C:/Courses/MediaSpeech",
  workbookPath: "C:/Courses/MediaSpeech/MediaSpeech.xlsx",
  items: speechCourse.items.map((item) => ({ ...item, media: [mediaAsset(item.id, "image")] })),
};

const allDirections = [
  "Name to property",
  "Property to name",
  "Image to name",
  "Name to image",
  "Audio to name",
  "Name to audio",
  "Video to name",
  "Name to video",
];

// 只保留一个题型方向（题型保持默认：input+choice）。
async function beginDirectionSession(course: Course, keepDirection: string) {
  render(<AppShell />);
  fireEvent.click(await screen.findByRole("button", { name: /Open course/ }));
  fireEvent.click(screen.getByRole("button", { name: /^Question types/ }));
  for (const name of allDirections) {
    const box = screen.getByRole("checkbox", { name }) as HTMLInputElement;
    if (box.checked !== (name === keepDirection)) fireEvent.click(box);
  }
  fireEvent.click(screen.getByRole("button", { name: /Begin learning/i }));
}

// 只保留一个题型方向且只开 Multiple choice（复用 D-11 测试的选择法）。
async function beginChoiceDirectionSession(course: Course, keepDirection: string) {
  render(<AppShell />);
  fireEvent.click(await screen.findByRole("button", { name: /Open course/ }));
  fireEvent.click(screen.getByRole("button", { name: /^Question types/ }));
  for (const name of allDirections) {
    const box = screen.getByRole("checkbox", { name }) as HTMLInputElement;
    if (box.checked !== (name === keepDirection)) fireEvent.click(box);
  }
  const input = screen.getByRole("checkbox", { name: "Text input" }) as HTMLInputElement;
  if (input.checked) fireEvent.click(input);
  fireEvent.click(screen.getByRole("button", { name: /Begin learning/i }));
}

describe("D-23 question narration playback", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("auto-plays the question cell narration when a text question appears", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const play = vi.spyOn(PlaybackCoordinator.prototype, "play").mockImplementation(() => {});
    installSmokeCourse(defaultLocalState(), speechCourse);
    render(<AppShell />);
    fireEvent.click(await screen.findByRole("button", { name: /Open course/ }));
    fireEvent.click(screen.getByRole("button", { name: /Begin learning/i }));
    expect(screen.getByText("0 / 8 mastered")).toBeVisible();
    // 首题是 cuckoo 的 Scientific name 输入题（正向）：名称单元格 A2 → 标题 B1-F。
    expect(play).toHaveBeenCalledWith([SPEECH_URL("A2"), SPEECH_URL("B1-F")]);
  });

  it("replays the narration from the question-row speaker without submitting", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const play = vi.spyOn(PlaybackCoordinator.prototype, "play").mockImplementation(() => {});
    installSmokeCourse(defaultLocalState(), speechCourse);
    render(<AppShell />);
    fireEvent.click(await screen.findByRole("button", { name: /Open course/ }));
    fireEvent.click(screen.getByRole("button", { name: /Begin learning/i }));
    expect(screen.getByText("0 / 8 mastered")).toBeVisible();
    play.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Play narration" }));
    expect(play).toHaveBeenCalledWith([SPEECH_URL("A2"), SPEECH_URL("B1-F")]);
    // 点击扬声器不等于提交：无反馈、答案输入仍可用。
    expect(screen.queryByText(/^Not quite$/)).toBeNull();
    expect(screen.queryByText(/^Correct$/)).toBeNull();
    expect(screen.getByRole("textbox", { name: "Your answer" })).toBeEnabled();
  });

  it("plays an option's narration from its speaker without selecting or submitting", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const play = vi.spyOn(PlaybackCoordinator.prototype, "play").mockImplementation(() => {});
    installSmokeCourse(defaultLocalState(), speechCourse);
    await beginChoiceDirectionSession(speechCourse, "Name to property");
    expect(screen.getByText("0 / 8 mastered")).toBeVisible();
    play.mockClear();
    const fieldset = screen.getByRole("group", { name: "Your answer" });
    const radios = within(fieldset).getAllByRole("radio");
    expect(radios).toHaveLength(4);
    // 每个文字答案按钮旁都有扬声器（问题行的扬声器在 fieldset 之外，位于最前）。
    const speakers = screen.getAllByRole("button", { name: "Play narration" });
    expect(speakers).toHaveLength(5);
    fireEvent.click(speakers[1]!);
    // 只播放该选项单元格的一段音频。
    expect(play).toHaveBeenCalledTimes(1);
    const [chain] = play.mock.calls[0]!;
    expect(chain).toHaveLength(1);
    expect(String(chain[0])).toMatch(/^znawca-media:\/\/speech\/[ABC][2-5]$/);
    // 点击扬声器不选中选项、不提交答案。
    expect(radios.every((radio) => !(radio as HTMLInputElement).checked)).toBe(true);
    expect(screen.queryByText(/^Not quite$/)).toBeNull();
    expect(screen.getByRole("button", { name: "Check answer" })).toBeEnabled();
  });

  it("does not auto-play when the question itself is media", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0);
    const play = vi.spyOn(PlaybackCoordinator.prototype, "play").mockImplementation(() => {});
    installSmokeCourse(defaultLocalState(), mediaSpeechCourse);
    await beginDirectionSession(mediaSpeechCourse, "Image to name");
    expect(screen.getByText("0 / 4 mastered")).toBeVisible();
    // 题目本身是图片：不自动朗读，也不显示问题行扬声器。
    expect(play).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Play narration" })).toBeNull();
  });
});
