import { computeScore } from "./rubric";
import { P2_Q2E_RUBRIC, P2_Q3A_RUBRIC, P2_Q3B_RUBRIC, P2_Q3C_RUBRIC } from "./paper2";
import type { Findings, Rubric } from "./types";

/**
 * A worked example built from a real photographed answer book (booklet pages 21 to 27).
 * The pages were read and marked against the Physiology Paper II draft scheme, as the AI reader does: marks come from
 * the scheme, every deduction has a reason, and every line remembers where it sits on the page so the scan can be cropped.
 */
export const SAMPLE_SCRIPT_ID = "PHY2-1001";
/** The same booklet, already marked and published to a student, so the student side shows the real crops. */
export const SAMPLE_PUBLISHED_ID = "PHY2-1002";
const H = 1308; // height in pixels of each cropped page picture

/** [page 1 to 7, top px, bottom px, text, point the line earned marks for] */
type L = [number, number, number, string, string?];
type Q = { rubric: Rubric; marks: number; lines: L[]; points: Record<string, { m: number; conf: "high" | "medium" | "low"; why?: string }>; terms: string[]; note?: string };

const ID = (r: Rubric, i: number) => r.points[i].id;

const Q2E: Q = {
  rubric: P2_Q2E_RUBRIC, marks: 5, terms: [],
  lines: [
    [1, 140, 220, "Anti-inflammatory and antiallergic effects of glucocorticoids."],
    [1, 280, 350, "Anti inflammation is done by glucocorticoids."],
    [1, 430, 505, "Whenever there is histamine release from mast cell."],
    [1, 540, 650, "inflammation occurs -> it is prevented by consuming glucocorticoids", ID(P2_Q2E_RUBRIC, 1)],
    [1, 725, 800, "They are responsible for release of vasopressors"],
    [1, 840, 955, "Causing vasodilation and inhibiting the vasoconstriction effect of histamine"],
    [1, 1035, 1080, "preventing inflammation."],
    [1, 1105, 1185, "Example of vasopressors -> Dopamine and dobutamine"],
    [2, 125, 265, "Antiallergic effects of glucocorticoids is important in various syndromes."],
    [2, 300, 375, "Antibody E -> allergic components.", ID(P2_Q2E_RUBRIC, 2)],
    [2, 390, 440, "To induce the allergic reactions"],
    [2, 455, 625, "As in myasthenia gravis's ACh (Acetylcholine) cannot be consumed by Acetylcholine receptors because of deficiency of Receptor"],
    [2, 675, 765, "produces immune response regarding no contraction and fatigue"],
    [2, 790, 880, "Various types of allergies and weakness takes place"],
    [2, 945, 1045, "Glucocorticoids are given in treatment to reduce the effect of allergies.", ID(P2_Q2E_RUBRIC, 3)],
    [2, 1105, 1215, "There are Major glucocorticoid present"],
  ],
  points: {
    [ID(P2_Q2E_RUBRIC, 0)]: { m: 0, conf: "high", why: "Never mentions lipocortin or phospholipase A2. The effect is explained through histamine and vasopressors instead." },
    [ID(P2_Q2E_RUBRIC, 1)]: { m: 0.25, conf: "medium", why: "Says glucocorticoids prevent inflammation but gives no mechanism: no cytokines, lysosome stabilising, capillary permeability or cell migration." },
    [ID(P2_Q2E_RUBRIC, 2)]: { m: 0.5, conf: "low", why: "Links IgE to allergic reactions but does not say glucocorticoids lower T-cells, eosinophils or mast-cell histamine release. The myasthenia gravis example is not an allergy." },
    [ID(P2_Q2E_RUBRIC, 3)]: { m: 0.25, conf: "high", why: "Names only allergies as a use. Asthma, anaphylaxis, autoimmune disease and transplant rejection are missing." },
  },
};
const Q3A: Q = {
  rubric: P2_Q3A_RUBRIC, marks: 3, terms: ["basal metabolic rate"],
  lines: [
    [3, 200, 280, "Patients with hypothyroidism are intolerant to cold"],
    [3, 340, 390, "Here T3, T4 down -> TSH up", ID(P2_Q3A_RUBRIC, 0)],
    [3, 415, 485, "Patients Basal metabolic Rate is very low.", ID(P2_Q3A_RUBRIC, 1)],
    [3, 530, 565, "No heat production"],
    [3, 595, 650, "Fatigue, Weight gain occurs"],
    [3, 715, 845, "Patient with hypothyroidism do not have heat generation capacity therefore they are intolerant to cold.", ID(P2_Q3A_RUBRIC, 3)],
    [3, 895, 1030, "Basal Metabolic rate is responsible for heat generation and temperature in Body."],
    [3, 1040, 1190, "As in hyperthyroidism BMR is high, that why person is intolerant to heat"],
  ],
  points: {
    [ID(P2_Q3A_RUBRIC, 0)]: { m: 0.5, conf: "high" },
    [ID(P2_Q3A_RUBRIC, 1)]: { m: 0.75, conf: "medium", why: "States that BMR and heat production are low but does not name the calorigenic effect or explain why thyroid hormones raise oxygen use." },
    [ID(P2_Q3A_RUBRIC, 2)]: { m: 0, conf: "high", why: "Shivering and non-shivering thermogenesis are not mentioned." },
    [ID(P2_Q3A_RUBRIC, 3)]: { m: 0.5, conf: "high" },
  },
};
const Q3B: Q = {
  rubric: P2_Q3B_RUBRIC, marks: 3, terms: ["seminiferous tubules", "oligozoospermia"], note: "The student wrote “oligospermia”. It was counted as oligozoospermia.",
  lines: [
    [4, 165, 245, "Sterility is common in men working in hot environments"],
    [4, 280, 345, "As the sperms making procedure (spermatogenesis)"],
    [4, 390, 425, "Occurs inside seminiferous tubules"],
    [4, 455, 550, "Located in Scrotum Needs 3-5 C lower Body temperature than the environment.", ID(P2_Q3B_RUBRIC, 0)],
    [4, 600, 690, "Therefore if the environment a man is getting exposed to daily is heated."],
    [4, 760, 885, "The formation of sperms will be hampered and symptoms of oligospermia -> low sperm count", ID(P2_Q3B_RUBRIC, 1)],
    [4, 905, 975, "Azoospermia -> Absence of sperm will appear", ID(P2_Q3B_RUBRIC, 3)],
    [4, 975, 1030, "Leads to sterility"],
    [4, 1030, 1150, "Therefore -> cold environment is favourable in spermatogenesis."],
  ],
  points: {
    [ID(P2_Q3B_RUBRIC, 0)]: { m: 1, conf: "medium" },
    [ID(P2_Q3B_RUBRIC, 1)]: { m: 0.5, conf: "high" },
    [ID(P2_Q3B_RUBRIC, 2)]: { m: 0, conf: "high", why: "Does not mention the cremaster, dartos or pampiniform plexus cooling mechanisms." },
    [ID(P2_Q3B_RUBRIC, 3)]: { m: 0.5, conf: "high" },
  },
};
const Q3C: Q = {
  rubric: P2_Q3C_RUBRIC, marks: 3, terms: ["cones"],
  lines: [
    [5, 120, 200, "Maximum visual acuity is at fovea centralis"],
    [5, 275, 400, "The area have large amount of cones", ID(P2_Q3C_RUBRIC, 3)],
    [5, 415, 510, "Cones are responsible for clear vision and more visual acuity."],
    [5, 560, 615, "Rods are Not present", ID(P2_Q3C_RUBRIC, 0)],
    [5, 675, 760, "Rods increased the sensitivity but decreases the visual acuity."],
    [5, 835, 890, "1:1:1 pathway"],
    [5, 950, 1075, "Each cone synapse with one Bipolar cell than one Bipolar cell synapse with one ganglion", ID(P2_Q3C_RUBRIC, 1)],
    [5, 1100, 1185, "Increases the visual acuity."],
    [6, 135, 225, "Avascular Zone"],
    [6, 280, 340, "Fovea centralis is devoid of blood vessels therefore", ID(P2_Q3C_RUBRIC, 2)],
    [6, 385, 435, "Light can penetrate without any hinderance"],
    [6, 480, 590, "Causing more visual acuity."],
  ],
  points: {
    [ID(P2_Q3C_RUBRIC, 0)]: { m: 1, conf: "high" },
    [ID(P2_Q3C_RUBRIC, 1)]: { m: 0.75, conf: "high" },
    [ID(P2_Q3C_RUBRIC, 2)]: { m: 0.5, conf: "high" },
    [ID(P2_Q3C_RUBRIC, 3)]: { m: 0.25, conf: "medium" },
  },
};

function build(q: Q): Findings {
  const pointMarks: Record<string, number> = {}; const evidence: Findings["evidence"] = {};
  for (const p of q.rubric.points) {
    const x = q.points[p.id]; pointMarks[p.id] = x.m;
    const line = q.lines.find((l) => l[4] === p.id);
    evidence[p.id] = { quote: x.m > 0 && line ? line[3] : "", confidence: x.conf, ...(x.why ? { reason: x.why } : {}) };
  }
  const f: Findings = {
    pointMarks, evidence, diagram: { present: false, elementsFound: [] }, termsFound: q.terms, criticalError: false, secondPassTotal: 0, diagramNote: q.note,
    transcript: q.lines.map(([page, a, b, text, pid]) => ({ text, pointId: pid, page, y0: Math.round((a / H) * 1000) / 1000, y1: Math.round((b / H) * 1000) / 1000 })),
  };
  f.secondPassTotal = computeScore(q.rubric, f, q.marks).total;
  return f;
}
export const sampleFindings = (): Record<string, Findings> => ({ q2e: build(Q2E), q3a: build(Q3A), q3b: build(Q3B), q3c: build(Q3C) });
