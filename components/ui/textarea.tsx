import * as React from 'react'

import { cn } from '@/lib/utils'

function Textarea({ className, readOnly, disabled, ...props }: React.ComponentProps<'textarea'>) {
  return (
    <textarea
      readOnly={readOnly}
      disabled={disabled}
      data-slot="textarea"
      className={cn(
        // Base styles
        'border-input placeholder:text-muted-foreground dark:bg-input/30 flex field-sizing-content min-h-16 w-full rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none md:text-sm',
        
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

export { Textarea }
