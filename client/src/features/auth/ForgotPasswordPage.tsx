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

const forgotPasswordSchema = z.object({
  email: z.string().email("Please enter a valid email"),
});

type ForgotPasswordForm = z.infer<typeof forgotPasswordSchema>;

export function ForgotPasswordPage() {
  const { mutate: forgotPassword, isPending, isSuccess } = useMutation({
    mutationFn: async (email: string) => {
      return await authApi.forgotPassword(email);
    },
    onSuccess: () => {
      toast.success("Password reset link sent to your email");
    },
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordForm>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const onSubmit = (data: ForgotPasswordForm) => {
    forgotPassword(data.email);
  };

  if (isSuccess) {
    return (
      <section className="container-page grid min-h-[72vh] place-items-center py-16">
        <div className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-soft text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            Secritou
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink">Check your email</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            If an account exists for that email, we've sent a link to reset your password.
          </p>
          <Link
            to="/login"
            className="mt-6 inline-block text-primary font-semibold hover:underline"
          >
            Back to login
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
        <h1 className="mt-2 font-display text-3xl font-bold text-ink">Reset password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your email and we'll send you a link to reset your password.
        </p>

        <div className="mt-6 space-y-4">
          <div className="space-y-1">
            <Input
              placeholder="Email"
              type="email"
              {...register("email")}
              disabled={isPending}
            />
            {errors.email && (
              <p className="text-xs text-red-500">{errors.email.message}</p>
            )}
          </div>
        </div>

        <Button className="mt-6 w-full rounded-full" type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Sending...
            </>
          ) : (
            "Send reset link"
          )}
        </Button>

        <div className="mt-6 text-center text-sm">
          Remember your password?{" "}
          <Link to="/login" className="text-primary font-semibold hover:underline">
            Sign in
          </Link>
        </div>
      </form>
    </section>
  );
}
