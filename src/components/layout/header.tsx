'use client';

import Link from "next/link"
import Image from "next/image"
import { useTranslations } from 'next-intl';
import { useSession } from "next-auth/react"
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"
import { AuthNav } from "@/components/nav/auth-nav"
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageSwitcher } from '@/components/language-switcher';

export function Header() {
  const t = useTranslations('common');
  const { data: session } = useSession();

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-3 cursor-pointer">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center">
              <span className="text-sm font-bold text-primary-foreground">C&C</span>
            </div>
            <span className="text-xl font-bold">{t('appName')}</span>
          </Link>
          <NavigationMenu>
            <NavigationMenuList>
              {session?.user?.role === 'ADMIN' && (
                <NavigationMenuItem>
                  <Link href="/dashboard/" className="block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground cursor-pointer">
                    Admin Dashboard
                  </Link>
                </NavigationMenuItem>
              )}
             
            </NavigationMenuList>
          </NavigationMenu>
        </div>
        <div className="flex items-center gap-4">
          <LanguageSwitcher />
          <ThemeToggle />
          <AuthNav />
        </div>
      </div>
    </header>
  )
} 