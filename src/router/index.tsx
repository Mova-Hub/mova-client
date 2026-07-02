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
import JobsPage from "@/app/pages/Jobs"

const Overview = React.lazy(() => import("@/app/pages/Overview"))
const Reservations = React.lazy(() => import("@/app/pages/Reservations"))
const ReservationDetailPage = React.lazy(() => import("@/app/pages/reservations/ReservationDetailPage"))
const Clients = React.lazy(() => import("@/app/pages/Clients"))
const ClientDetailPage = React.lazy(() => import("@/app/pages/clients/ClientDetailPage"))
const Orders = React.lazy(() => import("@/app/pages/Orders"))
const Buses = React.lazy(() => import("@/app/pages/Buses"))
const BusDetailPage = React.lazy(() => import("@/app/pages/buses/BusDetailPage"))
const People = React.lazy(() => import("@/app/pages/People"))
const PersonDetailPage = React.lazy(() => import("@/app/pages/people/PersonDetailPage"))
const Staff = React.lazy(() => import("@/app/pages/Staff"))
const StaffDetailPage = React.lazy(() => import("@/app/pages/staff/StaffDetailPage"))
const JobDetailPage = React.lazy(() => import("@/app/pages/jobs/JobDetailPage"))
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
              { path: "clients/:id", element: withSuspense(<ClientDetailPage />) },
              { path: "orders", element: withSuspense(<Orders />) },
              { path: "reservations", element: withSuspense(<Reservations />) },
              { path: "reservations/:id", element: withSuspense(<ReservationDetailPage />) },
              { path: "buses", element: withSuspense(<Buses />) },
              { path: "buses/:id", element: withSuspense(<BusDetailPage />) },
              { path: "notifications", element: withSuspense(<Notifications />) },
              { path: "account", element: withSuspense(<MyAccount />) },

              // Admin-only
              {
                element: <RequireAdmin />,
                children: [
                  { path: "overview", element: withSuspense(<Overview />) },
                  { path: "people", element: withSuspense(<People />) },
                  { path: "people/:id", element: withSuspense(<PersonDetailPage />) },
                  { path: "staff", element: withSuspense(<Staff />) },
                  { path: "staff/:id", element: withSuspense(<StaffDetailPage />) },
                  { path: "jobs", element: withSuspense(<JobsPage />) },
                  { path: "jobs/:id", element: withSuspense(<JobDetailPage />) },
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
