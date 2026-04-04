/**
 * WooCommerce API Integration
 * Integração completa com WooCommerce REST API para criar produtos e pedidos
 */

const WOOCOMMERCE_STORE_URL = 'https://cdsind.com.br';
const WOOCOMMERCE_API_URL = `${WOOCOMMERCE_STORE_URL}/wp-json/wc/v3`;

// Credenciais da API (você pode configurar via variáveis de ambiente)
const CONSUMER_KEY = process.env.REACT_APP_WC_CONSUMER_KEY || '';
const CONSUMER_SECRET = process.env.REACT_APP_WC_CONSUMER_SECRET || '';

interface CustomerData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

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
  steps: number;
}

/**
 * Cria um header de autenticação básica para WooCommerce API
 */
function getAuthHeader(): string {
  const credentials = `${CONSUMER_KEY}:${CONSUMER_SECRET}`;
  const encoded = btoa(credentials);
  return `Basic ${encoded}`;
}

/**
 * Cria um produto no WooCommerce
 */
export async function createWooCommerceProduct(calculation: StairCalculation): Promise<number | null> {
  try {
    const productData = {
      name: `Escada ${calculation.type.charAt(0).toUpperCase() + calculation.type.slice(1)} - ${calculation.height}mm x ${calculation.width}mm`,
      description: `
        <strong>Especificações Técnicas:</strong><br>
        Tipo: ${calculation.type}<br>
        Altura Total: ${calculation.height}mm<br>
        Largura Útil: ${calculation.width}mm<br>
        Profundidade da Pisada: ${calculation.depth}mm<br>
        Altura do Espelho: ${calculation.stepHeight}mm<br>
        Quantidade de Degraus: ${calculation.steps}<br>
        Material: ${calculation.material}<br>
        Corrimão: ${calculation.handrailType}
      `,
      type: 'simple',
      regular_price: (calculation.price / 100).toFixed(2),
      status: 'publish',
      sku: `ESCADA-${calculation.type.toUpperCase()}-${Date.now()}`,
      categories: [{ id: 1 }], // Ajuste o ID da categoria conforme necessário
    };

    const response = await fetch(`${WOOCOMMERCE_API_URL}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAuthHeader(),
      },
      body: JSON.stringify(productData),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Erro ao criar produto:', error);
      return null;
    }

    const product = await response.json();
    return product.id;
  } catch (error) {
    console.error('Erro na requisição:', error);
    return null;
  }
}

/**
 * Cria um pedido no WooCommerce
 */
export async function createWooCommerceOrder(
  productId: number,
  quantity: number,
  customerData: CustomerData,
  calculation: StairCalculation
): Promise<number | null> {
  try {
    // Primeiro, cria ou obtém o cliente
    const customerId = await createOrGetCustomer(customerData);

    const orderData = {
      customer_id: customerId,
      payment_method: 'pix',
      payment_method_title: 'PIX',
      set_paid: false,
      line_items: [
        {
          product_id: productId,
          quantity: quantity,
          price: (calculation.price / 100).toFixed(2),
        },
      ],
      billing: {
        first_name: customerData.firstName,
        last_name: customerData.lastName,
        address_1: customerData.address,
        city: customerData.city,
        state: customerData.state,
        postcode: customerData.postalCode,
        country: customerData.country,
        email: customerData.email,
        phone: customerData.phone,
      },
      shipping: {
        first_name: customerData.firstName,
        last_name: customerData.lastName,
        address_1: customerData.address,
        city: customerData.city,
        state: customerData.state,
        postcode: customerData.postalCode,
        country: customerData.country,
      },
    };

    const response = await fetch(`${WOOCOMMERCE_API_URL}/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAuthHeader(),
      },
      body: JSON.stringify(orderData),
    });

    if (!response.ok) {
      const error = await response.json();
      console.error('Erro ao criar pedido:', error);
      return null;
    }

    const order = await response.json();
    return order.id;
  } catch (error) {
    console.error('Erro na requisição:', error);
    return null;
  }
}

/**
 * Cria ou obtém um cliente no WooCommerce
 */
export async function createOrGetCustomer(customerData: CustomerData): Promise<number> {
  try {
    // Primeiro, tenta buscar o cliente pelo email
    const searchResponse = await fetch(
      `${WOOCOMMERCE_API_URL}/customers?search=${encodeURIComponent(customerData.email)}`,
      {
        headers: {
          'Authorization': getAuthHeader(),
        },
      }
    );

    if (searchResponse.ok) {
      const customers = await searchResponse.json();
      if (customers.length > 0) {
        return customers[0].id;
      }
    }

    // Se não encontrou, cria um novo cliente
    const newCustomerData = {
      email: customerData.email,
      first_name: customerData.firstName,
      last_name: customerData.lastName,
      billing: {
        first_name: customerData.firstName,
        last_name: customerData.lastName,
        address_1: customerData.address,
        city: customerData.city,
        state: customerData.state,
        postcode: customerData.postalCode,
        country: customerData.country,
        phone: customerData.phone,
      },
    };

    const createResponse = await fetch(`${WOOCOMMERCE_API_URL}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': getAuthHeader(),
      },
      body: JSON.stringify(newCustomerData),
    });

    if (!createResponse.ok) {
      const error = await createResponse.json();
      console.error('Erro ao criar cliente:', error);
      throw new Error('Erro ao criar cliente');
    }

    const customer = await createResponse.json();
    return customer.id;
  } catch (error) {
    console.error('Erro na requisição:', error);
    throw error;
  }
}

/**
 * Obtém os detalhes do pedido (incluindo código PIX)
 */
export async function getOrderDetails(orderId: number): Promise<any> {
  try {
    const response = await fetch(`${WOOCOMMERCE_API_URL}/orders/${orderId}`, {
      headers: {
        'Authorization': getAuthHeader(),
      },
    });

    if (!response.ok) {
      throw new Error('Erro ao obter detalhes do pedido');
    }

    return await response.json();
  } catch (error) {
    console.error('Erro na requisição:', error);
    return null;
  }
}

/**
 * Redireciona para a página de pagamento do pedido
 */
export function redirectToOrderPayment(orderId: number): void {
  const paymentUrl = `${WOOCOMMERCE_STORE_URL}/checkout/order-pay/${orderId}/?pay_for_order=true&key=wc_order_${orderId}`;
  window.location.href = paymentUrl;
}
