# Diagrammes de Flux d'Authentification

## 1. Bootstrap Session (Démarrage App)

```
┌─────────────────────────────────────────────────────────────────┐
│ App.tsx renders                                                 │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ <AppContent>                                                    │
│   └─ useBootstrapSession() called                               │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
        ┌──────────────────────────────────────┐
        │ useQuery({                           │
        │   queryKey: ["auth.bootstrap"],      │
        │   enabled: !bootstrapped,            │
        │ })                                   │
        └──────────────┬───────────────────────┘
                       │
         ┌─────────────┴─────────────┐
         │                           │
         ▼                           ▼
    ┌─────────────────┐        ┌─────────────────────┐
    │ First Load?     │        │ Returning User?     │
    │ No Cookie       │        │ Has Refresh Cookie  │
    └────────┬────────┘        └──────────┬──────────┘
             │                            │
             ▼                            ▼
    ┌──────────────────────┐     ┌────────────────────────┐
    │ POST /auth/refresh   │     │ POST /auth/refresh     │
    │ (no cookie)          │     │ (with HTTP-only cookie)│
    │ Response: 401        │     │ Response: 200 OK       │
    └────────┬─────────────┘     └──────────┬─────────────┘
             │                              │
             ▼                              ▼
    ┌──────────────────────┐     ┌────────────────────────┐
    │ query.isError = true │     │ query.isSuccess = true │
    └────────┬─────────────┘     └──────────┬─────────────┘
             │                              │
             ▼                              ▼
    ┌──────────────────────┐     ┌────────────────────────┐
    │ useEffect: run       │     │ useEffect: run         │
    │ setUnauthenticated() │     │ setSession(user, token)│
    │ markBootstrapped()   │     │ markBootstrapped()     │
    └────────┬─────────────┘     └──────────┬─────────────┘
             │                              │
             ▼                              ▼
    ┌──────────────────────┐     ┌────────────────────────┐
    │ status = "unauth"    │     │ status = "authenticated"│
    │ bootstrapped = true  │     │ bootstrapped = true     │
    └────────┬─────────────┘     └──────────┬─────────────┘
             │                              │
             ▼                              ▼
    ┌──────────────────────┐     ┌────────────────────────┐
    │ ProtectedRoute:      │     │ ProtectedRoute:        │
    │ <Navigate to=/login >│     │ render(children)       │
    └──────────────────────┘     └────────────────────────┘
```

---

## 2. Login Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ <LoginPage>                                                     │
│   └─ const login = useLogin()                                   │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ User enters email + password                                    │
│ Clicks "Sign In"                                                │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ login.mutate({ email, password })                               │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│ Mutation Fn: authApi.login(credentials)                         │
│   └─ POST /auth/login { email, password }                       │
└──────────────────────┬──────────────────────────────────────────┘
                       │
         ┌─────────────┴──────────────┐
         │                            │
         ▼                            ▼
    ┌──────────────────┐        ┌────────────────────┐
    │ 200 OK           │        │ 401 Invalid        │
    │ { user, tokens } │        │ Credentials        │
    └────────┬─────────┘        └────────┬───────────┘
             │                           │
             ▼                           ▼
    ┌──────────────────┐        ┌────────────────────┐
    │ onSuccess:       │        │ onError:           │
    │ setSession()     │        │ toast.error()      │
    │ queryClient      │        │ Stay on login page │
    │  .setQueryData   │        │                    │
    │ toast.success()  │        └────────────────────┘
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────┐
    │ user state:      │
    │ { user, token }  │
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────┐
    │ Navigate to      │
    │ /app (or /client)│
    │ based on role    │
    └──────────────────┘
