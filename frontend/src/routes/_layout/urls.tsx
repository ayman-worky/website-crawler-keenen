// src/routes/_layout/urls.tsx
import { Outlet, createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/_layout/urls")({
  component: UrlsLayout,
})

function UrlsLayout() {
  return <Outlet />
}