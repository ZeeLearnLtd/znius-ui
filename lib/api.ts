import axios from 'axios';

const api = axios.create({
  // In dev & prod, Next.js rewrites /api-proxy/* → external API (no CORS issue)
  baseURL: process.env.NEXT_PUBLIC_API_URL || '/api-proxy',
  timeout: 15000,
  // withCredentials removed — was causing CORS rejection when server returns wildcard '*'
});

export default api;

// ── Auth ─────────────────────────────────────────────────────
export const login  = (d: { username: string; password: string }) => api.post('/auth/login', d);
export const getMe  = (user_id: number) => api.get('/auth/me', { params: { user_id } });
export const logout = (d?: { user_id: number })  => api.post('/auth/logout', d || {});

// ── Lookups ──────────────────────────────────────────────────
export const getCountries = ()            => api.get('/countries');
export const getStates    = (cid: number) => api.get('/states',  { params: { country_id: cid } });
export const getCities    = (sid: number) => api.get('/cities',  { params: { state_id: sid } });
export const getProducts  = ()            => api.get('/products');
export const getClasses   = ()            => api.get('/classes');
export const getSubjects  = ()            => api.get('/subjects');

// ── Franchisee & KYC ────────────────────────────────────────
export const createFranchisee    = (d: any)       => api.post('/franchisee', d);
export const getFranchiseeByCode = (code: string) => api.get(`/franchisee/by-code/${encodeURIComponent(code)}`);
export const saveAddress         = (d: any)       => api.post('/address', d);
export const saveKYC             = (d: any)       => api.post('/kyc/save', d);
export const verifyGST           = (v: string)    => api.post('/kyc/verify-gst',    { gst_no: v });
export const verifyPAN           = (v: string)    => api.post('/kyc/verify-pan',    { pan_no: v });
export const verifyAadhar        = (v: string)    => api.post('/kyc/verify-aadhar', { aadhar_no: v });

// ── Check Existing Franchisee (returning user detection) ────
export const checkExistingFranchisee = (d: {
  school_name: string; pan_no: string; gst_no: string;
}) => api.post('/franchisee/check-existing', d);

// ── Orders ───────────────────────────────────────────────────
export const createOrder = (d: any) => api.post('/order/create', d);

// Create order for returning franchisee (no new franchisee/KYC creation)
export const createOrderReturning = (d: any) => api.post('/order/create-returning', d);
export const getOrders   = (params?: { franchisee_id?: number; franchisee_code?: string; status?: string }) =>
  api.get('/orders', { params });
export const getOrder    = (id: number) => api.get(`/order/${id}`);

// ── BH Actions ───────────────────────────────────────────────
export const bhApprove = (id: number, d: any) => api.post(`/order/${id}/bh-approve`, d);
export const bhReject  = (id: number, d: any) => api.post(`/order/${id}/bh-reject`,  d);

// ── Virtual Account ─────────────────────────────────────────
export const getVirtualAccount = (franchisee_id: number) =>
  api.get(`/virtual-account/${franchisee_id}`);

// ── Finance ─────────────────────────────────────────────────
export const financeConfirm = (id: number, d: any) => api.post(`/order/${id}/finance-confirm`, d);
export const financeReject  = (id: number, d: any) => api.post(`/order/${id}/finance-reject`,  d);

// ── Payment Choice (Customer) ───────────────────────────────
export const savePaymentChoice = (
  id: number,
  d: { payment_type: 'FULL' | 'LOAN'; user_id: number }
) => api.post(`/order/${id}/payment-choice`, d);

export const getPaymentChoice = (id: number) =>
  api.get(`/order/${id}/payment-choice`);

// ── Loan Actions (ACC) ──────────────────────────────────────
export const loanApprove = (id: number, d: { user_id: number; remarks?: string }) =>
  api.post(`/order/${id}/loan-approve`, d);

export const loanReject  = (id: number, d: { user_id: number; remarks?: string }) =>
  api.post(`/order/${id}/loan-reject`, d);