```

---

## 3. Token Expiry + Refresh Flow

```
┌──────────────────────────────────────────────────────────────────┐
│ Component: <FreelancersPage>                                    │
│   useQuery({                                                    │
│     queryKey: ["freelancers"],                                  │
│     queryFn: () => api.get("/freelancers")                      │
│   })                                                            │
└────────────────────────┬─────────────────────────────────────────┘
                         │
                         ▼
          ┌──────────────────────────────────┐
          │ GET /freelancers                 │
          │ Authorization: Bearer <OLD_TOKEN>│
          │ (accessToken expired 2 hours ago)│
          └──────────────┬───────────────────┘
                         │
                         ▼
          ┌──────────────────────────────────┐
          │ Server Response: 401 Unauthorized│
          │ {                                │
          │   "message": "Token expired"     │
          │ }                                │
          └──────────────┬───────────────────┘
                         │
                         ▼
    ┌─────────────────────────────────────────────────────────────┐
    │ Axios Response Interceptor                                  │
    │   error.response.status === 401?                            │
    │   ✓ YES                                                     │
    └────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
    ┌─────────────────────────────────────────────────────────────┐
    │ Is it /auth/refresh? /auth/login? /auth/register?          │
    │   ✗ NO (it's GET /freelancers)                              │
    │                                                             │
    │ Already retried (_retry flag)?                              │
    │   ✗ NO (first time)                                         │
    │                                                             │
    │ ✓ Proceed with refresh                                      │
    └────────────────┬────────────────────────────────────────────┘
                     │
                     ▼
    ┌─────────────────────────────────────────────────────────────┐
    │ Check refreshState.isRefreshing?                            │
    │   ✗ NO (first request hitting 401)                          │
    │                                                             │
    │ ✓ Start singleton refresh                                   │
    └────────────────┬────────────────────────────────────────────┘
                     │
          ┌──────────┴──────────┐
          │                     │
          ▼                     ▼
    ┌──────────────────┐  ┌─────────────────┐
    │ isRefreshing = true
    │ Start 10s timeout │  │ refreshPromise  │
    │ Attach listeners  │  │ = pending       │
    └──────────┬───────┘  └────────┬────────┘
               │                   │
               └─────┬─────────────┘
                     │
                     ▼
          ┌──────────────────────────────────┐
          │ POST /auth/refresh               │
          │ (with HTTP-only cookie)          │
          │ No Authorization header          │
          └──────────────┬───────────────────┘
                         │
          ┌──────────────┴──────────────┐
          │                             │
          ▼                             ▼
    ┌──────────────────┐        ┌────────────────────┐
    │ 200 OK           │        │ 401 Unauthorized   │
    │ { accessToken,   │        │ (cookie invalid)   │
    │   user }         │        │                    │
    └────────┬─────────┘        └────────┬───────────┘
             │                           │
             ▼                           ▼
    ┌──────────────────┐        ┌────────────────────┐
    │ Clear timeout    │        │ Clear timeout      │
    │ setSession()     │        │ processQueue(err)  │
    │ processQueue()   │        │ logout()           │
    │ Resolve all      │        │ Reject all queued  │
    │ pending requests │        │ Redirect to /login │
    └────────┬─────────┘        └────────┬───────────┘
             │                           │
             ▼                           ▼
    ┌──────────────────┐        ┌────────────────────┐
    │ SET:             │        │ SET:               │
    │ accessToken =    │        │ accessToken = null │
    │  NEW_TOKEN       │        │ user = null        │
    │ user = userData  │        │ status = unauth    │
    │ isRefreshing =   │        │ isRefreshing = false│
    │  false           │        │ bootstrapped = true│
    └────────┬─────────┘        └────────┬───────────┘
             │                           │
             ▼                           ▼
    ┌──────────────────┐        ┌────────────────────┐
    │ Retry original   │        │ All queued requests│
    │ GET /freelancers │        │ REJECTED with 401  │
    │ Authorization:   │        │                    │
    │  Bearer <NEW_...>│        └────────────────────┘
    └────────┬─────────┘
             │
             ▼
    ┌──────────────────┐
    │ 200 OK           │
    │ (with new token) │
    │ ✓ Success        │
    └──────────────────┘
```

---

## 4. Multiple Simultaneous Requests (Token Expired)

```
┌─────────────────────────────────────────────────────────────────┐
│ <Dashboard>                                                     │
│   Query 1: useQuery(["freelancers"], () => api.get(...))       │
│   Query 2: useQuery(["missions"], () => api.get(...))          │
│   Query 3: useQuery(["tasks"], () => api.get(...))             │
└──────┬──────────────────┬──────────────────┬────────────────────┘
       │                  │                  │
       ▼                  ▼                  ▼
    GET /api/freelancers  GET /api/missions  GET /api/tasks
    Bearer OLD_TOKEN      Bearer OLD_TOKEN   Bearer OLD_TOKEN
       │                  │                  │
       └──────────────────┼──────────────────┘
                          │
                    ┌─────▼─────┐
                    │ All get   │
                    │ 401       │
                    │ Expired   │
                    └─────┬─────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
    Request 1        Request 2        Request 3
    Interceptor       Interceptor       Interceptor
        │                 │                 │
        │                 │                 │
        ▼                 ▼                 ▼
    Check: isRefresh?  Check: isRefresh?  Check: isRefresh?
    ✗ NO               ✓ YES               ✓ YES
    ✓ Start Refresh    Queue request      Queue request
        │                 │                 │
        │                 ▼                 ▼
        │            waitFor(refreshPromise)
        │                 │                 │
        ▼                 │                 │
    POST /auth/refresh    │                 │
    (singleton)           │                 │
        │                 │                 │
        ├─────────────────┼─────────────────┤
        │                 │                 │
        ▼                 ▼                 ▼
    Promise pending   Promise pending   Promise pending
    (waiting)         (waiting)         (waiting)
        │                 │                 │
        │   ┌─────────────┴─────────────┐   │
        │   │                           │   │
        ▼   ▼                           ▼   ▼
      Response: 200 OK
      New accessToken
      clearTimeout()
      processQueue(null, newToken)
        │
        └─────┬─────────────────────┐
              │                     │
              ▼                     ▼
          Resolve all pending     ✓ New accessToken
          Request 2 & 3           ✓ Set to store
              │
              ▼
          Retry all 3 requests
          GET /freelancers (new token)  ✓ 200
          GET /missions    (new token)  ✓ 200
          GET /tasks       (new token)  ✓ 200
              │
              └─────────────────────────┐
                                        │
                                    Result:
                                    1 refresh request
                                    3 successful retries
                                    TOTAL: 4 requests (optimal)
```

---

## 5. Logout Flow

```
┌──────────────────────────────────────────────────────────────────┐
│ <SettingsPage>                                                  │
│   └─ const logout = useLogout()                                  │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│ User clicks "Sign Out" button                                   │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│ logout.mutate()                                                  │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│ Mutation Fn: authApi.logout()                                    │
│   └─ POST /auth/logout                                           │
└────────────────────┬───────────────────────────────────────────┘
                     │
         ┌───────────┴───────────┐
         │                       │
         ▼                       ▼
    ┌─────────────┐         ┌─────────────┐
    │ 200 OK      │         │ Error       │
    │ { message } │         │ (still ok)  │
    └─────┬───────┘         └──────┬──────┘
          │                        │
          └────────────┬───────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │ onSuccess / onError:             │
        │ (runs regardless)                │
        └──────────────┬───────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │ 1. logoutStore()                 │
        │    ├─ user = null                │
        │    ├─ accessToken = null         │
        │    └─ status = "unauthenticated" │
        └──────────────┬───────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │ 2. queryClient.clear()           │
        │    ├─ Clear all cache            │
        │    └─ Invalidate all queries     │
        └──────────────┬───────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │ 3. toast.success()               │
        │    └─ "Logged out successfully"  │
        └──────────────┬───────────────────┘
                       │
                       ▼
        ┌──────────────────────────────────┐
        │ 4. React Router navigate         │
        │    └─ <Navigate to="/login" />   │
        └──────────────────────────────────┘
```

---

## 6. Password Reset Flow

```
┌──────────────────────────────────────────────────────────────────┐
│ <ForgotPasswordPage>                                             │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│ User enters email address                                       │
│ Clicks "Send Reset Link"                                        │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     ▼
┌──────────────────────────────────────────────────────────────────┐
│ POST /auth/forgot-password { email }                             │
│                                                                  │
│ ⚠️ Note: May rate-limited by server                              │
│ (typically 5 requests per 15 minutes)                            │
└────────────────────┬───────────────────────────────────────────┘
                     │
         ┌───────────┴──────────┐
         │                      │
         ▼                      ▼
    ┌─────────────┐        ┌──────────────┐
    │ 200 OK      │        │ 429 Too Many │
    │             │        │ Requests     │
    └─────┬───────┘        └──────┬───────┘
          │                       │
          ▼                       ▼
    ┌──────────────────┐  ┌────────────────────┐
    │ Email sent       │  │ toast.error()      │
    │ to user's inbox  │  │ "Too many requests"│
    │ + link + token   │  │ Wait before retry  │
    └──────────────────┘  └────────────────────┘
          │
          ▼
    User clicks link
    Redirected to
    /reset-password?token=XXX
          │
          ▼
    <ResetPasswordPage>
    User enters new password
          │
          ▼
    POST /auth/reset-password
    { token, newPassword }
          │
          ▼
    200 OK / 400 Invalid token
          │
          ▼
    Success → redirect /login
    Error → show error message
```

---

## 7. Redux DevTools (if enabled)

```
┌──────────────────────────────────────────────────────────────────┐
│ Redux DevTools Timeline                                          │
└──────────────────────────────────────────────────────────────────┘

Time │ Action                          │ State
─────┼─────────────────────────────────┼──────────────────────────────
  1  │ App mount                       │ status: "unknown"
     │                                 │ bootstrapped: false
─────┼─────────────────────────────────┼──────────────────────────────
  2  │ useBootstrapSession query       │ (no state change)
     │ POST /auth/refresh (pending)    │
─────┼─────────────────────────────────┼──────────────────────────────
  3  │ query.isSuccess = true          │ (useEffect runs)
     │                                 │
─────┼─────────────────────────────────┼──────────────────────────────
  4  │ setSession()                    │ user: { id, name, ... }
     │                                 │ accessToken: "ey..."
     │                                 │ status: "authenticated"
     │                                 │ bootstrapped: false
─────┼─────────────────────────────────┼──────────────────────────────
  5  │ markBootstrapped()              │ bootstrapped: true
     │                                 │
─────┼─────────────────────────────────┼──────────────────────────────
  6  │ ProtectedRoute renders          │ (no state change)
     │ Navigate to /app                │
─────┼─────────────────────────────────┼──────────────────────────────
  7  │ GET /api/data (401)             │ (no state change)
     │ Start refresh                   │
─────┼─────────────────────────────────┼──────────────────────────────
  8  │ POST /auth/refresh (200)        │ (no state change yet)
     │                                 │
─────┼─────────────────────────────────┼──────────────────────────────
  9  │ setSession() (from interceptor) │ accessToken: "new_token..."
     │                                 │ user: { ... }
─────┼─────────────────────────────────┼──────────────────────────────
 10  │ Retry GET /api/data (200)       │ (no state change)
─────┼─────────────────────────────────┼──────────────────────────────
```
