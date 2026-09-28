window.TagLabPricing = (() => {
  const { PRICE_TIERS } = window.TagLabConfig;

  function priceForLength(lengthMm) {
    if (!Number.isFinite(lengthMm) || lengthMm <= 0) {
      return { ok: false, priceEur: null, tier: null, message: "Nav garuma" };
    }
    for (const tier of PRICE_TIERS) {
      if (lengthMm <= tier.maxMm) {
        return { ok: true, priceEur: tier.priceEur, tier, message: null };
      }
    }
    const max = PRICE_TIERS[PRICE_TIERS.length - 1].maxMm;
    return {
      ok: false,
      priceEur: null,
      tier: null,
      message: `Pārāk garš (${lengthMm.toFixed(0)} mm). Maks. ${max} mm.`,
    };
  }

  function formatPrice(priceEur) {
    if (priceEur == null) return "—";
    return priceEur.toFixed(2).replace(/\.00$/, "") + " €";
  }

  return { priceForLength, formatPrice };
})();
