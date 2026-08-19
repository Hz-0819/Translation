import { DatabaseSync } from "node:sqlite";

const FIELD_NAMES = [
  "word", "phonetic", "definition", "translation", "pos", "collins",
  "oxford", "tag", "bnc", "frq", "exchange", "detail", "audio",
];

export type DictionaryEntry = {
  word: string;
  phonetic: string;
  part: string;
  meanings: string[];
  definitions: string[];
  tags: string[];
  collins: number;
  oxford: boolean;
  bnc: number;
  frequency: number;
  forms: Array<{ label: string; value: string }>;
  audio: string;
};

export function normalizeDictionaryQuery(input = "") {
  const word = String(input).trim().toLowerCase().replace(/^[^a-z]+|[^a-z]+$/g, "");
  return word.length <= 80 && /^[a-z]+(?:['-][a-z]+)*$/i.test(word) ? word : "";
}

function lines(value: unknown) {
  return String(value || "").split(/\r?\n|\\n/).map(item => item.trim()).filter(Boolean);
}

function parseExchange(value: unknown) {
  const labels: Record<string, string> = {
    p: "过去式", d: "过去分词", i: "现在分词", "3": "第三人称单数",
    r: "比较级", t: "最高级", s: "复数", "0": "原形", "1": "原形",
  };
  return String(value || "").split("/").flatMap(part => {
    const splitAt = part.indexOf(":");
    if (splitAt < 1) return [];
    const type = part.slice(0, splitAt);
    return part.slice(splitAt + 1).split(",").filter(Boolean)
      .map(form => ({ label: labels[type] || type, value: form }));
  });
}

export class DictionaryStore {
  private readonly database: DatabaseSync;
  private readonly lookup;

  constructor(databasePath: string) {
    this.database = new DatabaseSync(databasePath, { readOnly: true });
    this.lookup = this.database.prepare(`SELECT ${FIELD_NAMES.join(", ")} FROM entries WHERE word = ? COLLATE NOCASE LIMIT 1`);
  }

  find(input: string): DictionaryEntry | null {
    const word = normalizeDictionaryQuery(input);
    const row = word ? this.lookup.get(word) as Record<string, unknown> | undefined : undefined;
    if (!row) return null;
    return {
      word: String(row.word),
      phonetic: row.phonetic ? `/${String(row.phonetic).replace(/^\/+|\/+$/g, "")}/` : "",
      part: String(row.pos || ""),
      meanings: lines(row.translation), definitions: lines(row.definition),
      tags: String(row.tag || "").split(/\s+/).filter(Boolean).map(tag => tag.toUpperCase()),
      collins: Number(row.collins) || 0, oxford: Boolean(Number(row.oxford)),
      bnc: Number(row.bnc) || 0, frequency: Number(row.frq) || 0,
      forms: parseExchange(row.exchange), audio: String(row.audio || ""),
    };
  }

  close() { this.database.close(); }
}
