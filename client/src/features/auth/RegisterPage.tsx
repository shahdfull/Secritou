import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useRegister as useRegisterMutation } from "@/hooks/useAuth";
import { useNavigate, Link } from "react-router-dom";
import { Loader2 } from "lucide-react";

const registerSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
});

type RegisterForm = z.infer<typeof registerSchema>;

export function RegisterPage() {
  const { mutate: registerMutation, isPending } = useRegisterMutation();
  const navigate = useNavigate();

  const {
    register: formRegister,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      companyName: "",
    },
  });

  const onSubmit = (data: RegisterForm) => {
    registerMutation(data, {
      onSuccess: () => {
        navigate("/app");
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
        <h1 className="mt-2 font-display text-3xl font-bold text-ink">
          Create account
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Get started with your growth and digital transformation platform.
        </p>

        <div className="mt-6 space-y-4">
          <div className="space-y-1">
            <Input
              placeholder="Full name"
              {...formRegister("name")}
              disabled={isPending}
            />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Input
              placeholder="Company name"
              {...formRegister("companyName")}
              disabled={isPending}
            />
            {errors.companyName && (
              <p className="text-xs text-red-500">{errors.companyName.message}</p>
            )}
          </div>
          <div className="space-y-1">
            <Input
              placeholder="Email"
              type="email"
              {...formRegister("email")}
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
              {...formRegister("password")}
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
              Creating account...
            </>
          ) : (
            "Create account"
          )}
        </Button>

        <div className="mt-6 text-center text-sm">
          Already have an account?{" "}
          <Link to="/login" className="text-primary font-semibold hover:underline">
            Sign in
          </Link>
        </div>
      </form>
    </section>
  );
}
