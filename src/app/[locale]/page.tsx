"use client"

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Toaster } from "@/components/ui/toaster";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { MessageSquare, Zap, BarChart3, ArrowRight } from "lucide-react";

export default function Home() {
  const { toast } = useToast();
  const t = useTranslations("home");
  const { data: session } = useSession();

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <main className="container mx-auto px-4 py-16">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <div className="mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 mb-6">
              <div className="text-3xl font-bold text-primary">C&C</div>
            </div>
            <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
              {t("welcome")}
            </h1>
            <p className="text-xl text-primary font-semibold mb-4">
              {t("subtitle")}
            </p>
            <p className="text-lg text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              {t("description")}
            </p>
          </div>

          <div className="flex gap-4 items-center justify-center flex-col sm:flex-row">
            {session ? (
              <Link href="/dashboard/whatsapp">
                <Button size="lg" className="min-w-[200px]">
                  {t("accessDashboard")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            ) : (
              <Link href="/auth/signin">
                <Button size="lg" className="min-w-[200px]">
                  {t("accessDashboard")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            )}
            <Button 
              variant="outline" 
              size="lg"
              onClick={() => window.open("https://compassandcoin.com", "_blank")}
            >
              {t("learnMore")}
            </Button>
          </div>
        </div>

        {/* Features Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
          <Card className="border-border/50 hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <MessageSquare className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>{t("features.whatsapp")}</CardTitle>
              <CardDescription>{t("features.whatsappDesc")}</CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-border/50 hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Zap className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>{t("features.automation")}</CardTitle>
              <CardDescription>{t("features.automationDesc")}</CardDescription>
            </CardHeader>
          </Card>

          <Card className="border-border/50 hover:border-primary/50 transition-colors">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <BarChart3 className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>{t("features.analytics")}</CardTitle>
              <CardDescription>{t("features.analyticsDesc")}</CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Company Info Section */}
        <div className="text-center bg-card border border-border rounded-lg p-8">
          <p className="text-muted-foreground mb-4">
            Powered by Compass & Coin Company
          </p>
          <p className="text-sm text-muted-foreground">
            Visit{" "}
            <a 
              href="https://compassandcoin.com" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline font-medium"
            >
              compassandcoin.com
            </a>
            {" "}to learn more about our services
          </p>
        </div>
      </main>

      <Toaster />
    </div>
  );
}
