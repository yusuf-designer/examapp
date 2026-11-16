import type { Rubric } from "./types";

/**
 * Draft scheme for Physiology Paper II, written from a real sample answer book (pages 21 to 27).
 * The question paper itself was not available, so the wording and marks below are proposals for the evaluator to confirm and lock.
 */
const NO_DIAGRAM = { required: false, marks: 0, elements: [] as string[], minElements: 0 };
export const P2_Q2E_RUBRIC: Rubric = {
  points: [
    { id: "p2q2p1", text: "Anti-inflammatory core: induce lipocortin (annexin-1) which inhibits phospholipase A2, so less arachidonic acid and fewer prostaglandins and leukotrienes", marks: 1.5, kind: "deal_breaker" },
    { id: "p2q2p2", text: "Other anti-inflammatory actions: fewer inflammatory cytokines (IL-1, TNF-α) via NF-κB; stabilise lysosomal membranes; less capillary permeability and migration of neutrophils and macrophages", marks: 1, kind: "content" },
    { id: "p2q2p3", text: "Anti-allergic and immunosuppressive: fewer T-lymphocytes and eosinophils, less mast-cell histamine release and IgE-mediated response", marks: 1, kind: "content" },
    { id: "p2q2p4", text: "Uses: allergic reactions, asthma, anaphylaxis, autoimmune disease, transplant rejection", marks: 0.5, kind: "content" },
  ],
  diagram: NO_DIAGRAM,
  terminology: { terms: ["phospholipase A2", "lipocortin", "prostaglandins", "cytokines"], perTerm: 0.25, marks: 1 },
  caps: { dealBreakerMissing: 2.5, criticalError: 1.5 },
};
export const P2_Q3A_RUBRIC: Rubric = {
  points: [
    { id: "p2q3ap1", text: "Hypothyroidism: low T3 and T4 (raised TSH in primary hypothyroidism)", marks: 0.5, kind: "content" },
    { id: "p2q3ap2", text: "Thyroid hormones raise the basal metabolic rate and oxygen use (calorigenic effect, more Na+-K+ ATPase and mitochondrial activity), so their lack lowers heat production", marks: 1, kind: "deal_breaker" },
    { id: "p2q3ap3", text: "Less shivering and non-shivering thermogenesis, so the body cannot raise heat output in the cold", marks: 0.5, kind: "content" },
    { id: "p2q3ap4", text: "Result: heat production is less than heat loss, so cold intolerance, with low body temperature, dry skin and weight gain", marks: 0.5, kind: "content" },
  ],
  diagram: NO_DIAGRAM,
  terminology: { terms: ["basal metabolic rate", "calorigenic effect"], perTerm: 0.25, marks: 0.5 },
  caps: { dealBreakerMissing: 1.5, criticalError: 1 },
};
export const P2_Q3B_RUBRIC: Rubric = {
  points: [
    { id: "p2q3bp1", text: "Spermatogenesis happens in the seminiferous tubules and needs a temperature about 2 to 3 °C below body temperature (some texts say 3 to 5 °C; accept either)", marks: 1, kind: "deal_breaker" },
    { id: "p2q3bp2", text: "Heat raises scrotal temperature, which damages spermatogenesis: loss of germ cells, fewer and less motile sperm, abnormal forms", marks: 0.5, kind: "content" },
    { id: "p2q3bp3", text: "Cooling mechanisms (cremaster and dartos relax, countercurrent heat exchange in the pampiniform plexus) cannot cope with constant heat", marks: 0.5, kind: "content" },
    { id: "p2q3bp4", text: "Outcome: oligozoospermia or azoospermia leading to infertility, which reverses if heat exposure stops", marks: 0.5, kind: "content" },
  ],
  diagram: NO_DIAGRAM,
  terminology: { terms: ["seminiferous tubules", "oligozoospermia"], perTerm: 0.25, marks: 0.5 },
  caps: { dealBreakerMissing: 1.5, criticalError: 1 },
};
export const P2_Q3C_RUBRIC: Rubric = {
  points: [
    { id: "p2q3cp1", text: "The fovea centralis has only cones and no rods", marks: 1, kind: "deal_breaker" },
    { id: "p2q3cp2", text: "One-to-one connection: one cone to one bipolar cell to one ganglion cell (no convergence), so fine resolution", marks: 0.75, kind: "content" },
    { id: "p2q3cp3", text: "Inner retinal layers and blood vessels are pushed aside (avascular), so light reaches the cones directly with little scatter", marks: 0.5, kind: "content" },
    { id: "p2q3cp4", text: "Cones are densest and smallest here, with the smallest receptive fields", marks: 0.25, kind: "content" },
  ],
  diagram: NO_DIAGRAM,
  terminology: { terms: ["cones", "convergence"], perTerm: 0.25, marks: 0.5 },
  caps: { dealBreakerMissing: 1.5, criticalError: 1 },
};

