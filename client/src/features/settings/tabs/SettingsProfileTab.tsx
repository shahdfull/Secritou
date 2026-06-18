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
import { toast } from "sonner";

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
    name: z.string().min(1, "Le nom est requis"),
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
          toast.success(t("auth.passwordChanged"));
        },
        onError: (error: Error) => {
          toast.error(error.message ?? t("errors.generic", "Une erreur est survenue"));
        },
      }
    );
  };

  const handleProfileSubmit = async (data: ProfileForm) => {
    updateMe.mutate(
      { name: data.name },
      {
        onError: (error: Error) => {
          toast.error(error.message ?? t("errors.generic", "Une erreur est survenue"));
        },
      }
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDesc>Your account information</CardDesc>
      </CardHeader>
      <CardContent className="space-y-4">
        <Form {...profileForm}>
          <form onSubmit={profileForm.handleSubmit(handleProfileSubmit)} className="space-y-4">
            <FormField
              control={profileForm.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={email ?? ""} disabled />
            </div>
            <Button type="submit" disabled={updateMe.isPending}>
              {updateMe.isPending ? "Saving..." : "Save changes"}
            </Button>
          </form>
        </Form>
        <div className="pt-4">
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">Change Password</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Change Password</DialogTitle>
                <DialogDescription>Enter your current password and your new password</DialogDescription>
              </DialogHeader>
              <Form {...changePasswordForm}>
                <form onSubmit={changePasswordForm.handleSubmit(handleChangePasswordSubmit)} className="space-y-4">
                  <FormField
                    control={changePasswordForm.control}
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
                    control={changePasswordForm.control}
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
                    control={changePasswordForm.control}
                    name="confirmPassword"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Confirm Password</FormLabel>
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
                      Cancel
                    </Button>
                    <Button type="submit" disabled={changePassword.isPending}>
                      {changePassword.isPending ? "Saving..." : "Save"}
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

