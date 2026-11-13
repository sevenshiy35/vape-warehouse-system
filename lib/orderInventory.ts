export type ReviewBin = {
  id: string;
  product_id: string;
  location: string;
  position: number | null;
  quantity: number;
  reserved: number;
};

export type InventoryDemand = {
  productId: string | null | undefined;
  quantity: number | null;
};

export type InventoryForecast = {
  status: "sufficient" | "insufficient" | "unmatched" | "needs_review";
  quantity: number | null;
  available: number;
  onHand: number;
  reserved: number;
  before: number;
  after: number | null;
  shortage: number;
  allocations: { location: string; position: number; quantity: number }[];
};

export function recognitionPickQuantity(
  quantity: number,
  unit: string,
  product?: { default_pick_multiplier: number; carton_pick_multiplier: number },
): number | null {
  if (!product || !Number.isSafeInteger(quantity) || quantity <= 0) return null;
  const multiplier =
    unit === "盒"
      ? product.default_pick_multiplier
      : unit === "条"
        ? product.carton_pick_multiplier
        : unit === "支" || unit === "个"
          ? 1
          : null;
  if (
    multiplier === null ||
    !Number.isSafeInteger(multiplier) ||
    multiplier < 1
  )
    return null;
  return quantity * multiplier;
}

// Simulate this order only. Read stock minus batch reservations, then consume
// locations 1 → 2 → 3. Repeated SKUs share one balance, never duplicated stock.
export function forecastOrderInventory(
  demands: InventoryDemand[],
  bins: ReviewBin[],
): InventoryForecast[] {
  const grouped = new Map<string, (ReviewBin & { remaining: number })[]>();
  for (const bin of bins) {
    if (bin.position === null || bin.position < 1 || bin.position > 3) continue;
    const group = grouped.get(bin.product_id) || [];
    group.push({ ...bin, remaining: Math.max(0, bin.quantity - bin.reserved) });
    grouped.set(bin.product_id, group);
  }
  for (const group of grouped.values())
    group.sort((a, b) => a.position! - b.position! || a.id.localeCompare(b.id));
  const used = new Map<string, number>();
  return demands.map(({ productId, quantity }) => {
    const group = (productId && grouped.get(productId)) || [];
    const onHand = group.reduce((sum, bin) => sum + bin.quantity, 0);
    const reserved = group.reduce((sum, bin) => sum + bin.reserved, 0);
    const available = onHand - reserved;
    const before = available - (productId ? used.get(productId) || 0 : 0);
    const base = {
      quantity,
      available,
      onHand,
      reserved,
      before,
      after: null,
      shortage: 0,
      allocations: [],
    };
    if (!productId) return { ...base, status: "unmatched" };
    if (quantity === null || !Number.isSafeInteger(quantity) || quantity <= 0)
      return { ...base, status: "needs_review" };
    used.set(productId, (used.get(productId) || 0) + quantity);
    let remaining = quantity;
    const allocations: InventoryForecast["allocations"] = [];
    for (const bin of group) {
      const take = Math.min(remaining, bin.remaining);
      if (take > 0)
        allocations.push({
          location: bin.location,
          position: bin.position!,
          quantity: take,
        });
      bin.remaining -= take;
      remaining -= take;
      if (!remaining) break;
    }
    const after = before - quantity;
    return {
      ...base,
      after,
      shortage: Math.max(0, -after),
      allocations,
      status: after >= 0 ? "sufficient" : "insufficient",
    };
  });
}
