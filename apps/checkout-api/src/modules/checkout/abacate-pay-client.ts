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

    const json = await response.json() as { data?: { id: string; _id?: string } | null; error?: string | null };

    if (!response.ok || json.error || !json.data) {
      return { ok: false, error: json.error ?? `HTTP ${response.status}` };
    }

    return { ok: true, customerId: json.data.id ?? json.data._id ?? "" };
  }

  async function createBilling(input: CreateBillingInput): Promise<CreateBillingResult> {
    const response = await fetch(`${env.ABACATE_PAY_API_URL}/v1/billing/create`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        frequency: "ONE_TIME",
        methods: ["PIX"],
        products: input.products,
        returnUrl: input.returnUrl,
        completionUrl: input.completionUrl,
        customerId: input.customerId
      })
    });

    const json = await response.json() as { data?: { id: string; url: string; amount: number } | null; error?: string | null };

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
