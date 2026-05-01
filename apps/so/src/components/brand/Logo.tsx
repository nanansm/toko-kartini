import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LogoProps {
  variant?: 'light' | 'dark';
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

const SIZES = {
  sm: { w: 28, h: 28, text: 'text-sm' },
  md: { w: 36, h: 36, text: 'text-base' },
  lg: { w: 48, h: 48, text: 'text-lg' },
} as const;

export function Logo({
  variant = 'light',
  size = 'md',
  showText = false,
  className,
}: LogoProps) {
  const src = variant === 'light' ? '/blacklogo.png' : '/whitelogo.png';
  const { w, h, text } = SIZES[size];

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Image
        src={src}
        alt="Toko Kartini"
        width={w}
        height={h}
        className="object-contain"
        priority
      />
      {showText && (
        <span
          className={cn(
            'font-bold tracking-tight',
            text,
            variant === 'light' ? 'text-stone-900' : 'text-white',
          )}
        >
          Toko Kartini
        </span>
      )}
    </div>
  );
}
