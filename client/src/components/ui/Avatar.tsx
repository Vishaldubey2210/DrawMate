import React from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  Paintbrush,
  Sparkles,
  Zap,
  Star,
  Flame,
  Crown,
  Heart,
  Palette,
} from 'lucide-react';

export const AVATAR_PRESETS = [
  {
    id: 'avatar-1',
    name: 'Pixel Painter',
    bg: 'from-indigo-500 to-purple-600',
    icon: Paintbrush,
  },
  {
    id: 'avatar-2',
    name: 'Neon Doodler',
    bg: 'from-emerald-400 to-teal-600',
    icon: Sparkles,
  },
  {
    id: 'avatar-3',
    name: 'Speedy Scribbler',
    bg: 'from-amber-400 to-orange-500',
    icon: Zap,
  },
  {
    id: 'avatar-4',
    name: 'Cosmic Sketcher',
    bg: 'from-pink-500 to-rose-600',
    icon: Star,
  },
  {
    id: 'avatar-5',
    name: 'Master Inker',
    bg: 'from-cyan-500 to-blue-600',
    icon: Palette,
  },
  {
    id: 'avatar-6',
    name: 'Creative Blaze',
    bg: 'from-red-500 to-amber-500',
    icon: Flame,
  },
  {
    id: 'avatar-7',
    name: 'Royal Brush',
    bg: 'from-yellow-400 to-amber-600',
    icon: Crown,
  },
  {
    id: 'avatar-8',
    name: 'Heart Illustrator',
    bg: 'from-violet-500 to-fuchsia-600',
    icon: Heart,
  },
];

export interface AvatarProps {
  avatarId?: string;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  avatarId = 'avatar-1',
  name,
  size = 'md',
  className,
}) => {
  const preset = AVATAR_PRESETS.find((p) => p.id === avatarId) || AVATAR_PRESETS[0];
  const IconComponent = preset.icon;

  const sizeClasses = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-14 h-14 text-base',
    xl: 'w-20 h-20 text-xl',
    '2xl': 'w-28 h-28 text-3xl',
  };

  const iconSizes = {
    xs: 'w-3 h-3',
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-7 h-7',
    xl: 'w-10 h-10',
    '2xl': 'w-14 h-14',
  };

  return (
    <div
      className={twMerge(
        clsx(
          'relative rounded-2xl flex items-center justify-center font-bold text-white shadow-sm bg-gradient-to-tr shrink-0 select-none overflow-hidden transition-transform duration-200',
          preset.bg,
          sizeClasses[size],
          className
        )
      )}
      title={name || preset.name}
    >
      <IconComponent className={clsx('text-white drop-shadow-md', iconSizes[size])} />
      <div className="absolute inset-0 bg-white/10 opacity-0 hover:opacity-100 transition-opacity" />
    </div>
  );
};
