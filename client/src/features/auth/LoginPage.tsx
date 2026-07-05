import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { useLogin, getRedirectPathForRole } from "@/hooks/useAuth";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export function LoginPage() {
  const { t } = useTranslation();
  const loginSchema = z.object({
    email: z.string().email(t("auth.validEmail")),
    password: z.string().min(6, t("auth.passwordMinLength")),
  });
  type LoginForm = z.infer<typeof loginSchema>;
  const { mutate: login, isPending } = useLogin();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const raw = searchParams.get("redirect");
  const redirectTo = raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : null;
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = (data: LoginForm) => {
    login(data, {
      onSuccess: (response) =>
        navigate(redirectTo ?? getRedirectPathForRole(response.user.role)),
    });
  };

  return (
    <section className="container-page grid min-h-[72vh] place-items-center py-16">
      <form className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-soft" onSubmit={handleSubmit(onSubmit)}>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Secritou</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink">{t("auth.signIn")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("auth.accessWorkspace")}</p>
        <div className="mt-6 space-y-4">
          <div className="space-y-1">
            <Input placeholder={t("auth.email")} type="email" {...register("email")} disabled={isPending} />
            {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
          </div>
          <div className="space-y-1">
            <PasswordInput placeholder={t("auth.password")} {...register("password")} disabled={isPending} />
            {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
          </div>
        </div>
        <div className="text-right text-sm">
          <Link to="/forgot-password" className="font-semibold text-primary hover:underline">{t("auth.forgotPassword")}</Link>
        </div>
        <Button className="mt-6 w-full rounded-full" type="submit" disabled={isPending}>
          {isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("auth.signingIn")}</>) : t("auth.signIn")}
        </Button>
      </form>
    </section>
  );
}
