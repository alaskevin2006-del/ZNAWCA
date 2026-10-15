import { useEffect, useRef, useState } from "react";
import { translate, type Locale } from "../../i18n/index";
import { courseMediaLabels } from "../../i18n/courses";

export function QuestionMedia({
  locale,
  media,
  volume,
  onVolume,
}: {
  locale: Locale;
  media: { kind: "image" | "audio" | "video"; path: string };
  volume: number;
  onVolume(value: number): void;
}) {
  const [failed, setFailed] = useState(false);
  const player = useRef<HTMLMediaElement | null>(null);
  useEffect(() => {
    if (player.current) player.current.volume = volume;
  }, [volume, media.path]);
  if (failed)
    return (
      <div className="question-media media-error" role="status">
        {translate(locale, "mediaUnavailable")}
      </div>
    );
  if (media.kind === "image")
    return (
      <div className="question-media">
        <img
          src={media.path}
          alt={translate(locale, "identifyObject")}
          onError={() => setFailed(true)}
        />
      </div>
    );
  if (media.kind === "audio")
    return (
      <div className="question-media">
        <audio
          ref={(element) => {
            player.current = element;
          }}
          src={media.path}
          controls
          aria-label={`${translate(locale, "identifyObject")} ${courseMediaLabels[locale].audio}`}
          onError={() => setFailed(true)}
          onVolumeChange={(event) => onVolume(event.currentTarget.volume)}
        />
      </div>
    );
  return (
    <div className="question-media">
      <video
        ref={(element) => {
          player.current = element;
        }}
        src={media.path}
        controls
        aria-label={`${translate(locale, "identifyObject")} ${courseMediaLabels[locale].video}`}
        onError={() => setFailed(true)}
        onVolumeChange={(event) => onVolume(event.currentTarget.volume)}
      />
    </div>
  );
}

// 「名称 → 媒体」方向的题目，其 acceptedAnswers 存的是媒体文件路径而非文字，
// 反馈时应渲染媒体（图片缩略图/音频/视频控件），而不是把路径当字符串显示。
// 媒体→名称方向（image/audio/video-to-name）的题干由 generator 硬编码为英文
// "Identify the object"，这里按界面语言本地化；其余方向直接显示 question.prompt。
// 注：客户反馈⑦的“用名称列首格替代”属 V2，本函数仅做本地化、不引入首格机制。
