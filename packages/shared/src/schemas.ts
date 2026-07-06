// Zod schemas for main DTOs. Reused by api (validation) and mobile/web (forms).
import { z } from 'zod';

// ---- Auth ----
export const registerSchema = z.object({
  companyName: z.string().min(2),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
  phone: z.string().optional(),
});
export type RegisterDto = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginDto = z.infer<typeof loginSchema>;

export const customerLoginSchema = z.object({
  phone: z.string().min(8),
  code: z.string().optional(),
});
export type CustomerLoginDto = z.infer<typeof customerLoginSchema>;

// ---- Customer ----
export const customerCreateSchema = z.object({
  name: z.string().min(2),
  nickname: z.string().optional(),
  phone: z.string().optional(),
  secondaryPhone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  cpf: z.string().optional(),
  cnpj: z.string().optional(),
  birthday: z.string().datetime().optional(),
});
export type CustomerCreateDto = z.infer<typeof customerCreateSchema>;
export const customerUpdateSchema = customerCreateSchema.partial();
export type CustomerUpdateDto = z.infer<typeof customerUpdateSchema>;

// ---- Professional ----
export const professionalCreateSchema = z.object({
  name: z.string().min(2),
  nickname: z.string().optional(),
  phone: z.string().optional(),
  profession: z.string().optional(),
  onlineBookable: z.boolean().optional(),
});
export type ProfessionalCreateDto = z.infer<typeof professionalCreateSchema>;
export const professionalUpdateSchema = professionalCreateSchema.partial();
export type ProfessionalUpdateDto = z.infer<typeof professionalUpdateSchema>;

export const professionalScheduleSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
});
export type ProfessionalScheduleDto = z.infer<typeof professionalScheduleSchema>;

// ---- Service ----
export const serviceCreateSchema = z.object({
  name: z.string().min(2),
  categoryId: z.string().optional(),
  price: z.number().nonnegative(),
  durationMin: z.number().int().positive(),
  description: z.string().optional(),
  onlineBookable: z.boolean().optional(),
});
export type ServiceCreateDto = z.infer<typeof serviceCreateSchema>;
export const serviceUpdateSchema = serviceCreateSchema.partial();
export type ServiceUpdateDto = z.infer<typeof serviceUpdateSchema>;

// ---- Appointment ----
export const appointmentItemSchema = z.object({
  serviceId: z.string(),
  professionalId: z.string().optional(),
  durationMin: z.number().int().positive().optional(),
  price: z.number().nonnegative().optional(),
});

export const appointmentCreateSchema = z.object({
  customerId: z.string().optional(),
  professionalId: z.string().optional(),
  start: z.string().datetime(),
  end: z.string().datetime().optional(),
  notes: z.string().optional(),
  items: z.array(appointmentItemSchema).optional(),
});
export type AppointmentCreateDto = z.infer<typeof appointmentCreateSchema>;
export const appointmentUpdateSchema = appointmentCreateSchema.partial();
export type AppointmentUpdateDto = z.infer<typeof appointmentUpdateSchema>;

export const appointmentStatusSchema = z.object({
  status: z.enum([
    'scheduled',
    'confirmed',
    'unconfirmed',
    'waiting',
    'in_progress',
    'done',
    'finished',
    'canceled',
  ]),
});
export type AppointmentStatusDto = z.infer<typeof appointmentStatusSchema>;

// ---- Order ----
export const orderCreateSchema = z.object({
  customerId: z.string().optional(),
  professionalId: z.string().optional(),
  notes: z.string().optional(),
});
export type OrderCreateDto = z.infer<typeof orderCreateSchema>;

export const orderItemSchema = z.object({
  kind: z.enum(['service', 'product']),
  refId: z.string(),
  professionalId: z.string().optional(),
  quantity: z.number().positive().default(1),
  unitPrice: z.number().nonnegative(),
  discount: z.number().nonnegative().optional(),
});
export type OrderItemDto = z.infer<typeof orderItemSchema>;

export const orderDiscountSchema = z.object({
  type: z.enum(['percent', 'value']),
  value: z.number().nonnegative(),
  reason: z.string().optional(),
});
export type OrderDiscountDto = z.infer<typeof orderDiscountSchema>;

export const orderPaymentSchema = z.object({
  paymentMethodId: z.string().optional(),
  accountId: z.string().optional(),
  amount: z.number().positive(),
  dueDate: z.string().datetime().optional(),
  description: z.string().optional(),
});
export type OrderPaymentDto = z.infer<typeof orderPaymentSchema>;

// ---- Cash register ----
export const cashOpenSchema = z.object({
  openingBalance: z.number().nonnegative().default(0),
  responsibleUserId: z.string().optional(),
});
export type CashOpenDto = z.infer<typeof cashOpenSchema>;

export const cashCloseSchema = z.object({
  countedBalance: z.number().nonnegative(),
});
export type CashCloseDto = z.infer<typeof cashCloseSchema>;

// ---- Public booking ----
export const publicAppointmentSchema = z.object({
  serviceId: z.string(),
  professionalId: z.string().optional(),
  start: z.string().datetime(),
  customer: z.object({
    name: z.string().min(2),
    phone: z.string().min(8),
    email: z.string().email().optional(),
  }),
});
export type PublicAppointmentDto = z.infer<typeof publicAppointmentSchema>;
