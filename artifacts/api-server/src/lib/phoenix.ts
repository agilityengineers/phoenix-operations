import type { Answers } from "./phoenix-store";
export const score = (a: Answers) => {
  let value = 0; const get = (key: string) => String(a[key] ?? "");
  if (["$1M–$3M", "$3M–$10M", "$10M+"].includes(get("revenue"))) value += 15; else if (get("revenue") === "$500K–$1M") value += 8;
  if (["11–25", "26–50", "50+"].includes(get("employees"))) value += 10; else if (get("employees") === "4–10") value += 6;
  if (["Trades / home services", "Construction", "Professional services", "Manufacturing"].includes(get("industry"))) value += 8;
  if (["3–10 years", "10+ years"].includes(get("years"))) value += 7;
  value += get("role") === "Owner / Founder" ? 20 : get("role") === "CEO / President" ? 16 : get("ownerJoin") === "Yes" ? 10 : 2;
  const points: Record<string, number> = { "1": 0, "2": 2, "3": 4, "4": 6, "5": 8 }; value += points[get("coachAdmit")] ?? 0; value += points[get("coachOpen")] ?? 0;
  if (get("tried").length > 20) value += 4; if (Array.isArray(a.leastControl) && a.leastControl.length >= 2) value += 3; if (["Yes, currently", "Have in the past"].includes(get("coachHistory"))) value += 2;
  value += get("urgency") === "Now — this quarter" ? 15 : get("urgency") === "In the next 6 months" ? 9 : get("urgency") === "Just exploring" ? 3 : 0; return Math.min(100, value);
};
export const csv = (rows: Array<Record<string, string | number | undefined>>) => rows.length ? [Object.keys(rows[0]).join(","), ...rows.map(row => Object.keys(rows[0]).map(key => { const v = String(row[key] ?? ""); return /[",\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v; }).join(","))].join("\n") : "";
export const parseCsv = (text: string) => { const lines = text.trim().split(/\r?\n/); if (lines.length < 2) return []; const split = (line: string) => line.match(/(?:[^,"]+|"(?:[^"]|"")*")+/g)?.map(v => v.replace(/^"|"$/g, "").replaceAll('""','').trim()) ?? []; const h = split(lines[0]).map(x => x.toLowerCase()); return lines.slice(1).map(line => Object.fromEntries(split(line).map((v,i) => [h[i],v]))); };
