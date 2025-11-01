'use client'

import { signOut, useSession } from "next-auth/react"
import { useTranslations } from "next-intl"
import Image from "next/image"
import Link from "next/link"

export function AuthNav() {
  const { data: session, status } = useSession()
  const t = useTranslations('auth')

  return (
    <div className="flex items-center gap-4">
      {status === "loading" ? (
        <div className="h-8 w-8 animate-pulse rounded-full bg-muted" />
      ) : session ? (
        <div className="flex items-center gap-4">
          {session.user?.image && (
            <Image
              src={session.user.image}
              alt={session.user.name || t('userAvatar')}
              width={32}
              height={32}
              className="rounded-full"
            />
          )}
          <div className="flex flex-col">
            <span className="text-sm font-medium text-foreground">
              {session.user?.name}
            </span>
            <button
              onClick={() => signOut()}
              className="text-left text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            >
              {t('signOut')}
            </button>
          </div>
        </div>
      ) : (
        <Link
          href="/auth/signin"
          className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
        >
          {t('signIn')}
        </Link>
      )}
    </div>
  )
} 