import React, { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { Input, InputProps } from './Input.js';

export interface PasswordInputProps extends Omit<InputProps, 'type' | 'rightIcon'> {
  showStrengthMeter?: boolean;
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ showStrengthMeter = false, value, onChange, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);
    const pwd = typeof value === 'string' ? value : '';

    const hasUpper = /[A-Z]/.test(pwd);
    const hasLower = /[a-z]/.test(pwd);
    const hasNumber = /[0-9]/.test(pwd);
    const hasMinLength = pwd.length >= 8;

    const strengthScore = [hasMinLength, hasUpper, hasLower, hasNumber].filter(Boolean).length;

    return (
      <div className="w-full space-y-1.5">
        <Input
          ref={ref}
          type={showPassword ? 'text' : 'password'}
          leftIcon={<Lock className="w-4 h-4" />}
          rightIcon={
            <button
              type="button"
              tabIndex={-1}
              onClick={() => setShowPassword(!showPassword)}
              className="p-1 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          }
          value={value}
          onChange={onChange}
          {...props}
        />
        {showStrengthMeter && pwd.length > 0 && (
          <div className="pt-1 space-y-1">
            <div className="grid grid-cols-4 gap-1.5 h-1.5">
              <div
                className={`rounded-full transition-all duration-300 ${
                  strengthScore >= 1 ? 'bg-rose-500' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              />
              <div
                className={`rounded-full transition-all duration-300 ${
                  strengthScore >= 2 ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              />
              <div
                className={`rounded-full transition-all duration-300 ${
                  strengthScore >= 3 ? 'bg-indigo-500' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              />
              <div
                className={`rounded-full transition-all duration-300 ${
                  strengthScore >= 4 ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-slate-700'
                }`}
              />
            </div>
            <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
              <span>Must be 8+ chars (A-Z, a-z, 0-9)</span>
              <span className="font-medium">
                {strengthScore === 4
                  ? 'Strong'
                  : strengthScore >= 2
                  ? 'Moderate'
                  : 'Weak'}
              </span>
            </div>
          </div>
        )}
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';