/** Question 4 on the sample book is five one-mark MCQs. The key below is read from the student's own picks and is a placeholder until the real key is entered. */
export const P2_Q4_RUBRIC: Rubric = {
  points: [
    { id: "p2q4p1", text: "4(a) Bipolar neurons are capable of regeneration", marks: 1, kind: "content" },
    { id: "p2q4p2", text: "4(b) Rinne negative (BC > AC); Weber lateralises to the affected ear", marks: 1, kind: "content" },
    { id: "p2q4p3", text: "4(c) Damage to the upper motor neuron pathway", marks: 1, kind: "content" },
    { id: "p2q4p4", text: "4(d) LH surge", marks: 1, kind: "content" },
    { id: "p2q4p5", text: "4(e) Cation channel of sperm (CatSper)", marks: 1, kind: "content" },
  ],
  diagram: NO_DIAGRAM,
  terminology: { terms: [], perTerm: 0.25, marks: 0 },
  caps: { dealBreakerMissing: 4, criticalError: 3 },
};
export const P2_Q4_TEXT = "Question 4 (MCQ). Choose the correct option for each of the five items: (a) to (e). 1 mark each. (5 marks)";

/** What a full-mark answer says, in sentences. The marking points above are how it is scored. */
export const P2_MODEL_ANSWER: Record<string, string> = {
  q2e: "Glucocorticoids (mainly cortisol, from the zona fasciculata) switch on lipocortin (annexin-1), which blocks phospholipase A2. Less arachidonic acid is released, so fewer prostaglandins and leukotrienes are made, and swelling, pain and redness fall. They also reduce IL-1 and TNF-α through NF-κB, stabilise lysosomal membranes, lower capillary permeability and keep neutrophils and macrophages from migrating. Anti-allergic effect: fewer T-lymphocytes and eosinophils, less histamine release from mast cells and a weaker IgE response, which is why they are given in asthma, anaphylaxis, autoimmune disease and transplant rejection. Cortisol also has permissive actions: it makes tissues respond better to adrenaline, noradrenaline and glucagon.",
  q3a: "In hypothyroidism T3 and T4 are low (TSH is raised in primary disease). Thyroid hormones raise the basal metabolic rate and oxygen use (calorigenic effect, more Na+-K+ ATPase and mitochondria), so with less of them the body makes less heat. Shivering and non-shivering thermogenesis are also reduced, so the person cannot raise heat output when it is cold. Heat production is lower than heat loss, so there is cold intolerance, with low body temperature, dry skin and weight gain.",
  q3b: "Spermatogenesis takes place in the seminiferous tubules and needs a temperature about 2 to 3 °C below body temperature, which is why the testes lie in the scrotum. In a hot environment the scrotal temperature rises. Cremaster and dartos relaxation and the countercurrent heat exchange in the pampiniform plexus cannot cope with constant heat, so germ cells are lost and sperm become fewer, less motile and abnormal. This gives oligozoospermia or azoospermia and infertility, which usually reverses once the heat exposure stops.",
  q3c: "The fovea centralis has only cones and no rods. Each cone connects to one bipolar cell and one ganglion cell (1:1:1, no convergence), so the receptive fields are tiny and resolution is fine. The inner retinal layers and blood vessels are pushed aside, so light reaches the cones directly with little scatter, and the cones are densest and smallest here. Rods give sensitivity but low acuity because many converge on one ganglion cell.",
  q4: "(a) Bipolar neurons are capable of regeneration. (b) Rinne negative (BC > AC), Weber lateralises to the affected ear. (c) Damage to the upper motor neuron pathway. (d) LH surge. (e) Cation channel of sperm. This key is a placeholder taken from the sample book, to be replaced with the real key.",
};

