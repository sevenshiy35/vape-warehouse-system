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
  variant?: 'default' | 'primary' | 'dark' | 'success' | 'danger' | 'quiet'
}

type PanelProps = {
  children: ReactNode
  className?: string
}

type StatCardProps = {
  label: string
  value: ReactNode
  description?: string
  tone?: 'default' | 'primary' | 'success' | 'warning' | 'danger'
}

export function PageShell({
  children,
  maxWidth = 'max-w-6xl',
}: PageShellProps) {
  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-5 text-[var(--foreground)] dark:text-zinc-100 md:px-8 md:py-8">
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
    <div className="mb-7 flex flex-col gap-4 border-b border-[var(--border-soft)] pb-5 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            {eyebrow}
          </p>
        )}

        <h1 className="text-3xl font-bold tracking-[-0.02em] text-zinc-950 dark:text-zinc-50 md:text-4xl">
          {title}
        </h1>

        {description && (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--muted)] md:text-base">
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
    'inline-flex min-h-11 items-center justify-center rounded-xl border px-4 py-2 text-sm font-semibold transition hover:-translate-y-px focus:outline-none focus:ring-2 focus:ring-[var(--primary)] focus:ring-offset-2 focus:ring-offset-[var(--background)]'

  const variants = {
    default:
      'border-zinc-300 bg-white text-zinc-900 shadow-sm shadow-zinc-200/60 hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:shadow-none dark:hover:bg-zinc-800',
    primary:
      'border-[var(--primary)] bg-[var(--primary)] text-white shadow-sm shadow-blue-500/20 hover:bg-[var(--primary-hover)]',
    dark:
      'border-zinc-950 bg-zinc-950 text-white shadow-sm shadow-zinc-300/40 hover:bg-zinc-800 dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200',
    success:
      'border-[var(--success)] bg-[var(--success)] text-white shadow-sm shadow-green-500/20 hover:brightness-95',
    danger:
      'border-[var(--danger)] bg-[var(--danger)] text-white shadow-sm shadow-red-500/20 hover:brightness-95',
    quiet:
      'border-transparent bg-transparent text-zinc-700 hover:bg-white/70 dark:text-zinc-200 dark:hover:bg-zinc-900',
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
      className={`rounded-2xl border border-[var(--border-soft)] bg-[var(--surface)] p-4 shadow-sm shadow-zinc-200/70 dark:bg-[var(--surface)] dark:shadow-none md:p-5 ${className}`}
    >
      {children}
    </section>
  )
}

export function StatCard({
  label,
  value,
  description,
  tone = 'default',
}: StatCardProps) {
  const tones = {
    default:
      'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[var(--surface)]',
    primary:
      'border-blue-200 bg-blue-50/80 dark:border-blue-900 dark:bg-blue-950/30',
    success:
      'border-green-200 bg-green-50/80 dark:border-green-900 dark:bg-green-950/30',
    warning:
      'border-orange-200 bg-orange-50/80 dark:border-orange-900 dark:bg-orange-950/30',
    danger:
      'border-red-200 bg-red-50/80 dark:border-red-900 dark:bg-red-950/30',
  }

  return (
    <div
      className={`rounded-2xl border p-4 shadow-sm shadow-zinc-200/70 dark:shadow-none ${tones[tone]}`}
    >
      <p className="text-sm font-medium text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-1 text-3xl font-bold tracking-[-0.03em] text-zinc-950 dark:text-zinc-50">
        {value}
      </p>
      {description && (
        <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
          {description}
        </p>
      )}
    </div>
  )
}
