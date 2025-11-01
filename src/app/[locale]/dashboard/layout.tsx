'use client';

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Settings, MessageSquare, Database, Users } from "lucide-react";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('common');

  useEffect(() => {
    if (status === 'authenticated' && !session?.user) {
      router.push('/');
    }
  }, [session, status, router]);

  if (status === 'loading') {
    return (
      <div className="flex justify-center items-center min-h-screen bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-foreground"></div>
      </div>
    );
  }

  if (status === 'unauthenticated' || !session?.user) {
    return null;
  }

  const navItems = [
    { 
      href: '/dashboard/whatsapp', 
      label: 'WhatsApp',
      icon: MessageSquare,
      adminOnly: false 
    },
    { 
      href: '/dashboard/schema', 
      label: 'Schema',
      icon: Database,
      adminOnly: true 
    },
    { 
      href: '/dashboard/admin', 
      label: 'User Management',
      icon: Users,
      adminOnly: true 
    },
  ];

  const isAdmin = session?.user?.role === 'ADMIN';
  const filteredNavItems = navItems.filter(item => !item.adminOnly || isAdmin);

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6">
        {/* Navigation */}
        <Card className="bg-card border-border mb-6">
          <CardContent className="p-4">
            <nav className="flex flex-wrap gap-2">
              {filteredNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname.includes(item.href);
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                                         className={cn(
                       "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                       isActive
                         ? "bg-primary/10 text-primary border border-primary/20"
                         : "text-muted-foreground hover:text-foreground hover:bg-accent"
                     )}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </CardContent>
        </Card>

        {/* Main content */}
        {children}
      </div>
      <Toaster />
    </div>
  );
} 