/** Atherosclerosis essay (10 marks), the pathology page in the demo book. Wording and marks are proposals to confirm. */
export const P2_ATH_TEXT = "Q2. Describe atherosclerosis: definition, pathogenesis (response to injury), morphology and complications. (10 marks)";
export const P2_ATH_RUBRIC: Rubric = {
  points: [
    { id: "ath1", text: "Definition: progressive disease of large and medium-sized arteries with an atheroma (fibrofatty plaque) in the intima", marks: 1, kind: "content" },
    { id: "ath2", text: "Endothelial injury (response to injury hypothesis) from hyperlipidaemia, hypertension, smoking, diabetes", marks: 1.5, kind: "deal_breaker" },
    { id: "ath3", text: "LDL enters the intima and is oxidised (oxLDL); endothelium expresses adhesion molecules (VCAM-1, ICAM-1) and monocytes migrate in", marks: 1.5, kind: "content" },
    { id: "ath4", text: "Macrophages ingest oxLDL and become foam cells; collections of foam cells form the fatty streak", marks: 1.5, kind: "content" },
    { id: "ath5", text: "Smooth muscle cells migrate from the media and proliferate (PDGF, FGF) and make matrix (collagen), forming the fibrous cap", marks: 1, kind: "content" },
    { id: "ath6", text: "Plaque structure: fibrous cap over a necrotic lipid core (foam cells, cholesterol crystals, debris)", marks: 1, kind: "content" },
    { id: "ath7", text: "Morphology: fatty streak is the earliest lesion; atheromatous plaque is a raised yellow-white lesion, common in abdominal aorta and coronary arteries", marks: 0.5, kind: "content" },
    { id: "ath8", text: "Complications: thrombosis and acute occlusion (MI), chronic ischaemia (angina), aneurysm, haemorrhage into the plaque, embolism", marks: 1, kind: "content" },
  ],
  diagram: { required: false, marks: 0, elements: [], minElements: 0 },
  terminology: { terms: ["atheroma", "oxidised LDL", "foam cells", "endothelial injury"], perTerm: 0.25, marks: 1 },
  caps: { dealBreakerMissing: 5, criticalError: 3 },
};
P2_MODEL_ANSWER.qath = "Atherosclerosis is a progressive disease of large and medium-sized arteries in which an atheroma (fibrofatty plaque) forms in the intima. By the response to injury hypothesis, chronic endothelial injury (hyperlipidaemia, hypertension, smoking, diabetes) lets LDL enter the intima, where it is oxidised and inflammatory. Endothelial adhesion molecules (VCAM-1, ICAM-1) bring in monocytes, and macrophages ingest oxLDL to become foam cells, which collect as fatty streaks. Growth factors (PDGF, FGF) make smooth muscle cells migrate from the media and proliferate and make collagen, giving a fibrous cap over a necrotic core of foam cells, cholesterol crystals and debris. The fatty streak is the earliest lesion; the mature plaque is raised and yellow-white, common in the abdominal aorta and coronary arteries. Complications: thrombosis with acute occlusion (MI), chronic ischaemia (stable angina, claudication), aneurysm, haemorrhage into the plaque and embolism of debris.";
