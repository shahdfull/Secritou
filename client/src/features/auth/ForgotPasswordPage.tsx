import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authApi } from "@/api/auth.api";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

const forgotPasswordSchema = z.object({
  email: z.string().email("auth.validEmail"),
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const { mutate: forgotPassword, isPending, isSuccess } = useMutation({
    mutationFn: async (email: string) => authApi.forgotPassword(email),
    onSuccess: () => {
      toast.success(t("auth.passwordResetLinkSent"));
    },
  });

  const { register, handleSubmit, formState: { errors } } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = (data: ForgotPasswordForm) => forgotPassword(data.email);

  if (isSuccess) {
    return (
      <section className="container-page grid min-h-[72vh] place-items-center py-16">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Secritou</p>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink">{t("auth.checkYourEmail")}</h1>
          <p className="mt-4 text-sm text-muted-foreground">{t("auth.passwordResetSent")}</p>
          <Link to="/login" className="mt-6 inline-block font-semibold text-primary hover:underline">
            {t("auth.backToLogin")}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="container-page grid min-h-[72vh] place-items-center py-16">
      <form className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-soft" onSubmit={handleSubmit(onSubmit)}>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Secritou</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink">{t("auth.resetPassword")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("auth.resetPasswordInstructions")}</p>
        <div className="mt-6 space-y-4">
          <div className="space-y-1">
            <Input placeholder={t("auth.email")} type="email" {...register("email")} disabled={isPending} />
            {errors.email && <p className="text-xs text-red-500">{t(errors.email.message || "auth.validEmail")}</p>}
          </div>
        </div>
        <Button className="mt-6 w-full rounded-full" type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t("auth.sending")}
            </>
          ) : (
            t("auth.sendResetLink")
          )}
        </Button>
        <div className="mt-6 text-center text-sm">
          {t("auth.rememberPassword")}{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            {t("auth.signIn")}
          </Link>
        </div>
      </form>
    </section>
  );
}
