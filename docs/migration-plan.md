# Migration Plan

| Existing file | New destination | Refactoring required | Can be deleted? |
| --- | --- | --- | --- |
| `src/components/ui/*` | `client/src/components/ui/*` | Keep shadcn components; update utility imports only if needed. | No |
| `src/components/layout/*` | `client/src/components/layout/*` | Replace TanStack `Link` with React Router `Link`/`NavLink`; replace Lovable asset JSON import. | No |
| `src/components/sections/*` | `client/src/features/landing/components/*` | Move to landing feature module; update imports. | No |
| `src/components/dashboard/*` | `client/src/components/dashboard/*` | Retained as dashboard UI blocks. | No |
| `src/routes/index.tsx` | `client/src/features/landing/pages/HomePage.tsx` | Remove `createFileRoute`; export page component. | No |
| `src/routes/services.tsx` | `client/src/features/landing/pages/ServicesPage.tsx` | Remove TanStack route wrapper; export page component. | No |
| `src/routes/solutions.tsx` | `client/src/features/landing/pages/SolutionsPage.tsx` | Remove TanStack route wrapper; export page component. | No |
| `src/routes/case-studies.tsx` | `client/src/features/landing/pages/CaseStudiesPage.tsx` | Remove TanStack route wrapper; export page component. | No |
| `src/routes/contact.tsx` | `client/src/features/landing/pages/ContactPage.tsx` | Remove TanStack route wrapper; export page component. | No |
| `src/routes/__root.tsx` | `client/src/routes/AppRoutes.tsx` | Replaced by React Router layouts. | Yes |
| `src/routeTree.gen.ts` | None | Generated TanStack router artifact. | Yes |
| `src/router.tsx` | `client/src/routes/AppRoutes.tsx` | Replaced by BrowserRouter + route tree. | Yes |
| `src/start.ts` | None | TanStack Start server middleware no longer used. | Yes |
| `src/server.ts` | None | TanStack Start SSR entry no longer used. | Yes |
| `src/lib/lovable-error-reporting.ts` | None | Lovable runtime integration removed. | Yes |
| `src/lib/config.server.ts` | `server/src/config/env.ts` | Replaced by Express environment validation. | Yes |
| `src/lib/error.server.ts` | `server/src/middlewares/error.middleware.ts` | Replaced by centralized API error middleware. | Yes |
| `src/lib/error-page.ts` | None | SSR error page no longer required. | Yes |
| `src/lib/api/example.functions.ts` | `server/src/routes/*` | Replaced by REST API controllers/services. | Yes |
| `package.json` | `package.json`, `client/package.json`, `server/package.json`, `shared/package.json` | Split into workspaces; remove Lovable/TanStack Start deps. | No |
| `vite.config.js` | `client/vite.config.ts` | Replace Lovable config with Vite React + Tailwind plugin. | No |

## Checklist

- [x] Move frontend into `client/`.
- [x] Replace Lovable/TanStack Start routing.
- [x] Preserve Secritou landing UI sections.
- [x] Add feature-based frontend modules.
- [x] Add Express API with Clean Architecture layers.
- [x] Add JWT auth, refresh tokens, bcrypt and RBAC.
- [x] Add Zod validation and centralized error handling.
- [x] Add Prisma schema.
- [x] Add Docker support.
- [ ] Run database migration against a real PostgreSQL instance.
- [ ] Connect frontend auth forms to live API.
