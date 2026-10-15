import { useEffect, useMemo, useRef } from "react";
import type { Course } from "../../../core/course/types";
import type { Question, AnswerEvaluation } from "../../../core/quiz/types";
import { mathRandomSource } from "../../../core/quiz/types";
import {
  speechAudioForAnswer,
  speechAudioForQuestion,
} from "../../../core/course/speech-audio";
import {
  PlaybackCoordinator,
  domAudioFactory,
  buildFeedbackPlaybackChain,
} from "./feedback-playback";

export function usePlayback(
  activeCourse: Course | undefined,
  question: Question | undefined,
  feedback: AnswerEvaluation | undefined,
  playerVolume: number,
) {
  const playbackRef = useRef<PlaybackCoordinator | undefined>(undefined);
  if (!playbackRef.current)
    playbackRef.current = new PlaybackCoordinator(domAudioFactory);
  const manualMediaRef = useRef<HTMLMediaElement | null>(null);
  const lastFeedbackSoundRef = useRef({ correct: -1, incorrect: -1 });
  const stopManualMedia = (): void => {
    const media = manualMediaRef.current;
    manualMediaRef.current = null;
    if (media) {
      try {
        media.pause();
      } catch {
        /* Native media may be unavailable in tests or damaged files. */
      }
    }
  };
  const stopAllPlayback = (): void => {
    playbackRef.current?.cancel();
    stopManualMedia();
  };

  useEffect(() => {
    const cancelOnManualPlay = (event: Event) => {
      // D-13：用户手动播放媒体时，取消自动链并停止上一条手动媒体，避免重叠。
      if (!(event.target instanceof HTMLMediaElement)) return;
      playbackRef.current?.cancel();
      const previous = manualMediaRef.current;
      if (previous && previous !== event.target) {
        // 互斥：顶掉上一个手动媒体，停止后进度归零（不保留续播位置）。
        try {
          previous.pause();
          previous.currentTime = 0;
        } catch {
          /* Ignore unavailable media controls. */
        }
      }
      manualMediaRef.current = event.target;
    };
    const clearManualMedia = (event: Event) => {
      if (event.target === manualMediaRef.current)
        manualMediaRef.current = null;
    };
    document.addEventListener("play", cancelOnManualPlay, true);
    document.addEventListener("pause", clearManualMedia, true);
    document.addEventListener("ended", clearManualMedia, true);
    return () => {
      document.removeEventListener("play", cancelOnManualPlay, true);
      document.removeEventListener("pause", clearManualMedia, true);
      document.removeEventListener("ended", clearManualMedia, true);
    };
  }, []);
  useEffect(() => {
    playbackRef.current?.setVolume(playerVolume);
  }, [playerVolume]);
  // D-22/D-23：当前文字题的问题单元格朗读链（题目本身是媒体时为空链）。
  const questionSpeech = useMemo(
    () =>
      question && activeCourse
        ? speechAudioForQuestion(activeCourse, question)
        : [],
    [question, activeCourse],
  );
  useEffect(() => {
    // D-23：新文字题出现时自动播放问题单元格音频；题目本身是媒体时不播，
    // 播放不阻断判题、计分、保存和下一题（submit/next 已各自 cancel）。
    if (!question || feedback) return;
    if (questionSpeech.length === 0) return;
    stopManualMedia();
    playbackRef.current?.play(questionSpeech);
  }, [question, feedback, questionSpeech]);
  const playSpeech = (urls: readonly string[]): void => {
    // 手动扬声器按钮：只播放，不提交答案、不改变会话状态。
    if (urls.length > 0) {
      stopManualMedia();
      playbackRef.current?.play([...urls]);
    }
  };
  useEffect(() => {
    // D-12/D-13：提交/超时产生 feedback 后，串行播放“正误提示音 → 正确答案音频”。
    if (!feedback || !question || !activeCourse) return;
    const selection = buildFeedbackPlaybackChain({
      fullyCorrect: feedback.fullyCorrect,
      feedbackSounds: activeCourse.feedbackSounds,
      question,
      random: mathRandomSource,
      previousCorrectIndex: lastFeedbackSoundRef.current.correct,
      previousIncorrectIndex: lastFeedbackSoundRef.current.incorrect,
      // D-22：文字题正确答案的朗读回退（无可靠答案媒体时接在链尾）。
      answerSpeech: speechAudioForAnswer(activeCourse, question),
    });
    lastFeedbackSoundRef.current = {
      correct: selection.correctIndex,
      incorrect: selection.incorrectIndex,
    };
    if (selection.chain.length > 0) {
      stopManualMedia();
      playbackRef.current?.play(selection.chain);
    }
  }, [feedback, question, activeCourse]);

  useEffect(() => () => stopAllPlayback(), []);
  return { stopAllPlayback, questionSpeech, playSpeech };
}
