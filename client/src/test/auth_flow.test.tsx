import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { LoginPage } from '../pages/auth/LoginPage.js';
import { RegisterPage } from '../pages/auth/RegisterPage.js';
import { AuthProvider } from '../context/AuthContext.js';
import { ToastProvider } from '../context/ToastContext.js';
import { ThemeProvider } from '../context/ThemeContext.js';

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>{ui}</AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

describe('Frontend Auth Pages', () => {
  describe('LoginPage', () => {
    it('renders login form inputs and buttons', () => {
      renderWithProviders(<LoginPage />);
      expect(screen.getByPlaceholderText(/alex or alex@example.com/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/••••••••/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
      expect(screen.getByText(/forgot password\?/i)).toBeInTheDocument();
    });
  });

  describe('RegisterPage', () => {
    it('renders registration fields including username and password strength', () => {
      renderWithProviders(<RegisterPage />);
      expect(screen.getByPlaceholderText(/e\.g\. Alex Painter/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/e\.g\. alex_draws/i)).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/alex@example.com/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
    });
  });
});
