/**
 * REGRA FINAL — Degraus por volta (steps per turn) baseado no diâmetro real.
 * 
 * Regra de ouro: nunca gerar piso real < 200mm na linha de caminhada (~0.65R).
 * 
 * Tabela de referência:
 * ┌────────────┬────────────┬────────────────┐
 * │ Diâmetro   │ Deg/quad   │ Steps/turn     │
 * ├────────────┼────────────┼────────────────┤
 * │ ≤ 1500     │ 3          │ 12             │
 * │ 1600–1900  │ 4          │ 16             │
 * │ 2000–2300  │ 5          │ 20             │
 * │ 2400+      │ 6          │ 24             │
 * └────────────┴────────────┴────────────────┘
 * 
 * Notas importantes:
 * - 1500mm com 3 deg/q = piso real ~255mm ✔ confortável
 * - 1900mm com 4 deg/q = piso real ~242mm ✔ confortável (5 deg/q seria ~194mm ❌)
 * - 2300mm com 5 deg/q = piso real ~235mm ✔ confortável (6 deg/q seria ~196mm ❌)
 */
export function getStepsPerTurn(D: number): number {
  const diameter = Math.max(1100, D);

  if (diameter <= 1500) return 12;  // 3 degraus por quadrante
  if (diameter <= 1900) return 16;  // 4 degraus por quadrante
  if (diameter <= 2300) return 20;  // 5 degraus por quadrante
  return 24;                        // 6 degraus por quadrante
}
