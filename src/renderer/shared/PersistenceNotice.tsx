import type { Locale } from "../../core/shared/locale";
import { persistenceCopy } from "../i18n/persistence";
import "../styles/persistence.css";

export function PersistenceNotice({
  locale,
  onRetry,
}: {
  locale: Locale;
  onRetry(): void;
}) {
  const copy = persistenceCopy[locale];
  return (
    <div className="persistence-notice" role="alert">
      <span>{copy.failed}</span>
      <button className="metal-button" type="button" onClick={onRetry}>
        {copy.retry}
      </button>
    </div>
  );
}
