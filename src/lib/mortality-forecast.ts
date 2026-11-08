export type MortalityResearchModel = {
  model_type: string;
  target: string;
  source: string;
  source_url: string;
  version: string;
  features: string[];
  imputer_medians: number[];
  decision_threshold: number;
  trees: [number, number, number, number, number][][];
};

export type MortalityInputs = {
  do_mg_l: number;
  ph: number;
  temperature_c: number;
  previous_dead: number;
};

// The forest's leaf scores are averaged just as in scikit-learn predict_proba.
// This is a research classifier for the next recorded visit, not a death rate.
export function estimateNextVisitMortality(model: MortalityResearchModel, input: MortalityInputs): "elevated" | "no_signal" | null {
  if (model.model_type !== "Random Forest classifier" ||
      model.features.join(",") !== "do_mg_l,ph,temperature_c,previous_dead" ||
      model.trees.length === 0) return null;

  const values = [input.do_mg_l, input.ph, input.temperature_c, input.previous_dead];
  if (values.some(value => !Number.isFinite(value)) || input.previous_dead < 0) return null;

  let total = 0;
  for (const tree of model.trees) {
    let index = 0;
    for (let steps = 0; steps < tree.length; steps++) {
      const node = tree[index];
      if (!node) return null;
      const [feature, threshold, left, right, positive] = node;
      if (feature < 0) {
        if (!Number.isFinite(positive)) return null;
        total += positive;
        break;
      }
      if (feature >= values.length) return null;
      index = values[feature] <= threshold ? left : right;
      if (steps === tree.length - 1) return null;
    }
  }
  return total / model.trees.length >= model.decision_threshold ? "elevated" : "no_signal";
}
