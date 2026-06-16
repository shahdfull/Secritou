import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLogin, getRedirectPathForRole } from "@/hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;

export function LoginPage() {
  const { mutate: login, isPending } = useLogin();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = (data: LoginForm) => {
    login(data, {
      onSuccess: (response) => {
        navigate(getRedirectPathForRole(response.user.role));
      },
    });
  };

  return (
    <section className="container-page grid min-h-[72vh] place-items-center py-16">
      <form
        className="w-full max-w-md rounded-3xl border border-border bg-card p-8 shadow-soft"
        onSubmit={handleSubmit(onSubmit)}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
          Secritou
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold text-ink">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Access your workspace, projects, reports and AI assistant.
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
          <div className="space-y-1">
            <Input
              placeholder="Password"
              type="password"
              {...register("password")}
              disabled={isPending}
            />
            {errors.password && (
              <p className="text-xs text-red-500">{errors.password.message}</p>
            )}
          </div>
        </div>

        <Button className="mt-6 w-full rounded-full" type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Signing in...
            </>
          ) : (
            "Sign in"
          )}
        </Button>

        <div className="mt-6 text-center text-sm">
          Don't have an account?{" "}
          <Link to="/register" className="text-primary font-semibold hover:underline">
            Sign up
          </Link>
        </div>
      </form>
    </section>
  );
}
