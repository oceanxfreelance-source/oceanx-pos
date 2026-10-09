/**
 * One business architecture, many customer-facing business types.
 * Business type only influences defaults, terminology and suggestions —
 * never which codebase or data model is used.
 */
export const BUSINESS_TYPES = [
  'restaurant',
  'cafe',
  'coffee_shop',
  'bakery',
  'fast_food',
  'juice_shop',
  'dessert_shop',
  'takeaway',
  'retail_shop',
  'supermarket',
  'other',
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];

export interface BusinessTypeProfile {
  /** Translation key used for the products/menu navigation label. */
  productsLabelKey: string;
  /** Dashboard widgets suggested by default for this type (ordered). */
  dashboardWidgets: string[];
  /** Whether table service is typical (affects onboarding suggestions). */
  tableService: boolean;
  /** Whether a kitchen display is typical. */
  kitchen: boolean;
  /** Suggested starter categories (translation keys). */
  suggestedCategoryKeys: string[];
  /** Shops (not food service): no kitchen, tables, QR menu, reservations…; the POS is barcode-first. */
  retail?: boolean;
}

const RESTAURANT_WIDGETS = ['today_sales', 'orders', 'customers', 'outstanding_due', 'low_stock', 'top_products', 'recent_sales', 'sales_trend'];
const CAFE_WIDGETS = ['today_sales', 'orders', 'average_order_value', 'top_drinks', 'top_products', 'low_stock', 'recent_orders'];

export const BUSINESS_TYPE_PROFILES: Record<BusinessType, BusinessTypeProfile> = {
  restaurant: {
    productsLabelKey: 'nav.products_menu',
    dashboardWidgets: RESTAURANT_WIDGETS,
    tableService: true,
    kitchen: true,
    suggestedCategoryKeys: ['starters', 'mains', 'desserts', 'drinks'],
  },
  cafe: {
    productsLabelKey: 'nav.products_menu',
    dashboardWidgets: CAFE_WIDGETS,
    tableService: true,
    kitchen: true,
    suggestedCategoryKeys: ['hot_drinks', 'cold_drinks', 'pastries', 'snacks'],
  },
  coffee_shop: {
    productsLabelKey: 'nav.menu',
    dashboardWidgets: CAFE_WIDGETS,
    tableService: false,
    kitchen: false,
    suggestedCategoryKeys: ['hot_drinks', 'cold_drinks', 'pastries'],
  },
  bakery: {
    productsLabelKey: 'nav.products_menu',
    dashboardWidgets: ['today_sales', 'orders', 'top_products', 'low_stock', 'recent_sales', 'sales_trend'],
    tableService: false,
    kitchen: false,
    suggestedCategoryKeys: ['breads', 'cakes', 'pastries', 'drinks'],
  },
  fast_food: {
    productsLabelKey: 'nav.menu',
    dashboardWidgets: ['today_sales', 'orders', 'average_order_value', 'top_products', 'recent_orders', 'sales_trend'],
    tableService: false,
    kitchen: true,
    suggestedCategoryKeys: ['burgers', 'sides', 'drinks', 'combos'],
  },
  juice_shop: {
    productsLabelKey: 'nav.menu',
    dashboardWidgets: CAFE_WIDGETS,
    tableService: false,
    kitchen: false,
    suggestedCategoryKeys: ['juices', 'smoothies', 'snacks'],
  },
  dessert_shop: {
    productsLabelKey: 'nav.menu',
    dashboardWidgets: CAFE_WIDGETS,
    tableService: false,
    kitchen: false,
    suggestedCategoryKeys: ['desserts', 'ice_cream', 'drinks'],
  },
  takeaway: {
    productsLabelKey: 'nav.menu',
    dashboardWidgets: ['today_sales', 'orders', 'average_order_value', 'top_products', 'recent_orders'],
    tableService: false,
    kitchen: true,
    suggestedCategoryKeys: ['mains', 'sides', 'drinks'],
  },
  retail_shop: {
    productsLabelKey: 'nav.products',
    dashboardWidgets: ['today_sales', 'orders', 'average_order_value', 'top_products', 'low_stock', 'recent_sales', 'sales_trend'],
    tableService: false,
    kitchen: false,
    suggestedCategoryKeys: [],
    retail: true,
  },
  supermarket: {
    productsLabelKey: 'nav.products',
    dashboardWidgets: ['today_sales', 'orders', 'average_order_value', 'top_products', 'low_stock', 'outstanding_due', 'recent_sales', 'sales_trend'],
    tableService: false,
    kitchen: false,
    suggestedCategoryKeys: [],
    retail: true,
  },
  other: {
    productsLabelKey: 'nav.products_menu',
    dashboardWidgets: RESTAURANT_WIDGETS,
    tableService: false,
    kitchen: false,
    suggestedCategoryKeys: [],
  },
};

export function isBusinessType(v: string): v is BusinessType {
  return (BUSINESS_TYPES as readonly string[]).includes(v);
}

/** Retail = shops (small shops, supermarkets) rather than food service. */
export function isRetailType(t: string | null | undefined): boolean {
  return !!t && isBusinessType(t) && !!BUSINESS_TYPE_PROFILES[t].retail;
}

export const RETAIL_TYPES: BusinessType[] = BUSINESS_TYPES.filter((t) => BUSINESS_TYPE_PROFILES[t].retail);
