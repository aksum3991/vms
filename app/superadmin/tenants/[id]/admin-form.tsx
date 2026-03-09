"use client";

import { useState } from "react";
import { createTenantAdmin } from "@/lib/superadmin-actions";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, ShieldCheck, Loader2, Key } from "lucide-react";

interface TenantAdminFormProps {
  tenantId: string;
  tenantName: string;
}

export default function TenantAdminForm({ tenantId, tenantName }: TenantAdminFormProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !name) return;

    setIsLoading(true);
    try {
      const result = await createTenantAdmin({
        tenantId,
        email,
        name,
        password: password || undefined,
      });

      if (result.success) {
        toast({
          title: "Admin Created",
          description: `Administrator ${name} has been successfully added to ${tenantName} and synced with Keycloak.`,
        });
        setEmail("");
        setName("");
        setPassword("");
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to create administrator.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-lg border-primary/20 bg-primary/5">
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <CardTitle>Add Organization Administrator</CardTitle>
        </div>
        <CardDescription>
          Create a new administrative user for <strong>{tenantName}</strong>. This will automatically create 
          a matching account in the organization&apos;s Keycloak identity provider.
        </CardDescription>
      </CardHeader>
      <form onSubmit={handleSubmit}>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="admin-name">Full Name</Label>
              <Input
                id="admin-name"
                placeholder="John Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-email">Email Address</Label>
              <Input
                id="admin-email"
                type="email"
                placeholder="john@acme.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="admin-password">Initial Password (Optional)</Label>
            <div className="relative">
              <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="admin-password"
                type="password"
                placeholder="Leave blank for auto-generated password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-10"
              />
            </div>
            <p className="text-xs text-muted-foreground italic">
              A temporary password will be sent to the user via email if left blank.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-end gap-2 border-t border-primary/10 pt-6">
          <Button type="submit" disabled={isLoading} className="bg-primary hover:bg-primary/90">
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <UserPlus className="mr-2 h-4 w-4" />
            )}
            Add Administrator
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
