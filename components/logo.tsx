import Image from 'next/image'
import { cn } from '@/lib/utils'

interface LogoProps {
  size?: number
  showText?: boolean
  className?: string
  textClassName?: string
}

export function Logo({ size = 48, showText = false, className, textClassName }: LogoProps) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Image
        src="/coco-cash-logo.png"
        alt="CocoCash"
        width={1024}
        height={1024}
        className="rounded-md bg-white object-contain shrink-0"
        style={{ height: size, width: 'auto' }}
        priority
      />
      {showText && (
        <span className={cn('font-bold tracking-tight', textClassName)}>
          <span className="text-[#d9b38c]">Coco</span>
          <span className="text-primary">Cash</span>
        </span>
      )}
    </div>
  )
}
