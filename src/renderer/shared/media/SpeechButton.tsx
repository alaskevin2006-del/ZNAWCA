import { translate, type Locale } from "../../i18n/index";

export function SpeechButton({
  locale,
  onPlay,
}: {
  locale: Locale;
  onPlay(): void;
}) {
  const label = translate(locale, "playNarration");
  return (
    <button
      type="button"
      className="speech-button"
      aria-label={label}
      title={label}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onPlay();
      }}
    >
      <svg
        viewBox="0 0 24 24"
        width="18"
        height="18"
        aria-hidden="true"
        focusable="false"
      >
        <path d="M3 9v6h4l5 5V4L7 9H3z" fill="currentColor" />
        <path
          d="M16.5 12a4.5 4.5 0 0 0-2.5-4.03v8.05A4.5 4.5 0 0 0 16.5 12z"
          fill="currentColor"
        />
        <path
          d="M14 3.23v2.06c3.39.49 6 3.39 6 6.71s-2.61 6.22-6 6.71v2.06c4.5-.52 8-4.26 8-8.77s-3.5-8.25-8-8.77z"
          fill="currentColor"
        />
      </svg>
    </button>
  );
}
