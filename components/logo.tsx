import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LogoProps {
  size?: number
  showText?: boolean
  className?: string
  textClassName?: string
}

export function Logo({ size = 32, showText = true, className, textClassName }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Image
        src="/cocosoft-logo.jpeg"
        alt="CocoCash"
        width={size}
        height={size}
        className="rounded-lg object-cover shrink-0"
        priority
      />
      {showText && (
        <span className={cn('font-bold tracking-tight', textClassName)}>
          <span className="text-[#d9b38c]">Coco</span>
          <span className="text-emerald-500">Cash</span>
        </span>
      )}
    </div>
  )
}
