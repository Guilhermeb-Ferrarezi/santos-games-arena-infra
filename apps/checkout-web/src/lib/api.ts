import axios from "axios";

export type Session = {
  authenticated: boolean;
  user: { id: number; email: string; login: string } | null;
};

export type Product = {
  id: number;
  name: string;
  description: string;
  amountCents: number;
};

export type Order = {
  id: number;
  productId: string;
  description: string;
  amountCents: number;
  status: "pending" | "paid" | "expired" | "failed";
  checkoutUrl: string | null;
  createdAt: string;
};

export type CreateOrderResult = {
  orderId: number;
  checkoutUrl: string;
  amountCents: number;
  status: string;
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

export async function createOrder(productId: number): Promise<CreateOrderResult> {
  const { data } = await checkoutApi.post<CreateOrderResult>("/order", { productId });
  return data;
}

export async function getOrder(orderId: number): Promise<Order> {
  const { data } = await checkoutApi.get<Order>(`/order/${orderId}`);
  return data;
}
