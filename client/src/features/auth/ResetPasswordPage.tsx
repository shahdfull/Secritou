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

const resetPasswordSchema = z
  .object({
    newPassword: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type ResetPasswordForm = z.infer<typeof resetPasswordSchema>;

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const { mutate: resetPassword, isPending, isSuccess } = useMutation({
    mutationFn: async (newPassword: string) => {
      if (!token) throw new Error("Invalid reset token");
      return await authApi.resetPassword(token, newPassword);
    },
    onSuccess: () => {
      toast.success("Password reset successfully");
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordForm>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = (data: ResetPasswordForm) => {
    resetPassword(data.newPassword);
  };

  if (!token) {
    return (
      <section className="container-page grid min-h-[72vh] place-items-center py-16">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-soft text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Secritou
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink">Invalid reset link</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            This password reset link is invalid or has expired.
          </p>
          <Link
            to="/forgot-password"
            className="mt-6 inline-block text-primary font-semibold hover:underline"
          >
            Request a new reset link
          </Link>
        </div>
      </section>
    );
  }

  if (isSuccess) {
    return (
      <section className="container-page grid min-h-[72vh] place-items-center py-16">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-soft text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Secritou
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink">Password reset</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            Your password has been successfully reset.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-block text-primary font-semibold hover:underline"
          >
            Sign in with new password
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="container-page grid min-h-[72vh] place-items-center py-16">
      <form
        className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-soft"
        onSubmit={handleSubmit(onSubmit)}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Secritou
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink">Set new password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your new password.
        </p>

        <div className="mt-6 space-y-4">
          <div className="space-y-1">
            <Input
              placeholder="New password"
              type="password"
              {...register("newPassword")}
              disabled={isPending}
            />
            {errors.newPassword && (
              <p className="text-xs text-red-500">{errors.newPassword.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Input
              placeholder="Confirm password"
              type="password"
              {...register("confirmPassword")}
              disabled={isPending}
            />
            {errors.confirmPassword && (
              <p className="text-xs text-red-500">{errors.confirmPassword.message}</p>
            )}
          </div>
        </div>

        <Button className="mt-6 w-full rounded-full" type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Resetting...
            </>
          ) : (
            "Reset password"
          )}
        </Button>
      </form>
    </section>
  );
}
