const ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  apos: "'",
  gt: ">",
  lt: "<",
  quot: '"',
};

export function decodeXml(value: string): string {
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|\w+);/giu,
    (match, entity: string) => {
      if (entity.startsWith("#x"))
        return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
      if (entity.startsWith("#"))
        return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
      return ENTITIES[entity] ?? match;
    },
  );
}

export function firstAttribute(
  xml: string,
  tag: string,
  attribute: string,
): string | undefined {
  const match = new RegExp(
    `<(?:[\\w.-]+:)?${tag}\\b[^>]*\\b${attribute}=(?:"([^"]*)"|'([^']*)')`,
    "iu",
  ).exec(xml);
  return match ? decodeXml(match[1] ?? match[2] ?? "") : undefined;
}

export function allTagContents(xml: string, tag: string): readonly string[] {
  const values: string[] = [];
  const expression = new RegExp(
    `<(?:[\\w.-]+:)?${tag}\\b[^>]*>([\\s\\S]*?)<\\/(?:[\\w.-]+:)?${tag}>`,
    "giu",
  );
  for (const match of xml.matchAll(expression)) values.push(match[1] ?? "");
  return values;
}

export function textFromRichString(xml: string): string {
  return allTagContents(xml, "t")
    .map((value) => decodeXml(value.replace(/<[^>]+>/gu, "")))
    .join("");
}
