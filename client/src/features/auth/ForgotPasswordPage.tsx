import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";
import { authApi } from "@/api/auth.api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const forgotPasswordSchema = z.object({
    email: z.string().email(t("auth.validEmail")),
  });
  type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

  const { mutate: forgotPassword, isPending, isSuccess } = useMutation({
    mutationFn: (email: string) => authApi.forgotPassword(email),
    onSuccess: () => toast.success(t("auth.passwordResetLinkSent")),
    onError: () => toast.error(t("auth.forgotPasswordFailed")),
  });

  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = (data: ForgotPasswordForm) => forgotPassword(data.email);

  return (
    <section className="container-page grid min-h-login-safe place-items-center py-16">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Secritou</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink">{t("auth.forgotPassword")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("auth.resetPasswordInstructions")}</p>

        {isSuccess ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
              {t("auth.passwordResetSent")}
            </div>
            <Link to="/login" className="inline-flex font-semibold text-primary hover:underline">
              {t("auth.backToLogin")}
            </Link>
          </div>
        ) : (
          <form className="mt-6 space-y-4" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-1">
              <label htmlFor="forgot-password-email" className="sr-only">{t("auth.email")}</label>
              <Input
                id="forgot-password-email"
                type="email"
                placeholder={t("auth.email")}
                aria-invalid={Boolean(errors.email)}
                aria-describedby={errors.email ? "forgot-password-email-error" : undefined}
                {...register("email")}
                disabled={isPending}
              />
              {errors.email && (
                <p id="forgot-password-email-error" role="alert" className="text-xs text-red-500">
                  {errors.email.message}
                </p>
              )}
            </div>

            <Button className="w-full rounded-full" type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("auth.sending")}
                </>
              ) : (
                t("auth.sendResetLink")
              )}
            </Button>

            <div className="text-center text-sm">
              <Link to="/login" className="font-semibold text-primary hover:underline">
                {t("auth.backToLogin")}
              </Link>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
