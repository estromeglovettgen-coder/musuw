const STORAGE_BY_CURRENCY = Object.freeze({
  USD: Object.freeze(["1 GiB storage", "10 GiB storage", "30 GiB storage", "100 GiB storage"]),
  CNY: Object.freeze(["1 GiB 存储空间", "10 GiB 存储空间", "30 GiB 存储空间", "100 GiB 存储空间"]),
});

const ADVANCED_MODEL_LABEL = Object.freeze({
  USD: "Advanced model access",
  CNY: "高级模型使用",
});

const STORAGE_VALUE_LABELS = Object.freeze({
  "1 GiB": "1 GiB",
  "10 GiB": "10 GiB",
  "30 GiB": "30 GiB",
  "100 GiB": "100 GiB",
});

export function applyHomepagePlanPresentation(copy) {
  const currency = copy?.pricing?.currencyCode === "CNY" ? "CNY" : "USD";
  const storageFeatures = STORAGE_BY_CURRENCY[currency];
  const advancedModelLabel = ADVANCED_MODEL_LABEL[currency];

  return {
    ...copy,
    pricing: {
      ...copy.pricing,
      plans: copy.pricing.plans.map((plan, index) => ({
        ...plan,
        features: [storageFeatures[index], ...plan.features.slice(1)],
      })),
    },
    comparison: {
      ...copy.comparison,
      valueLabels: {
        ...copy.comparison.valueLabels,
        ...STORAGE_VALUE_LABELS,
      },
      groups: copy.comparison.groups.map((group, index) =>
        index === 2 && !group.rows.includes(advancedModelLabel)
          ? { ...group, rows: [...group.rows, advancedModelLabel] }
          : group,
      ),
    },
  };
}
