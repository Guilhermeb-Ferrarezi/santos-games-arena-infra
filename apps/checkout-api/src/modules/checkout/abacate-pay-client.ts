import type { CheckoutApiEnv } from "../../config/env";

export type AbacatePayProduct = {
  externalId: string;
  name: string;
  description: string;
  quantity: number;
  price: number;
};

export type CreateCustomerInput = {
  name: string;
  email: string;
  cellphone?: string;
  taxId?: string;
};

export type CreateCustomerResult =
  | { ok: true; customerId: string }
  | { ok: false; error: string };

export type CreateBillingInput = {
  customerId: string;
  products: AbacatePayProduct[];
  returnUrl?: string;
  completionUrl?: string;
};

export type CreateBillingResult =
  | { ok: true; billingId: string; checkoutUrl: string; amountCents: number }
  | { ok: false; error: string };

export type AbacatePayClient = ReturnType<typeof createAbacatePayClient>;

export function createAbacatePayClient(
  env: Pick<CheckoutApiEnv, "ABACATE_PAY_API_KEY" | "ABACATE_PAY_API_URL">
) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${env.ABACATE_PAY_API_KEY}`
  };

  async function createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult> {
    const response = await fetch(`${env.ABACATE_PAY_API_URL}/v2/customers/create`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: input.name,
        email: input.email,
        ...(input.cellphone ? { cellphone: input.cellphone } : {}),
        ...(input.taxId ? { taxId: input.taxId } : {})
      })
    });

    const json = await response.json() as { data?: { id: string } | null; error?: string | null };

    console.log("[abacate-pay] customer response", response.status, JSON.stringify(json));

    if (!response.ok || json.error || !json.data) {
      return { ok: false, error: json.error ?? `HTTP ${response.status}` };
    }

    return { ok: true, customerId: json.data.id };
  }

  async function ensureProduct(externalId: string, name: string, price: number): Promise<string> {
    const createResponse = await fetch(`${env.ABACATE_PAY_API_URL}/v2/products/create`, {
      method: "POST",
      headers,
      body: JSON.stringify({ externalId, name, price, currency: "BRL" })
    });

    const createJson = await createResponse.json() as { data?: { id: string } | null; error?: string | null };

    if (createResponse.ok && createJson.data) {
      return createJson.data.id;
    }

    if (createJson.error === "Product with externalId already exists") {
      const getResponse = await fetch(
        `${env.ABACATE_PAY_API_URL}/v2/products/get?externalId=${encodeURIComponent(externalId)}`,
        { headers }
      );
      const getJson = await getResponse.json() as { data?: { id: string } | null; error?: string | null };

      if (getResponse.ok && getJson.data) {
        return getJson.data.id;
      }

      throw new Error(getJson.error ?? `HTTP ${getResponse.status}`);
    }

    throw new Error(createJson.error ?? `HTTP ${createResponse.status}`);
  }

  async function createBilling(input: CreateBillingInput): Promise<CreateBillingResult> {
    const items: { id: string; quantity: number }[] = [];

    for (const product of input.products) {
      try {
        const productId = await ensureProduct(product.externalId, product.name, product.price);
        items.push({ id: productId, quantity: product.quantity });
      } catch (err) {
        return { ok: false, error: `product_error: ${(err as Error).message}` };
      }
    }

    const response = await fetch(`${env.ABACATE_PAY_API_URL}/v2/checkouts/create`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        items,
        ...(input.customerId ? { customerId: input.customerId } : {}),
        ...(input.returnUrl ? { returnUrl: input.returnUrl } : {}),
        ...(input.completionUrl ? { completionUrl: input.completionUrl } : {}),
        methods: ["PIX"]
      })
    });

    const json = await response.json() as { data?: { id: string; url: string; amount: number } | null; error?: string | null };

    console.log("[abacate-pay] checkout response", response.status, JSON.stringify(json));

    if (!response.ok || json.error || !json.data) {
      return { ok: false, error: json.error ?? `HTTP ${response.status}` };
    }

    return {
      ok: true,
      billingId: json.data.id,
      checkoutUrl: json.data.url,
      amountCents: json.data.amount
    };
  }

  return { createCustomer, createBilling };
}
