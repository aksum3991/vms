'use client'

import { useToast } from '@/components/ui/use-toast'
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from '@/components/ui/toast'
import { CheckCircle2, XCircle } from 'lucide-react'

import { cn } from '@/lib/utils'

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        // Determine icon based on variant
        const Icon = variant === 'success' 
          ? CheckCircle2 
          : variant === 'destructive' 
          ? XCircle 
          : null

        return (
          <Toast key={id} variant={variant} {...props}>
            <div className="flex items-start gap-3 w-full">
              {Icon && (
                <Icon 
                  className={cn(
                    "h-5 w-5 shrink-0 mt-0.5",
                    variant === 'success' && "text-green-600 dark:text-green-400",
                    variant === 'destructive' && "text-red-600 dark:text-red-400"
                  )} 
                />
              )}
              <div className="grid gap-1 flex-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
