import { useEffect, useState } from 'react';
import defaultCrestImg from '../assets/images/crest_default_club_1795098933771.jpg';

interface CrestAvatarProps {
  src?: string | null;
  alt: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<CrestAvatarProps['size']>, string> = {
  xs: 'w-6 h-6',
  sm: 'w-9 h-9',
  md: 'w-12 h-12',
  lg: 'w-16 h-16',
};

export function CrestAvatar({
  src,
  alt,
  size = 'md',
  className = '',
}: CrestAvatarProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  const resolvedSrc = !failed && src && src.trim() ? src : defaultCrestImg;

  return (
    <div
      className={`${SIZE_CLASSES[size]} shrink-0 overflow-hidden rounded-lg border border-slate-700/80 bg-[#0B1220] flex items-center justify-center ${className}`}
    >
      <img
        src={resolvedSrc}
        alt={alt}
        onError={() => setFailed(true)}
        className="w-full h-full object-cover"
      />
    </div>
  );
}
