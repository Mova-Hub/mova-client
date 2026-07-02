// src/api/auth.ts
import apiService, { type ApiResult, ApiError } from "./apiService"

const USER_KEY = "user"

function hasWindow() {
  return typeof window !== "undefined"
}

const storage = {
  getUserRaw(): string | null {
    if (!hasWindow()) return null
    try {
      return window.localStorage.getItem(USER_KEY)
    } catch {
      return null
    }
  },
  setUserRaw(value: string) {
    if (!hasWindow()) return
    try {
      window.localStorage.setItem(USER_KEY, value)
    } catch {}
  },
  removeUser() {
    if (!hasWindow()) return
    try {
      window.localStorage.removeItem(USER_KEY)
    } catch {}
  },
}

export type Credentials = {
  email?: string
  password: string
}

export type LoginResponse<TUser = unknown> = {
  token?: string
  access_token?: string
  user?: TUser
}

export type MeResponse<TUser = unknown> = {
  user?: TUser | null
}

type ChangePasswordBody = {
  currentPassword: string
  newPassword: string
}

type TwoFAPayload = { enabled: boolean }

type UploadAvatarResult = { url?: string }

// Small helper: try PUT, fallback to PATCH if API uses that.
async function putOrPatch<T = unknown, B = unknown>(
  url: string,
  body: B
): Promise<ApiResult<T>> {
  try {
    return await apiService.put<T, B>(url, body)
  } catch (e: any) {
    if (e instanceof ApiError && (e.status === 405 || e.status === 404)) {
      // Method/route not allowed — try PATCH
      return await apiService.patch<T, B>(url, body)
    }
    throw e
  }
}

const auth = {
  /* ------------------------- user cache ------------------------- */
  getUser<TUser = unknown>(): TUser | null {
    const raw = storage.getUserRaw()
    if (!raw) return null
    try {
      return JSON.parse(raw) as TUser
    } catch {
      return null
    }
  },

  setUser<TUser = unknown>(user: TUser | null) {
    if (user == null) {
      storage.removeUser()
      return
    }
    try {
      storage.setUserRaw(JSON.stringify(user))
    } catch {}
  },

  /** Merge a partial update into the cached user. */
  mergeAndCacheUser<TUser extends Record<string, any> = any>(partial: Partial<TUser>) {
    const current = (this.getUser<TUser>() ?? {}) as TUser
    const next = { ...current, ...partial }
    this.setUser<TUser>(next)
    return next
  },

  /* ------------------------- auth core -------------------------- */
  async login<TUser = unknown>(
    credentials: Credentials,
    path: "/auth/login" | "/login" = "/auth/login"
  ): Promise<ApiResult<LoginResponse<TUser>>> {
    const res = await apiService.post<LoginResponse<TUser>, Credentials>(path, credentials)
    const token = res.data.token ?? res.data.access_token
    if (!token) {
      throw new ApiError(res.status, "Aucun jeton d'authentification retourné par l'API.")
    }
    apiService.setToken(token)
    if (res.data.user) auth.setUser<TUser>(res.data.user)
    return res
  },

  async refreshToken(path: "/auth/refresh" | "/refresh" = "/auth/refresh") {
    const res = await apiService.post<LoginResponse>(path)
    const token = res.data.token ?? res.data.access_token
    if (!token) throw new ApiError(res.status, "Impossible d’actualiser le jeton.")
    apiService.setToken(token)
    // Some backends also return user here:
    if (res.data.user) auth.setUser(res.data.user)
    return res
  },

  async logout(path: "/auth/logout" | "/logout" = "/auth/logout") {
    const hadToken = !!apiService.getToken?.()
    try {
      if (hadToken) {
        await apiService.post(path)
      }
    } catch (e) {
      if (e instanceof ApiError && (e.status === 401 || e.status === 419)) {
        // already invalid → ignore
      }
    } finally {
      apiService.removeToken()
      auth.setUser(null) // clear cached user
    }
    return { success: true, data: null, status: 204 } as ApiResult<null>
  },

  /**
   * Fetch current user. Accepts { user: {...} } or raw user object.
   * Never clears the token here; let the caller decide (e.g. only on 401).
   */
  async fetchUser<TUser = unknown>(
    path: "/auth/me" | "/user" = "/auth/me"
  ): Promise<TUser | null> {
    const res = await apiService.get<any>(path)
    const data = res.data

    let user: TUser | null = null
    if (data && typeof data === "object") {
      if ("user" in data) {
        user = (data.user ?? null) as TUser | null
      } else if ("id" in data || "name" in data || "email" in data) {
        user = data as TUser
      }
    }
    auth.setUser(user)
    return user
  },

  /* ---------------------- account handlers ---------------------- */

  /**
   * Update profile fields (name, phone, role, avatarUrl, etc.).
   * Tries PUT /me then falls back to PATCH /me for APIs that prefer PATCH.
   */
  async updateProfile<TUser = any>(
    body: Record<string, unknown>,
    path: "/me" | "/auth/me" = "/me"
  ) {
    const res = await putOrPatch<TUser, typeof body>(path, body)
    // If API returns the fresh user, cache it; otherwise merge partial.
    const returned = res.data as any
    if (returned && (returned.id || returned.email || returned.name)) {
      auth.setUser(returned)
    } else {
      auth.mergeAndCacheUser(body as any)
    }
    return res
  },

  /** Preferences (language, timezone, currency, dateFormat, …). */
  async updatePrefs(
    body: Record<string, unknown>,
    path: "/me/prefs" | "/settings/prefs" = "/me/prefs"
  ) {
    return await putOrPatch(path, body)
  },

  /** Notification channels toggles. */
  async updateNotifications(
    body: Record<string, unknown>,
    path: "/me/notifications" | "/settings/notifications" = "/me/notifications"
  ) {
    return await putOrPatch(path, body)
  },

  /** Change password. */
  async changePassword(
    body: ChangePasswordBody,
    path: "/me/change-password" | "/auth/password" | "/auth/change-password" = "/me/change-password"
  ) {
    return await apiService.post(path, {
      current_password: body.currentPassword,
      new_password: body.newPassword,
    })
  },

  /** 2FA toggle. */
  async setTwoFA(
    body: TwoFAPayload,
    path: "/me/2fa" | "/auth/2fa" | "/auth/toggle-2fa" = "/me/2fa"
  ) {
    return await putOrPatch(path, body)
  },

  /** Verify current user's password without changing it. Returns true if correct. */
  async verifyPassword(password: string): Promise<boolean> {
    try {
      const res = await apiService.post<{ valid: boolean }>("/auth/verify-password", { password })
      return res.data?.valid === true
    } catch {
      return false
    }
  },

  /** Upload avatar; expects a FormData with key "avatar". */
  async uploadAvatar(
    formData: FormData,
    path: "/me/avatar" | "/upload/avatar" = "/me/avatar"
  ): Promise<ApiResult<UploadAvatarResult>> {
    // NOTE: do NOT set Content-Type; browser will set proper multipart boundary.
    const res = await apiService.post<UploadAvatarResult, FormData>(path, formData)
    // If backend returns an URL, merge it into cached user.
    const url = res.data?.url
    if (url) auth.mergeAndCacheUser({ avatarUrl: url })
    return res
  },
}

export default auth
