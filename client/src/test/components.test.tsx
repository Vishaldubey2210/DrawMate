import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '../components/ui/Button.js';
import { Input } from '../components/ui/Input.js';
import { PasswordInput } from '../components/ui/PasswordInput.js';
import { Badge } from '../components/ui/Badge.js';
import { Avatar } from '../components/ui/Avatar.js';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.js';

describe('Design System UI Components', () => {
  describe('Button', () => {
    it('renders with label and fires onClick', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click Me</Button>);
      const btn = screen.getByRole('button', { name: /click me/i });
      expect(btn).toBeInTheDocument();
      fireEvent.click(btn);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('shows loading state and disables button', () => {
      render(<Button isLoading>Submit</Button>);
      const btn = screen.getByRole('button');
      expect(btn).toBeDisabled();
    });
  });

  describe('Input', () => {
    it('renders label and handles typing', () => {
      render(<Input label="Username" placeholder="Enter username" />);
      const input = screen.getByPlaceholderText(/enter username/i);
      expect(screen.getByText('Username')).toBeInTheDocument();
      fireEvent.change(input, { target: { value: 'cool_painter' } });
      expect((input as HTMLInputElement).value).toBe('cool_painter');
    });

    it('renders error message', () => {
      render(<Input error="Field is required" />);
      expect(screen.getByText('Field is required')).toBeInTheDocument();
    });
  });

  describe('PasswordInput', () => {
    it('toggles password visibility', () => {
      render(<PasswordInput placeholder="Enter password" />);
      const input = screen.getByPlaceholderText('Enter password');
      expect(input).toHaveAttribute('type', 'password');

      const toggleBtn = screen.getByRole('button');
      fireEvent.click(toggleBtn);
      expect(input).toHaveAttribute('type', 'text');
    });
  });

  describe('Avatar', () => {
    it('renders avatar preset without crashing', () => {
      render(<Avatar avatarId="avatar-2" name="Neon Doodler" />);
      expect(screen.getByTitle('Neon Doodler')).toBeInTheDocument();
    });
  });

  describe('Badge', () => {
    it('renders badge children with variant classes', () => {
      render(<Badge variant="brand">Level 5</Badge>);
      expect(screen.getByText('Level 5')).toBeInTheDocument();
    });
  });

  describe('ConfirmDialog', () => {
    it('requires confirmation phrase before enabling confirm button', () => {
      const handleConfirm = vi.fn();
      render(
        <ConfirmDialog
          isOpen={true}
          onClose={() => {}}
          onConfirm={handleConfirm}
          title="Delete Profile"
          message="Are you sure?"
          requiredPhrase="delete my account"
        />
      );

      const confirmBtn = screen.getByRole('button', { name: /confirm/i });
      expect(confirmBtn).toBeDisabled();

      const phraseInput = screen.getByPlaceholderText('delete my account');
      fireEvent.change(phraseInput, { target: { value: 'delete my account' } });
      expect(confirmBtn).not.toBeDisabled();

      fireEvent.click(confirmBtn);
      expect(handleConfirm).toHaveBeenCalledTimes(1);
    });
  });
});
