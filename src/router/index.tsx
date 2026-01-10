// src/router.tsx
import * as React from "react"
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom"
import AuthProvider from "@/context/AuthContext"
import RequireAuth from "@/components/RequireAuth"
import GuestOnly from "@/components/GuestOnly"
import useAuth from "@/hooks/useAuth"

import AppLayout from "@/layouts/AppLayout"
import AuthLayout from "@/layouts/AuthLayout"
import MapLayout from "@/layouts/MapLayout"
import ReservationsMapPage from "@/app/pages/ReservationsMap"

const Overview = React.lazy(() => import("@/app/pages/Overview"))
const Reservations = React.lazy(() => import("@/app/pages/Reservations"))
const Clients = React.lazy(() => import("@/app/pages/Clients"))
const Orders = React.lazy(() => import("@/app/pages/Orders"))
const Buses = React.lazy(() => import("@/app/pages/Buses"))
const People = React.lazy(() => import("@/app/pages/People"))
const Staff = React.lazy(() => import("@/app/pages/Staff"))
const Notifications = React.lazy(() => import("@/app/pages/Notifications"))
const Settings = React.lazy(() => import("@/app/pages/Settings"))
const MyAccount = React.lazy(() => import("@/app/pages/MyAccount"))
const Login = React.lazy(() => import("@/app/pages/Auth/Login"))
const NotFound = React.lazy(() => import("@/app/pages/NotFound"))

function withSuspense(node: React.ReactNode) {
  return <React.Suspense fallback={null}>{node}</React.Suspense>
}

function Providers() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}

/** Admin-only route guard */
function RequireAdmin() {
  const { user, status } = useAuth()
  if (status === "loading") return null
  const role = (user?.role ?? "").toString().toLowerCase()
  const isAdmin = role === "admin" || role === "superadmin"
  return isAdmin ? <Outlet /> : <Navigate to="/reservations" replace />
}

// add this helper near RequireAdmin
function LandingRedirect() {
  const { user, status } = useAuth()
  if (status === "loading") return null // or a tiny spinner
  const role = (user?.role ?? "").toString().toLowerCase()
  const isAdmin = role === "admin" || role === "superadmin"
  return <Navigate to={isAdmin ? "/overview" : "/reservations"} replace />
}

export const router = createBrowserRouter([
  {
    element: <Providers />,
    children: [
      /* ---------------------- AUTH ROUTES ON /auth ---------------------- */
      {
        path: "/auth",
        element: <AuthLayout />,
        children: [
          {
            element: <GuestOnly />,
            children: [
              { index: true, element: <Navigate to="login" replace /> },
              { path: "login", element: withSuspense(<Login />) },
            ],
          },
        ],
      },

      /* ---------------------- APP ROUTES ON / (authenticated) ---------------------- */
      {
        path: "/",
        element: <AppLayout />,
        children: [
          {
            element: <RequireAuth />,
            children: [
              // THIS is the only index route now
              { index: true, element: <LandingRedirect /> },

              { path: "clients", element: withSuspense(<Clients />) },
              { path: "orders", element: withSuspense(<Orders />) },
              { path: "reservations", element: withSuspense(<Reservations />) },
              { path: "buses", element: withSuspense(<Buses />) },
              { path: "notifications", element: withSuspense(<Notifications />) },
              { path: "account", element: withSuspense(<MyAccount />) },

              // Admin-only
              {
                element: <RequireAdmin />,
                children: [
                  { path: "overview", element: withSuspense(<Overview />) },
                  { path: "people", element: withSuspense(<People />) },
                  { path: "staff", element: withSuspense(<Staff />) },
                  // { path: "settings", element: withSuspense(<Settings />) },
                ],
              },
            ],
          },
        ],
      },


      /* ---------------------- MAP LAYOUT ON /map (no chrome) ---------------------- */
      {
        path: "/map",
        element: <MapLayout />,
        children: [
          {
            element: <RequireAuth />,
            children: [
              // URL becomes /map/reservations
              { path: "reservations", element: withSuspense(<ReservationsMapPage />) },
            ],
          },
        ],
      },

      /* ---------------------- FALLBACK ---------------------- */
      { path: "*", element: withSuspense(<NotFound />) },
    ],
  },
])
