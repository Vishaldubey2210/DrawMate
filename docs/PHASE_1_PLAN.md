# Phase 1 Implementation Plan — DrawMate Gaming SaaS Platform

## 1. Executive Summary & Audit Assessment
- **Workspace State:** Inspected `/home/vishal/Downloads/web3task`. The workspace was initialized with an empty directory.
- **Brand Identity:** **DrawMate** — a modern multiplayer drawing and guessing gaming SaaS platform with high visual polish, fluid micro-interactions, dark/light theme, and strict separation of concerns.
- **Phase Scope:** **Phase 1 ONLY**. Foundational architecture, authentication, user onboarding, player profile management, account settings, marketing website, and authenticated dashboard shell. Real-time game room drawing/sockets are intentionally decoupled and scheduled for subsequent phases.

---

## 2. Architecture & Tech Stack Decisions

### Frontend (`client/`)
- **Framework:** React 18 / 19 with TypeScript & Vite
- **Styling & Design System:** Tailwind CSS with custom design tokens, dark/light theme switcher (system-aware), Lucide React icons, and cohesive UI primitives:
  - `Button`, `Input`, `PasswordInput`, `FormField`, `Avatar`, `Badge`, `DropdownMenu`, `Modal`, `ConfirmDialog`, `Toast`, `PageHeader`, `ThemeToggle`, `EmptyState`, `LoadingSkeleton`
- **Routing:** React Router v6/v7 with public landing, auth routes (`/login`, `/register`, `/forgot-password`, `/reset-password`), onboarding flow (`/onboarding`), and protected layout (`/dashboard`, `/profile`, `/settings`, `/rooms` [coming soon])
- **Form & Validation:** React Hook Form with Zod schemas matching backend validation contracts
- **API Client:** Centralized Axios/fetch client with interceptors for credentials, error toast dispatch, and automatic session handling

### Backend (`server/`)
- **Runtime & Framework:** Node.js, Express.js with TypeScript (`tsx` / `tsc`)
- **Database & Modeling:** MongoDB with Mongoose
  - `User`: Display name, unique case-normalized username, unique normalized email, password hash (bcrypt), avatar preset / URL, bio, language, theme, notification preferences, privacy visibility, onboarding state, timestamps
  - `Session` / `RefreshToken`: Multi-session support, token hashes, revocation, IP & user-agent tracking
  - `PasswordResetToken`: Expiring (15-min) cryptographically secure single-use tokens
- **Security & Hardening:**
  - Password hashing with salt rounds (bcrypt)
  - HTTP-only, SameSite secure cookie management for refresh tokens and Bearer access token support
  - Rate limiting on authentication routes (`express-rate-limit`)
  - Helmet for security headers, CORS with strict origin validation
  - Sanitization against injection
  - Safe development mode fallback with `mongodb-memory-server` if external MongoDB instance is not locally reachable
- **Testing:** Jest / Supertest for backend unit/integration tests; Vitest / Testing Library for frontend component tests.

---

## 3. Product Vision & Feature Modules for Phase 1

### 3.1 Public Marketing Website
- Responsive top navbar with brand logo, nav links (Features, How to Play, FAQ), theme toggle, Login & Register CTAs
- High-impact Hero section with custom SVG game preview (drawing canvas mock, guess stream, player avatars)
- Interactive feature highlights, visual how-to-play step sequence, FAQ accordion, conversion CTA, and footer.

### 3.2 Authentication Flow
- `/register`: Display name, unique username, email, password strength meter, confirm password, terms check
- `/login`: Email/username + password, remember me, error handling with timing-safe responses
- `/forgot-password` & `/reset-password`: Cryptographically secure single-use token workflow with console/preview handler for dev environments
- `/logout`: Complete session revocation and cookie clearing

### 3.3 Onboarding Flow (`/onboarding`)
- 4-step wizard:
  1. **Identity:** Display name, username uniqueness live-check, bio
  2. **Preferences:** Theme (Light / Dark / System), interface language
  3. **Personalization:** 8 curated avatar presets with live preview
  4. **Welcome / Finish:** Transition to dashboard with `isOnboarded: true` persisted to MongoDB

### 3.4 Authenticated Shell & Dashboard
- Persistent responsive layout: collapsible sidebar, mobile drawer, topbar with user avatar menu and theme switcher
- Dashboard: Real user greeting, player stats overview (zero-states for games played, win rate, score), quick action entry points (Play/Rooms labeled with Phase 2 status), and getting-started checklist.

### 3.5 Detailed Player Profile
- Dedicated `/profile` route
- Editable display name, unique username (enforced with DB index and collision handling), avatar picker, bio with character limits
- Read-only account overview: registration date, email, verified status, privacy level
- Realistic game statistics zero-states prepared for Phase 2 integration

### 3.6 Account Settings
- `/settings` tabbed view:
  - **General:** Interface language, theme preference
  - **Notifications:** Account updates, game invites, marketing toggles
  - **Privacy:** Profile visibility (Public / Private)
  - **Security:** Password change with current password verification
  - **Danger Zone:** Account deletion with confirmation phrase typing and full session cascade

---

## 4. Phase 1 Acceptance Criteria & Verification Checklist
- [x] Workspace inspected and clean structure documented
- [x] Backend API with Express, Mongoose, Zod, and full Auth endpoints (Verified in tests/auth.test.ts)
- [x] Database schemas (`User`, `RefreshToken`, `PasswordResetToken`) with unique indexes
- [x] Frontend with Vite, React, TypeScript, Tailwind CSS, Lucide icons
- [x] Full design system with shared atomic components and dark/light modes (Verified in components.test.tsx)
- [x] Marketing landing page with hero, features, how to play, FAQ, footer
- [x] Functional registration, login, logout, password reset flows (Verified in auth_flow.test.tsx)
- [x] 4-step onboarding wizard persisting to database
- [x] Authenticated application layout with responsive navigation
- [x] Real dashboard displaying authentic user data and honest zero-states
- [x] Full profile editing (display name, username, bio, avatar) with error handling
- [x] Settings suite (General, Appearance, Notifications, Privacy, Security, Danger Zone)
- [x] Automated tests for backend API and frontend components (17 server + 10 client auth/UI tests)
- [x] Build, lint, and typecheck passes cleanly (0 errors)
- [x] Documentation complete (`README.md`, `docs/API.md`, `docs/ARCHITECTURE.md`, `.env.example`)
