import { sqliteTable, text, integer, real, primaryKey } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

// Tabela de usuários (clientes)
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  email: text('email').unique().notNull(),
  password: text('password').notNull(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  phone: text('phone'),
  address: text('address'),
  city: text('city'),
  state: text('state'),
  postalCode: text('postal_code'),
  country: text('country').default('BR'),
  wcCustomerId: integer('wc_customer_id'), // ID do cliente no WooCommerce
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Tabela de projetos de escadas
export const projects = sqliteTable('projects', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull(),
  type: text('type').notNull(), // 'straight', 'landing', 'lshape', 'spiral'
  height: integer('height').notNull(), // altura em mm
  length: integer('length').notNull(), // comprimento em mm
  width: integer('width').notNull(), // largura em mm
  stepHeight: real('step_height').notNull(),
  stepDepth: real('step_depth').notNull(),
  steps: integer('steps').notNull(),
  material: text('material').default('aço carbono'),
  handrailType: text('handrail_type').default('tubo'),
  estimatedPrice: real('estimated_price').notNull(),
  title: text('title'),
  description: text('description'),
  status: text('status').default('draft'), // 'draft', 'saved', 'checkout', 'ordered'
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Tabela de pedidos
export const orders = sqliteTable('orders', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  projectId: integer('project_id').notNull(),
  userId: integer('user_id').notNull(),
  wcOrderId: integer('wc_order_id'), // ID do pedido no WooCommerce
  wcProductId: integer('wc_product_id'), // ID do produto no WooCommerce
  status: text('status').default('pending'), // 'pending', 'processing', 'completed', 'failed'
  paymentStatus: text('payment_status').default('unpaid'), // 'unpaid', 'paid'
  paymentMethod: text('payment_method').default('pix'),
  pixCode: text('pix_code'), // Código PIX para pagamento
  pixQrCode: text('pix_qr_code'), // QR Code PIX
  totalPrice: real('total_price').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Relações
export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  orders: many(orders),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  orders: many(orders),
}));

export const ordersRelations = relations(orders, ({ one }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  project: one(projects, {
    fields: [orders.projectId],
    references: [projects.id],
  }),
}));
