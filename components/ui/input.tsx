import * as React from 'react'

import { cn } from '@/lib/utils'

function Input({ className, type, readOnly, disabled, ...props }: React.ComponentProps<'input'>) {
  return (
    <input
      type={type}
      readOnly={readOnly}
      disabled={disabled}
      data-slot="input"
      suppressHydrationWarning
      className={cn(
        // Base styles
        'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium md:text-sm',
        
        // Warm red theme - only for interactive fields
        !readOnly && !disabled && [
          'transition-all duration-[var(--form-transition)]',
          'hover:border-[var(--form-hover-border)]',
          'focus:border-[var(--form-focus-border)]',
          'focus:ring-[3px] focus:ring-[var(--form-focus-ring)]/30',
          'focus:bg-[var(--form-focus-bg)]',
        ],
        
        // Disabled/ReadOnly styles
        (disabled || readOnly) && 'opacity-50 cursor-not-allowed',
        
        // Validation styles
        'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
        
        className,
      )}
      {...props}
    />
  )
}

export { Input }
