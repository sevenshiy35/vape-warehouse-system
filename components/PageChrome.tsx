import Link from 'next/link'
import type { ReactNode } from 'react'

type PageShellProps = {
  children: ReactNode
  maxWidth?: string
}

type PageHeaderProps = {
  title: string
  description?: string
  eyebrow?: string
  actions?: ReactNode
}

type NavButtonProps = {
  href: string
  children: ReactNode
  variant?: 'default' | 'primary' | 'dark'
}

type PanelProps = {
  children: ReactNode
  className?: string
}

type StatCardProps = {
  label: string
  value: ReactNode
  description?: string
}

export function PageShell({
  children,
  maxWidth = 'max-w-6xl',
}: PageShellProps) {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-5 text-gray-900 dark:bg-gray-950 dark:text-gray-100 md:px-8 md:py-8">
      <div className={`mx-auto w-full ${maxWidth}`}>{children}</div>
    </main>
  )
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
}: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-gray-200 pb-5 dark:border-gray-800 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {eyebrow}
          </p>
        )}

        <h1 className="text-2xl font-bold tracking-normal text-gray-950 dark:text-gray-50 md:text-3xl">
          {title}
        </h1>

        {description && (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-gray-600 dark:text-gray-400 md:text-base">
            {description}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex shrink-0 flex-wrap gap-2 md:justify-end">
          {actions}
        </div>
      )}
    </div>
  )
}

export function NavButton({
  href,
  children,
  variant = 'default',
}: NavButtonProps) {
  const base =
    'inline-flex min-h-10 items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium shadow-sm transition hover:-translate-y-0.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-50 dark:focus:ring-offset-gray-950'

  const variants = {
    default:
      'border-gray-300 bg-white text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800',
    primary:
      'border-blue-600 bg-blue-600 text-white hover:bg-blue-700 dark:border-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400',
    dark:
      'border-gray-900 bg-gray-950 text-white hover:bg-gray-800 dark:border-gray-100 dark:bg-gray-100 dark:text-gray-950 dark:hover:bg-gray-200',
  }

  return (
    <Link href={href} className={`${base} ${variants[variant]}`}>
      {children}
    </Link>
  )
}

export function Panel({ children, className = '' }: PanelProps) {
  return (
    <section
      className={`rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900 md:p-5 ${className}`}
    >
      {children}
    </section>
  )
}

export function StatCard({ label, value, description }: StatCardProps) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
      <p className="text-sm text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-950 dark:text-gray-50">
        {value}
      </p>
      {description && (
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {description}
        </p>
      )}
    </div>
  )
}
