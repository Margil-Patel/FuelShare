import { apiFetch } from './client';
import { CreateOrderResponse, Payment, PaymentVerifyRequest } from './types';

export async function createPaymentOrderApi(fuelShareId: number): Promise<CreateOrderResponse> {
  return apiFetch<CreateOrderResponse>('/payments/create-order', {
    method: 'POST',
    body: JSON.stringify({ fuel_share_id: fuelShareId }),
  });
}

export async function verifyPaymentApi(payload: PaymentVerifyRequest): Promise<Payment> {
  return apiFetch<Payment>('/payments/verify', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getPaymentApi(paymentId: number): Promise<Payment> {
  return apiFetch<Payment>(`/payments/${paymentId}`);
}

export async function getFuelSharePaymentStatusApi(fuelShareId: number): Promise<Payment | null> {
  try {
    return await apiFetch<Payment>(`/payments/fuel-shares/${fuelShareId}`);
  } catch {
    return null;
  }
}
