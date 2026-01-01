const CO2_EMISSIONS = { train: 29, car: 147 };

export function calculateCo2Saved(distanceKm: number): number {
  const carEmissions = (distanceKm * CO2_EMISSIONS.car) / 1000;
  const trainEmissions = (distanceKm * CO2_EMISSIONS.train) / 1000;
  return Math.round((carEmissions - trainEmissions) * 10) / 10;
}

export function formatCo2(kg: number): string {
  return kg >= 1000 ? `${(kg / 1000).toFixed(1)} t` : `${kg.toFixed(1)} kg`;
}

export function getCo2Comparison(kg: number): string {
  const trees = kg / 10;
  if (trees >= 1) return `≈ ${Math.round(trees)} Bäume für ein Jahr`;
  const carKm = kg / 0.147;
  return carKm >= 1 ? `≈ ${Math.round(carKm)} km Autofahrt vermieden` : '';
}
