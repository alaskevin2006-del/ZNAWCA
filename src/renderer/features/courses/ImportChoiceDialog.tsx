import { translate, type Locale } from "../../i18n/index";
import { importChoiceCopy } from "../../i18n/courses";

export function CourseImportChoiceDialog({
  locale,
  onChoose,
  onClose,
}: {
  locale: Locale;
  onChoose(mode: "scan" | "organize"): void;
  onClose(): void;
}) {
  const copy = importChoiceCopy[locale];
  return (
    <div className="dialog-backdrop">
      <section
        className="demo-dialog import-choice-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-choice-title"
      >
        <button
          className="dialog-close"
          type="button"
          aria-label={translate(locale, "close")}
          onClick={onClose}
        >
          ×
        </button>
        <p className="eyebrow">ZNAWCA</p>
        <h1 id="import-choice-title">{copy.title}</h1>
        <p className="import-choice-detail">{copy.detail}</p>
        <div className="import-choice-actions">
          <button
            className="import-choice-card"
            type="button"
            onClick={() => onChoose("scan")}
          >
            <strong>{copy.scanTitle}</strong>
            <span>{copy.scanDetail}</span>
          </button>
          <button
            className="import-choice-card is-recommended"
            type="button"
            onClick={() => onChoose("organize")}
          >
            <strong>{copy.organizeTitle}</strong>
            <span>{copy.organizeDetail}</span>
          </button>
        </div>
      </section>
    </div>
  );
}
