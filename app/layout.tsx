
"use client"

import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import "./globals.css"
import { AuthProvider } from "@/lib/auth"
import { SidebarLayout } from "@/components/sidebar-layout"
import { Toaster } from "@/components/ui/toaster"

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })

// Metadata can't be used in a client component.
// If you need it, you'll have to move it to a server component.
// export const metadata: Metadata = {
//   title: "Document Management System",
//   description: "Guest and document management system with multi-level approval workflow",
//   generator: "v0.app",
//   icons: {
//     icon: [
//       {
//         url: "/mint.png",
//         media: "(prefers-color-scheme: light)",
//       },
//       {
//         url: "/mint.png",
//         media: "(prefers-color-scheme: dark)",
//       },
//       {
//         url: "/mint.png",
//         type: "image/png",
//       },
//     ],
//     apple: "/mint.png",
//   },
// }

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body className={`font-sans antialiased ${inter.variable}`}>
        <AuthProvider>
          <SidebarLayout>{children}</SidebarLayout>
          <Toaster />
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
