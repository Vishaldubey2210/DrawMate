# DrawMate API Specification — Phase 1

All API routes are prefixed with `/api`. Responses adhere to a predictable JSON format.

---

## 1. Authentication Endpoints (`/api/auth`)

### `POST /api/auth/register`
Creates a new player account and initializes an active session.
- **Rate Limit:** 50 requests / 15 minutes
- **Request Body:**
  ```json
  {
    "displayName": "Alex Painter",
    "username": "alexpainter",
    "email": "alex@example.com",
    "password": "Password123!",
    "confirmPassword": "Password123!"
  }
  ```
- **Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Registration successful.",
    "user": { ...safeUserObject },
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi..."
  }
  ```

### `POST /api/auth/login`
Authenticates a user via email or username.
- **Rate Limit:** 50 requests / 15 minutes
- **Request Body:**
  ```json
  {
    "identifier": "alex@example.com",
    "password": "Password123!"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Login successful.",
    "user": { ...safeUserObject },
    "accessToken": "eyJhbGciOi...",
    "refreshToken": "eyJhbGciOi..."
  }
  ```

### `POST /api/auth/logout`
Revokes the refresh token and clears HTTP-only authentication cookies.
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Logged out successfully."
  }
  ```

### `POST /api/auth/refresh`
Refreshes the expired access token using the HTTP-only refresh cookie or request body.
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "accessToken": "eyJhbGciOi...",
    "user": { ...safeUserObject }
  }
  ```

### `GET /api/auth/me`
Retrieves the currently authenticated user's profile and preferences.
- **Headers:** `Authorization: Bearer <accessToken>` or session cookie
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "user": { ...safeUserObject }
  }
  ```

### `POST /api/auth/forgot-password`
Generates an expiring (15-min) single-use reset token.
- **Request Body:**
  ```json
  {
    "email": "alex@example.com"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "If an account matches that email, a password reset link has been dispatched."
  }
  ```

### `POST /api/auth/reset-password`
Validates the single-use token and replaces the password hash.
- **Request Body:**
  ```json
  {
    "token": "675c00d4ba66...",
    "newPassword": "NewPassword456!",
    "confirmPassword": "NewPassword456!"
  }
  ```
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Password has been successfully updated. You may now log in."
  }
  ```

---

## 2. Profile Endpoints (`/api/profile`)

### `GET /api/profile/me`
Retrieves full profile for the authenticated user.
- **Requires Auth:** Yes

### `PATCH /api/profile/me`
Updates editable profile fields.
- **Requires Auth:** Yes
- **Request Body:**
  ```json
  {
    "displayName": "Alex Master",
    "bio": "Competitive skribbler",
    "avatar": "avatar-4",
    "preferredLanguage": "en",
    "theme": "dark",
    "isOnboarded": true
  }
  ```

### `PATCH /api/profile/username`
Updates unique username with database collision protection.
- **Requires Auth:** Yes
- **Request Body:**
  ```json
  {
    "username": "alex_sketches"
  }
  ```

### `GET /api/profile/check-username?username=...`
Query endpoint for live availability feedback during registration or editing.
- **Response (200 OK):**
  ```json
  {
    "success": true,
    "available": true,
    "message": "Username is available!"
  }
  ```

### `GET /api/profile/:username`
Retrieves public profile details respecting the user's `profileVisibility` setting.

---

## 3. Settings Endpoints (`/api/settings`)

### `GET /api/settings`
Returns current settings, notification toggles, and privacy configurations.
- **Requires Auth:** Yes

### `PATCH /api/settings/preferences`
Updates theme and interface language.
- **Requires Auth:** Yes

### `PATCH /api/settings/notifications`
Updates notification preferences.
- **Requires Auth:** Yes
- **Request Body:**
  ```json
  {
    "productUpdates": true,
    "gameInvites": false,
    "emailNotifications": true
  }
  ```

### `PATCH /api/settings/privacy`
Updates profile visibility between `"public"` and `"private"`.
- **Requires Auth:** Yes

### `POST /api/settings/change-password`
Verifies current password and securely updates to new password hash.
- **Requires Auth:** Yes

### `DELETE /api/settings/account`
Destructive account removal requiring password and typing confirmation phrase `"delete my account"`.
- **Requires Auth:** Yes
