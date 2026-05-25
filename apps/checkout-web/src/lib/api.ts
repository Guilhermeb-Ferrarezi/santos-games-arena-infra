import axios from "axios";

export type Session = {
  authenticated: boolean;
  user: { id: number; email: string; login: string } | null;
};

export type Product = {
  id: number;
  name: string;
  description: string;
  features: string[];
  amountCents: number;
  discountPercent: number | null;
  imageKey: string | null;
  imageUrl: string | null;
};

export type Order = {
  id: number;
  productId: string;
  description: string;
  amountCents: number;
  status: "pending" | "paid" | "expired" | "failed" | "cancelled";
  pixCode: string | null;
  pixCodeBase64: string | null;
  pixExpiresAt: string | null;
  createdAt: string;
};

export type CreateOrderResult = {
  orderId: number;
  amountCents: number;
  status: "pending" | "paid" | "failed";
  pixCode: string | null;
  pixCodeBase64: string | null;
  pixExpiresAt: string | null;
};

export type CreateCardOrderResult = {
  orderId: number;
  amountCents: number;
  status: "pending" | "paid";
  checkoutUrl: string;
};

export type CardAddress = {
  zipCode: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
};

const authApi = axios.create({ baseURL: "/api/auth", withCredentials: true });
const checkoutApi = axios.create({ baseURL: "/api/checkout", withCredentials: true });

export async function getSession(): Promise<Session> {
  const { data } = await authApi.get<Session>("/session");
  return data;
}

export async function listProducts(): Promise<Product[]> {
  const { data } = await checkoutApi.get<{ products: Product[] }>("/products");
  return data.products;
}

export async function createOrder(
  productId: number,
  customer?: { name: string; email: string; taxId: string; cellphone: string },
  saveInfo?: boolean,
  couponCode?: string
): Promise<CreateOrderResult> {
  const { data } = await checkoutApi.post<CreateOrderResult>("/order", { productId, customer, saveInfo, couponCode: couponCode || undefined });
  return data;
}

export async function createCardOrder(
  productId: number,
  customer: { name: string; email: string; taxId: string; cellphone: string },
  saveInfo?: boolean,
  couponCode?: string
): Promise<CreateCardOrderResult> {
  const { data } = await checkoutApi.post<CreateCardOrderResult>("/order", {
    productId,
    method: "card",
    customer,
    saveInfo,
    couponCode: couponCode || undefined
  });
  return data;
}

export async function validateCoupon(code: string): Promise<{ valid: boolean; discountPercent: number; code: string }> {
  const { data } = await checkoutApi.get<{ valid: boolean; discountPercent: number; code: string }>(`/coupon/validate?code=${encodeURIComponent(code)}`);
  return data;
}

export async function getOrder(orderId: number): Promise<Order> {
  const { data } = await checkoutApi.get<Order>(`/order/${orderId}`);
  return data;
}

export async function cancelOrder(orderId: number): Promise<void> {
  await checkoutApi.delete(`/order/${orderId}`);
}

export type CustomerInfo = {
  name: string | null;
  taxId: string | null;
  cellphone: string | null;
};

export async function getCustomerInfo(): Promise<CustomerInfo | null> {
  const { data } = await checkoutApi.get<{ customer: CustomerInfo | null }>("/customer/me");
  return data.customer;
}

export async function createPayIntent(productId: number): Promise<{ token: string }> {
  const { data } = await checkoutApi.post<{ token: string }>("/pay/intent", { productId });
  return data;
}

export async function getPayIntent(token: string): Promise<Product> {
  const { data } = await checkoutApi.get<{ product: Product }>(`/pay/intent/${token}`);
  return data.product;
}
