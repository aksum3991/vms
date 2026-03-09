"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { signIn } from "next-auth/react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Building2, Key, Mail, ShieldCheck, Loader2 } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState("")
  const [isSigningIn, setIsSigningIn] = useState(false)
  
  // Local login state
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const handleKeycloakLogin = async () => {
    setError("")
    setIsSigningIn(true)

    try {
      // Redirect to Keycloak, then come back to /post-login to route by role
      await signIn("keycloak", { callbackUrl: "/post-login" })
    } catch (e) {
      console.error("[login] Keycloak signIn error:", e)
      setError("Keycloak connection failed. Please try again.")
      setIsSigningIn(false)
    }
  }

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsSigningIn(true)

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })

      if (!response.ok) {
        const data = await response.json()
        setError(data.error || "Invalid credentials")
        setIsSigningIn(false)
        return
      }

      const { user } = await response.json()
      
      // Redirect based on role (mirrors PostLogin logic)
      if (user.role === "superadmin") {
        router.push("/superadmin")
      } else if (user.tenantSlug) {
        router.push(`/t/${user.tenantSlug}/${user.role}`)
      } else {
        router.push("/")
      }
    } catch (error) {
      console.error("[login] Local login error:", error)
      setError("Local login failed. Please try again.")
      setIsSigningIn(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
      <Card className="w-full max-w-md border-none shadow-2xl">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <div className="h-16 w-16 rounded-full bg-cyan-600/10 flex items-center justify-center">
              <Building2 className="h-10 w-10 text-cyan-600" />
            </div>
          </div>
          <CardTitle className="text-2xl text-center text-cyan-700">
            Visitor Management
          </CardTitle>
          <CardDescription className="text-center">
            Secure Access Portal
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive" className="bg-red-50 border-red-100 text-red-800">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="keycloak" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="keycloak" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white">
                <Key className="mr-2 h-4 w-4" />
                Keycloak
              </TabsTrigger>
              <TabsTrigger value="local" className="data-[state=active]:bg-cyan-600 data-[state=active]:text-white">
                <ShieldCheck className="mr-2 h-4 w-4" />
                Administrative
              </TabsTrigger>
            </TabsList>

            <TabsContent value="keycloak" className="space-y-4 py-2">
              <p className="text-sm text-muted-foreground text-center px-4">
                Recommended for organization employees and staff. Uses your corporate identity provider.
              </p>
              <Button
                type="button"
                className="w-full bg-cyan-600 hover:bg-cyan-700 text-white h-12"
                onClick={handleKeycloakLogin}
                disabled={isSigningIn}
              >
                {isSigningIn ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                {isSigningIn ? "Connecting..." : "Sign in via Keycloak"}
              </Button>
            </TabsContent>

            <TabsContent value="local">
              <form onSubmit={handleLocalLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="superadmin@vms.io"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      required
                    />
                  </div>
                </div>
                <Button 
                  type="submit" 
                  className="w-full bg-slate-800 hover:bg-slate-900 text-white h-12 mt-2"
                  disabled={isSigningIn}
                >
                  {isSigningIn ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : null}
                  {isSigningIn ? "Verifying..." : "Register Internal User"}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>

        <div className="px-6 pb-6 text-center border-t border-slate-50 pt-4">
          <p className="text-xs text-gray-400">
            Powered by <span className="font-semibold text-cyan-600">VMS3 Secure Gateway</span>
          </p>
        </div>
      </Card>
    </div>
  )
}


























// "use client"

// import type React from "react"

// import { useState } from "react"
// import { useRouter } from "next/navigation"
// import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
// import { Input } from "@/components/ui/input"
// import { Button } from "@/components/ui/button"
// import { Label } from "@/components/ui/label"
// import { Alert, AlertDescription } from "@/components/ui/alert"
// import { Lock, Mail, Building2, Eye, EyeOff } from "lucide-react"

// import { storage } from "@/lib/storage"
// import { useAuth } from "@/lib/auth"
// import { signIn } from "next-auth/react"

// export default function LoginPage() {
//   const [email, setEmail] = useState("")
//   const [password, setPassword] = useState("")
//   const [showPassword, setShowPassword] = useState(false)
//   const [error, setError] = useState("")
//   const router = useRouter()
//   const { setAuthUser } = useAuth()

//   const handleSubmit = async (e: React.FormEvent) => {
//     e.preventDefault()
//     setError("")

//     try {
//       const response = await fetch('/api/auth/login', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ email, password })
//       })

//       if (!response.ok) {
//         const data = await response.json()
//         setError(data.error || "Login failed")
//         return
//       }

//       const { user } = await response.json()

//       // Update global auth state via context (this updates AuthProvider in layout)
//       setAuthUser(user)
      
//       // Store in localStorage as backup/sync (handled by setAuthUser but harmless to keep)
//       storage.setCurrentUser(user)

//       // Redirect based on role
//       if (user.role === "reception") {
//         router.push("/reception")
//       } else {
//         router.push("/")
//       }
//     } catch (error) {
//       console.error("[login] Error:", error)
//       setError("Login failed. Please try again.")
//     }
//   }

//   return (
//     <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
//       <Card className="w-full max-w-md">
//         <CardHeader className="space-y-1">
//           <div className="flex items-center justify-center mb-4">
//             <div className="h-16 w-16 rounded-full bg-cyan-600/10 flex items-center justify-center">
//               <Building2 className="h-10 w-10 text-cyan-600" />
//             </div>
//           </div>
//           <CardTitle className="text-2xl text-center text-cyan-700">Visitor Management System</CardTitle>
//           <CardDescription className="text-center">Enter your credentials to access the system</CardDescription>
//         </CardHeader>
//         <CardContent>
//           <form onSubmit={handleSubmit} className="space-y-4">
//             {error && (
//               <Alert variant="destructive">
//                 <AlertDescription>{error}</AlertDescription>
//               </Alert>
//             )}
//             <div className="space-y-2">
//               <Label htmlFor="email">Email</Label>
//               <div className="relative">
//                 <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
//                 <Input
//                   id="email"
//                   type="email"
//                   placeholder="admin@example.com"
//                   value={email}
//                   onChange={(e) => setEmail(e.target.value)}
//                   className="pl-10"
//                   required
//                 />
//               </div>
//             </div>
//             <div className="space-y-2">
//               <Label htmlFor="password">Password</Label>
//               <div className="relative">
//                 <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
//                 <Input
//                   id="password"
//                   type={showPassword ? "text" : "password"}
//                   placeholder="Enter your password"
//                   value={password}
//                   onChange={(e) => setPassword(e.target.value)}
//                   className="pl-10 pr-10"
//                   required
//                 />
//                 <button
//                   type="button"
//                   onClick={() => setShowPassword(!showPassword)}
//                   className="absolute inset-y-0 right-0 flex items-center pr-3 text-muted-foreground"
//                 >
//                   {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
//                 </button>
//               </div>
//             </div>
//             {/* <Button onClick={() => signIn("keycloak", { callbackUrl: "/" })}>
//                   Sign in with Keycloak
//             </Button> */}
//             <Button type="submit" className="w-full bg-cyan-600 hover:bg-cyan-700 text-white">
//               Sign In
//             </Button>
//           </form>
//         </CardContent>
//         <div className="px-6 pb-4 text-center">
//           <p className="text-xs text-gray-500">
//             Powered by <span className="font-semibold text-cyan-600">MInT</span>
//           </p>
//         </div>
//       </Card>
//     </div>
//   )
// }
