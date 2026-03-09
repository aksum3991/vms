"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { saveTenant } from "@/lib/superadmin-actions";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Building2, ArrowLeft, Loader2 } from "lucide-react";
import Link from "next/link";

export default function NewTenantForm() {
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value;
    setName(newName);
    // Auto-generate slug if not manually edited
    if (!slug || slug === name.toLowerCase().replace(/[^a-z0-0]/g, "-")) {
      setSlug(newName.toLowerCase().replace(/[^a-z0-0]/g, "-"));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !slug) return;

    setIsLoading(true);
    try {
      const result = await saveTenant({ name, slug });
      if (result.success) {
        toast({
          title: "Tenant Created",
          description: `Organization ${name} has been successfully added.`,
        });
        router.push("/superadmin");
        router.refresh();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to create tenant.",
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
    <div className="max-w-2xl mx-auto">
      <div className="mb-6">
        <Button variant="ghost" size="sm" asChild className="mb-2">
          <Link href="/superadmin">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <CardTitle>Register New Organization</CardTitle>
          </div>
          <CardDescription>
            Create a new tenant on the platform. This will initialize a private database scope and default settings.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name</Label>
              <Input
                id="name"
                placeholder="e.g. Acme Corporation"
                value={name}
                onChange={handleNameChange}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="slug">URL Slug (System Identifier)</Label>
              <div className="flex gap-2 items-center">
                <span className="text-muted-foreground">vms.io/t/</span>
                <Input
                  id="slug"
                  placeholder="acme-corp"
                  value={slug}
                  onChange={(e) => setSlug(e.target.value.toLowerCase())}
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground italic">
                The unique identifier used for tenant-safe routing.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2 border-t pt-6">
            <Button variant="outline" type="button" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || !name || !slug}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Initialize Organization
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
