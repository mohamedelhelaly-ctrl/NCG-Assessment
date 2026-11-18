// Types mirror the backend schemas (backend/app/schemas).
export type Role = 'customer' | 'admin'

export interface User {
  id: number
  email: string
  full_name: string
  role: Role
}

export interface TokenResponse {
  access_token: string
  token_type: string
  user: User
}

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

// ---- admin ----
export interface NamedAdmin {
  id: number
  name: string
  name_ar: string | null
  display_name: string
  product_count: number
}

export interface TierAdmin {
  id: number
  label: string
  label_ar: string | null
  units: number
  price_fils: number
}

export interface TierInput {
  label: string
  label_ar: string | null
  units: number
  price_fils: number
}

export interface ImageAdmin {
  id: number
  url: string
  alt: string
  alt_ar: string | null
  position: number
}

export interface ProductListItem {
  id: number
  name: string
  name_ar: string | null
  display_name: string
  brand: string
  category: string
  is_active: boolean
  tier_count: number
  image_count: number
  missing_ar: boolean
  main_image_url: string | null
  created_at: string
}

export interface ProductAdmin {
  id: number
  brand_id: number
  category_id: number
  name: string
  name_ar: string | null
  description: string
  description_ar: string | null
  is_active: boolean
  tiers: TierAdmin[]
  images: ImageAdmin[]
  created_at: string
  updated_at: string
}

export interface ProductPayload {
  brand_id: number
  category_id: number
  name: string
  name_ar: string | null
  description: string
  description_ar: string | null
  is_active: boolean
}

// ---- storefront (already resolved for the request language by the server) ----
export interface NamedCount {
  id: number
  name: string
  product_count: number
}

export interface Tier {
  id: number
  label: string
  units: number
  price_fils: number
}

export interface StoreImage {
  id: number
  url: string
  alt: string
}

export interface StoreProduct {
  id: number
  name: string
  description: string
  brand: { id: number; name: string }
  category: { id: number; name: string }
  main_image: StoreImage | null
  tiers: Tier[]
}

export interface StoreProductDetail extends StoreProduct {
  images: StoreImage[]
}

// ---- cart quote (the server prices every line) ----
export interface QuoteLine {
  product_id: number
  tier_id: number
  bundles: number
  status: 'ok' | 'unavailable' | 'invalid'
  product_name: string | null
  tier_label: string | null
  image_url: string | null
  image_alt: string | null
  units: number | null
  bundle_price_fils: number | null
  pack_quantity: number | null
  line_total_fils: number | null
}

export interface Quote {
  lines: QuoteLine[]
  totals: { line_count: number; bundle_count: number; pack_count: number; total_fils: number }
  problems: { code: 'unavailable' | 'invalid_bundles'; index: number }[]
}
