// Must stay in sync client/server: LoginPage.tsx and auth.validator.ts both
// import this instead of hardcoding their own minimum, so the two can never drift.
export const PASSWORD_MIN_LENGTH = 8;
