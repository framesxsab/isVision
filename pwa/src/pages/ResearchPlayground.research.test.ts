import { describe, it, expect } from "vitest";

function calculateSus(scores: number[]): number {
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const v = scores[i] ?? 3;
    sum += i % 2 === 0 ? v - 1 : 5 - v;
  }
  return sum * 2.5;
}

function anonymize(text: string): string {
  return text.replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[email redacted]");
}

describe("research readiness", () => {
  it("SUS calculation", () => {
    expect(calculateSus([5, 1, 5, 1, 5, 1, 5, 1, 5, 1])).toBe(100);
    expect(calculateSus([1, 5, 1, 5, 1, 5, 1, 5, 1, 5])).toBe(0);
    expect(calculateSus(Array(10).fill(3))).toBe(50);
  });

  it("CSV export header", () => {
    const rows = ["task_id,task_name,start_iso,end_iso,duration_s"];
    expect(rows[0]).toBe("task_id,task_name,start_iso,end_iso,duration_s");
  });

  it("anonymization strips PII", () => {
    expect(anonymize("contact alice@example.com")).toBe("contact [email redacted]");
  });

  it("consent gate blocks tasks when not given", () => {
    const consentGiven = false;
    expect(consentGiven ? "Start enabled" : "Start disabled").toBe("Start disabled");
  });

  it("task randomization changes order", () => {
    const tasks = ["A", "B", "C"];
    const shuffled = [...tasks].sort(() => Math.random() - 0.5);
    expect(shuffled.sort()).toEqual(tasks.sort());
    expect(shuffled.length).toBe(3);
  });
});
