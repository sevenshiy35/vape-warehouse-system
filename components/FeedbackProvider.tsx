'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'

type NoticeType = 'success' | 'error' | 'info' | 'warning'
type ConfirmTone = 'default' | 'danger' | 'success'

type NoticeInput = {
  type?: NoticeType
  title: string
  message?: string
  duration?: number
}

type Notice = Required<Pick<NoticeInput, 'type' | 'title'>> &
  Pick<NoticeInput, 'message'> & {
    id: number
  }

type ConfirmInput = {
  title: string
  message?: ReactNode
  confirmText?: string
  cancelText?: string
  tone?: ConfirmTone
}

type ConfirmRequest = ConfirmInput & {
  resolve: (value: boolean) => void
}

type FeedbackContextValue = {
  notify: (notice: NoticeInput) => void
  confirm: (options: ConfirmInput) => Promise<boolean>
}

const FeedbackContext = createContext<FeedbackContextValue | null>(null)

function getNoticeClass(type: NoticeType) {
  if (type === 'success') {
    return 'border-green-200 bg-green-50 text-green-900 dark:border-green-900/60 dark:bg-green-950 dark:text-green-100'
  }

  if (type === 'error') {
    return 'border-red-200 bg-red-50 text-red-900 dark:border-red-900/60 dark:bg-red-950 dark:text-red-100'
  }

  if (type === 'warning') {
    return 'border-yellow-200 bg-yellow-50 text-yellow-900 dark:border-yellow-900/60 dark:bg-yellow-950 dark:text-yellow-100'
  }

  return 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950 dark:text-blue-100'
}

function getConfirmButtonClass(tone: ConfirmTone) {
  if (tone === 'danger') {
    return 'border-red-600 bg-red-600 text-white hover:bg-red-700 dark:border-red-500 dark:bg-red-500 dark:hover:bg-red-400'
  }

  if (tone === 'success') {
    return 'border-green-700 bg-green-700 text-white hover:bg-green-800 dark:border-green-600 dark:bg-green-600 dark:hover:bg-green-500'
  }

  return 'border-blue-600 bg-blue-600 text-white hover:bg-blue-700 dark:border-blue-500 dark:bg-blue-500 dark:hover:bg-blue-400'
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Notice[]>([])
  const [confirmRequest, setConfirmRequest] = useState<ConfirmRequest | null>(
    null
  )
  const nextNoticeId = useRef(1)

  const dismissNotice = useCallback((id: number) => {
    setNotices((current) => current.filter((notice) => notice.id !== id))
  }, [])

  const notify = useCallback(
    ({ type = 'info', title, message, duration = 4000 }: NoticeInput) => {
      const id = nextNoticeId.current
      nextNoticeId.current += 1

      setNotices((current) => [
        ...current,
        {
          id,
          type,
          title,
          message,
        },
      ])

      window.setTimeout(() => dismissNotice(id), duration)
    },
    [dismissNotice]
  )

  const confirm = useCallback((options: ConfirmInput) => {
    return new Promise<boolean>((resolve) => {
      setConfirmRequest({
        ...options,
        resolve,
      })
    })
  }, [])

  const closeConfirm = useCallback((value: boolean) => {
    setConfirmRequest((current) => {
      current?.resolve(value)
      return null
    })
  }, [])

  const value = useMemo(
    () => ({
      notify,
      confirm,
    }),
    [confirm, notify]
  )

  const confirmTone = confirmRequest?.tone || 'default'

  return (
    <FeedbackContext.Provider value={value}>
      {children}

      <div className="fixed right-4 top-4 z-[80] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-3">
        {notices.map((notice) => (
          <div
            key={notice.id}
            className={`rounded-lg border p-4 shadow-lg ${getNoticeClass(
              notice.type
            )}`}
            role="status"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold">{notice.title}</p>
                {notice.message && (
                  <p className="mt-1 text-sm opacity-80">{notice.message}</p>
                )}
              </div>

              <button
                type="button"
                onClick={() => dismissNotice(notice.id)}
                className="rounded-md px-2 py-1 text-sm opacity-70 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
                aria-label="关闭提示"
              >
                关闭
              </button>
            </div>
          </div>
        ))}
      </div>

      {confirmRequest && (
        <div
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4 dark:bg-black/70"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-5 text-gray-900 shadow-xl dark:border-gray-800 dark:bg-gray-900 dark:text-gray-100">
            <h2 className="text-lg font-semibold">{confirmRequest.title}</h2>

            {confirmRequest.message && (
              <div className="mt-3 whitespace-pre-line text-sm leading-6 text-gray-600 dark:text-gray-300">
                {confirmRequest.message}
              </div>
            )}

            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => closeConfirm(false)}
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 dark:hover:bg-gray-800"
              >
                {confirmRequest.cancelText || '取消'}
              </button>

              <button
                type="button"
                onClick={() => closeConfirm(true)}
                className={`inline-flex min-h-10 items-center justify-center rounded-lg border px-4 py-2 text-sm font-medium shadow-sm ${getConfirmButtonClass(
                  confirmTone
                )}`}
              >
                {confirmRequest.confirmText || '确认'}
              </button>
            </div>
          </div>
        </div>
      )}
    </FeedbackContext.Provider>
  )
}

export function useFeedback() {
  const context = useContext(FeedbackContext)

  if (!context) {
    throw new Error('useFeedback must be used inside FeedbackProvider')
  }

  return context
}
