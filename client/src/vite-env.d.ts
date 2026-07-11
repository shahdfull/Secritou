/// <reference types="vite/client" />

// Side-effect CSS entry points of the self-hosted variable fonts.
declare module "@fontsource-variable/inter";
declare module "@fontsource-variable/plus-jakarta-sans";

interface Window {
	gtag?: (...args: unknown[]) => void;
	posthog?: {
		capture: (...args: unknown[]) => void;
	};
}
