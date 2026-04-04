/**
 * WooCommerce Integration
 * Simples integração para redirecionar para checkout com dados da escada
 */

const WOOCOMMERCE_STORE_URL = 'https://cdsind.com.br';

interface StairCalculation {
  type: string;
  height: number;
  width: number;
  depth: number;
  stepHeight: number;
  stepDepth: number;
  material: string;
  handrailType: string;
  price: number;
}

/**
 * Calcula o preço baseado nos parâmetros da escada
 */
export function calculatePrice(calculation: Omit<StairCalculation, 'price'>): number {
  // Tabela de preços base (em centavos)
  const basePrices: Record<string, number> = {
    'reta': 300000,      // R$ 3.000
    'l': 400000,         // R$ 4.000
    'u': 500000,         // R$ 5.000
    'caracol': 600000,   // R$ 6.000
    'patamar': 450000,   // R$ 4.500
  };

  const materialMultipliers: Record<string, number> = {
    'aço carbono': 1.0,
    'aço inoxidável': 1.5,
    'alumínio': 1.2,
    'madeira': 0.8,
  };

  const handrailMultipliers: Record<string, number> = {
    'tubo': 1.0,
    'corrimão de vidro': 1.8,
    'corrimão de madeira': 1.3,
    'sem corrimão': 0.7,
  };

  // Preço base
  let price = basePrices[calculation.type.toLowerCase()] || 300000;

  // Ajuste por altura (a cada 500mm adiciona 10%)
  const heightMultiplier = 1 + (calculation.height / 5000) * 0.1;
  price *= heightMultiplier;

  // Ajuste por material
  const materialKey = calculation.material.toLowerCase();
  price *= materialMultipliers[materialKey] || 1.0;

  // Ajuste por corrimão
  const handrailKey = calculation.handrailType.toLowerCase();
  price *= handrailMultipliers[handrailKey] || 1.0;

  // Arredonda para centavos
  return Math.round(price);
}

/**
 * Gera URL de checkout do WooCommerce com dados da escada
 */
export function generateCheckoutUrl(calculation: StairCalculation): string {
  const params = new URLSearchParams({
    'product_name': `Escada ${calculation.type.toUpperCase()} - ${calculation.height}mm`,
    'price': (calculation.price / 100).toFixed(2),
    'description': `Tipo: ${calculation.type} | Altura: ${calculation.height}mm | Material: ${calculation.material}`,
  });

  return `${WOOCOMMERCE_STORE_URL}/checkout/?${params.toString()}`;
}

/**
 * Redireciona para checkout do WooCommerce
 */
export function redirectToCheckout(calculation: StairCalculation): void {
  const checkoutUrl = generateCheckoutUrl(calculation);
  window.location.href = checkoutUrl;
}

/**
 * Cria um produto temporário no WooCommerce (se houver integração com API)
 */
export async function createWooCommerceProduct(calculation: StairCalculation): Promise<string | null> {
  try {
    // Aqui você colocaria a integração com a API REST do WooCommerce
    // Por enquanto, apenas retorna a URL de checkout
    return generateCheckoutUrl(calculation);
  } catch (error) {
    console.error('Erro ao criar produto no WooCommerce:', error);
    return null;
  }
}
