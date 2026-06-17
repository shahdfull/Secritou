import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useChangePassword } from "@/hooks/useAuth";
import { useAuthStore } from "@/store/auth.store";
import { useEffect } from "react";

export function ChangePasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const changePassword = useChangePassword();

  useEffect(() => {
    if (!user?.mustChangePassword) {
      navigate("/app");
    }
  }, [user, navigate]);

  const schema = z
    .object({
      currentPassword: z.string().min(1, t("auth.passwordMinLength")),
      newPassword: z.string().min(8, t("auth.passwordMinLength")),
      confirmPassword: z.string().min(8, t("auth.passwordMinLength")),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: t("auth.passwordMismatch"),
      path: ["confirmPassword"],
    });

  type ChangePasswordForm = z.infer<typeof schema>;

  const form = useForm<ChangePasswordForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: ChangePasswordForm) => {
    changePassword.mutate(
      {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      },
      {
        onSuccess: () => {
          navigate("/app");
        },
      }
    );
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-md p-8 space-y-6 rounded-3xl border bg-card shadow-soft">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-bold">{t("auth.changePassword")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("auth.changePasswordRequired")}
          </p>
        </div>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Current Password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>New Password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Confirm New Password</FormLabel>
                  <FormControl>
                    <Input type="password" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button
              type="submit"
              className="w-full"
              disabled={changePassword.isPending}
            >
              {changePassword.isPending ? "Changing..." : t("common.save")}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  );
}
