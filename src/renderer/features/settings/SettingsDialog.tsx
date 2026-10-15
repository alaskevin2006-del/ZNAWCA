import { supportedLocales, translate, type Locale } from "../../i18n/index";
import { localeNames } from "../../i18n/settings";

export function SettingsDialog({
  locale,
  onLocale,
  onClearLearning,
  onClearTests,
  onClearAll,
  onClose,
}: {
  locale: Locale;
  onLocale(value: Locale): void;
  onClearLearning(): void;
  onClearTests(): void;
  onClearAll(): void;
  onClose(): void;
}) {
  return (
    <div className="dialog-backdrop">
      <section
        className="demo-dialog settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
      >
        <button
          className="dialog-close"
          aria-label={translate(locale, "close")}
          onClick={onClose}
        >
          ×
        </button>
        <p className="eyebrow">ZNAWCA</p>
        <h1 id="settings-title">{translate(locale, "settings")}</h1>
        <label className="settings-language">
          {translate(locale, "interfaceLanguage")}
          <select
            value={locale}
            onChange={(event) => onLocale(event.target.value as Locale)}
          >
            {supportedLocales.map((value) => (
              <option key={value} value={value}>
                {localeNames[value]}
              </option>
            ))}
          </select>
        </label>
        <h2>{translate(locale, "localData")}</h2>
        <div className="data-actions">
          <button className="metal-button" onClick={onClearLearning}>
            {translate(locale, "clearLearning")}
          </button>
          <button className="metal-button" onClick={onClearTests}>
            {translate(locale, "clearTests")}
          </button>
          <button className="danger-button" onClick={onClearAll}>
            {translate(locale, "clearAllData")}
          </button>
        </div>
        <button className="gold-button" onClick={onClose}>
          {translate(locale, "close")}
        </button>
      </section>
    </div>
  );
}
