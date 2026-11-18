import { Navigate, Route, Routes } from 'react-router'
import AdminLayout from './components/admin/AdminLayout'
import { GuestOnly, RequireAdmin } from './components/auth/guards'
import Layout from './components/layout/Layout'
import BrandsPage from './pages/admin/BrandsPage'
import CategoriesPage from './pages/admin/CategoriesPage'
import ProductFormPage from './pages/admin/ProductFormPage'
import ProductsPage from './pages/admin/ProductsPage'
import CartPage from './pages/CartPage'
import LoginPage from './pages/LoginPage'
import NotFoundPage from './pages/NotFoundPage'
import RegisterPage from './pages/RegisterPage'
import ProductPage from './pages/ProductPage'
import StorePage from './pages/StorePage'

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
          <Route path="/admin" element={<AdminLayout />}>
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
