import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router'
import { GuestOnly, RequireAdmin } from './components/auth/guards'
import Layout from './components/layout/Layout'
import { LoadingState } from './components/ui/Feedback'
import CartPage from './pages/CartPage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import ProductPage from './pages/ProductPage'
import RegisterPage from './pages/RegisterPage'
import StorePage from './pages/StorePage'

// The admin area is only for admins, so customers never download its code.
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'))
const BrandsPage = lazy(() => import('./pages/admin/BrandsPage'))
const CategoriesPage = lazy(() => import('./pages/admin/CategoriesPage'))
const ProductFormPage = lazy(() => import('./pages/admin/ProductFormPage'))
const ProductsPage = lazy(() => import('./pages/admin/ProductsPage'))

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<StorePage />} />
        <Route path="/products/:id" element={<ProductPage />} />
        <Route path="/cart" element={<CartPage />} />
        <Route element={<GuestOnly />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>
        <Route element={<RequireAdmin />}>
          <Route
            path="/admin"
            element={
              <Suspense fallback={<LoadingState />}>
                <AdminLayout />
              </Suspense>
            }
          >
            <Route index element={<Navigate to="products" replace />} />
            <Route path="products" element={<ProductsPage />} />
            <Route path="products/new" element={<ProductFormPage />} />
            <Route path="products/:id" element={<ProductFormPage />} />
            <Route path="brands" element={<BrandsPage />} />
            <Route path="categories" element={<CategoriesPage />} />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}
