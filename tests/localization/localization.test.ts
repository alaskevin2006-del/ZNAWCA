import { describe, expect, it } from "vitest";
import { supportedLocales, textDirection, translate } from "../../src/core/localization";

describe("localization", () => {
  it("ships all five required interface languages", () => {
    expect(supportedLocales).toEqual(["en", "pl", "zh-CN", "ar", "ru"]);
    for (const locale of supportedLocales) expect(translate(locale, "courses")).toBeTruthy();
  });
  it("uses RTL only for Arabic", () => {
    expect(textDirection("ar")).toBe("rtl");
    expect(textDirection("zh-CN")).toBe("ltr");
  });
});

