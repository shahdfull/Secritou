import { memo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription as CardDesc, CardHeader, CardTitle } from "@/components/ui/card";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useChangePassword, useUpdateMe } from "@/hooks/useAuth";

export const SettingsProfileTab = memo(function SettingsProfileTab({
  name,
  email,
}: {
  name?: string;
  email?: string;
}) {
  const { t } = useTranslation();
  const changePassword = useChangePassword();
  const updateMe = useUpdateMe();
  const [open, setOpen] = useState(false);

  const changePasswordSchema = z
    .object({
      currentPassword: z.string().min(1, t("auth.passwordMinLength")),
      newPassword: z.string().min(8, t("auth.passwordMinLength")),
      confirmPassword: z.string().min(8, t("auth.passwordMinLength")),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: t("auth.passwordMismatch"),
      path: ["confirmPassword"],
    });

  type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

  const changePasswordForm = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const profileSchema = z.object({
    name: z.string().min(1, t("settings.profile.nameRequired")),
  });

  type ProfileForm = z.infer<typeof profileSchema>;

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: name ?? "",
    },
  });

  const handleChangePasswordSubmit = async (data: ChangePasswordForm) => {
    changePassword.mutate(
      {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      },
      {
        onSuccess: () => {
          setOpen(false);
          changePasswordForm.reset();
        },
      }
    );
  };

  const handleProfileSubmit = async (data: ProfileForm) => {
    updateMe.mutate({ name: data.name });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("settings.profile.title")}</CardTitle>
        <CardDesc>{t("settings.profile.subtitle")}</CardDesc>
      </CardHeader>
      <CardContent className="space-y-4">
        <Form {...profileForm}>
          <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-4">
            <FormField
              control={profileForm.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("common.name")}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div>
              <Label htmlFor="email">{t("common.email")}</Label>
              <Input id="email" value={email ?? ""} disabled />
            </div>
            <Button type="submit" disabled={updateMe.isPending}>
              {updateMe.isPending ? t("common.saving") : t("settings.profile.saveChanges")}
            </Button>
          </form>
        </Form>
        <div className="pt-4">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">{t("auth.changePassword")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t("auth.changePassword")}</DialogTitle>
                <DialogDescription>{t("auth.changePasswordDescription")}</DialogDescription>
              </DialogHeader>
              <Form {...changePasswordForm}>
                <form onSubmit={changePasswordForm.handleSubmit(handleChangePasswordSubmit)} className="space-y-4">
                  <FormField
                    control={changePasswordForm.control}
                    name="currentPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("auth.currentPassword")}</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={changePasswordForm.control}
                    name="newPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("auth.newPassword")}</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={changePasswordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t("auth.confirmNewPassword")}</FormLabel>
                        <FormControl>
                          <Input type="password" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setOpen(false)}
                    >
                      {t("common.cancel")}
                    </Button>
                    <Button type="submit" disabled={changePassword.isPending}>
                      {changePassword.isPending ? t("common.saving") : t("common.save")}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </CardContent>
    </Card>
  );
});

