import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authApi } from "@/api/auth.api";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export function ResetPasswordPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const resetPasswordSchema = z.object({
    newPassword: z.string().min(8, t("auth.passwordMinLength")),
    confirmPassword: z.string(),
  }).refine((data) => data.newPassword === data.confirmPassword, { message: t("auth.passwordMismatch"), path: ["confirmPassword"] });
  type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;
  const { mutate: resetPassword, isPending, isSuccess } = useMutation({
    mutationFn: async (newPassword: string) => {
      if (!token) throw new Error("Invalid reset token");
      return authApi.resetPassword(token, newPassword);
    },
    onSuccess: () => toast.success(t("auth.passwordResetSuccess")),
  });
  const { register, handleSubmit, formState: { errors } } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: "", confirmPassword: "" },
  });
  const onSubmit = (data: ResetPasswordForm) => resetPassword(data.newPassword);

  if (!token) return (
    <section className="container-page grid min-h-[72vh] place-items-center py-16">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Secritou</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink">{t("auth.invalidResetLink")}</h1>
        <p className="mt-4 text-sm text-muted-foreground">{t("auth.invalidResetLinkDesc")}</p>
        <Link to="/forgot-password" className="mt-6 inline-block font-semibold text-primary hover:underline">
          {t("auth.requestNewResetLink")}
        </Link>
      </div>
    </section>
  );

  if (isSuccess) return (
    <section className="container-page grid min-h-[72vh] place-items-center py-16">
      <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 text-center shadow-soft">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Secritou</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink">{t("auth.passwordReset")}</h1>
        <p className="mt-4 text-sm text-muted-foreground">{t("auth.passwordResetDone")}</p>
        <Link to="/login" className="mt-6 inline-block font-semibold text-primary hover:underline">
          {t("auth.signInWithNewPassword")}
        </Link>
      </div>
    </section>
  );

  return (
    <section className="container-page grid min-h-[72vh] place-items-center py-16">
      <form className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-soft" onSubmit={handleSubmit(onSubmit)}>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Secritou</p>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink">{t("auth.setNewPassword")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("auth.setNewPasswordInstructions")}</p>
        <div className="mt-6 space-y-4">
          <div className="space-y-1">
            <Input placeholder={t("auth.newPassword")} type="password" {...register("newPassword")} disabled={isPending} />
            {errors.newPassword && <p className="text-xs text-red-500">{errors.newPassword.message}</p>}
          </div>
          <div className="space-y-1">
            <Input placeholder={t("auth.confirmPassword")} type="password" {...register("confirmPassword")} disabled={isPending} />
            {errors.confirmPassword && <p className="text-xs text-red-500">{errors.confirmPassword.message}</p>}
          </div>
        </div>
        <Button className="mt-6 w-full rounded-full" type="submit" disabled={isPending}>
          {isPending ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("auth.resetting")}</>) : t("auth.resetPassword")}
        </Button>
      </form>
    </section>
  );
}
