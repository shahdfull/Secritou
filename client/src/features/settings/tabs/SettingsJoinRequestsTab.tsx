import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Loader2, PencilLine, UserPlus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { contactRequestsApi, type ContactRequest } from "@/api/contactRequests.api";
import { usersApi } from "@/api/users.api";
import { toast } from "sonner";

const reviewSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  role: z.enum(["MANAGER", "FREELANCER"]),
});

type ReviewForm = z.infer<typeof reviewSchema>;

export function SettingsJoinRequestsTab() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<ContactRequest | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["contact-requests"],
    queryFn: () => contactRequestsApi.getAll({ limit: 50 }),
  });

  const reviewForm = useForm<ReviewForm>({
    resolver: zodResolver(reviewSchema),
    defaultValues: { name: "", email: "", role: "FREELANCER" },
  });

  const openReview = (request: ContactRequest) => {
    setSelected(request);
    reviewForm.reset({
      name: request.name,
      email: request.email,
      role: request.serviceType.toLowerCase().includes("manager") ? "MANAGER" : "FREELANCER",
    });
  };

  const markAsRead = useMutation({
    mutationFn: (request: ContactRequest) => contactRequestsApi.updateStatus(request.id, "READ"),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["contact-requests"] }),
  });

  const createAccount = useMutation({
    mutationFn: async (values: ReviewForm) =>
      usersApi.inviteUser({
        name: values.name,
        email: values.email,
        role: values.role,
      }),
    onSuccess: () => {
      toast.success(t("joinRequests.accountCreated"));
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: ["contact-requests"] });
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const requests = useMemo(() => data?.data ?? [], [data]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("joinRequests.title")}</CardTitle>
        <CardDescription>{t("joinRequests.description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : requests.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("joinRequests.empty")}</p>
        ) : (
          requests.map((request) => (
            <div key={request.id} className="rounded-2xl border border-border p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-ink">{request.name}</p>
                  <p className="text-sm text-muted-foreground">{request.email}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{request.serviceType}</p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => {
                    markAsRead.mutate(request);
                    openReview(request);
                  }}
                >
                  <PencilLine className="mr-2 h-4 w-4" />
                  {t("joinRequests.review")}
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("joinRequests.reviewTitle")}</DialogTitle>
            <DialogDescription>{t("joinRequests.reviewDescription")}</DialogDescription>
          </DialogHeader>
          <Form {...reviewForm}>
            <form
              className="space-y-4"
              onSubmit={reviewForm.handleSubmit((values) => createAccount.mutate(values))}
            >
              <FormField
                control={reviewForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("auth.fullName")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={reviewForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("auth.email")}</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={reviewForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("joinRequests.role")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t("joinRequests.rolePlaceholder")} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="FREELANCER">{t("joinUs.freelancer")}</SelectItem>
                        <SelectItem value="MANAGER">{t("joinUs.manager")}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button variant="outline" type="button" onClick={() => setSelected(null)}>
                  {t("common.cancel")}
                </Button>
                <Button type="submit" disabled={createAccount.isPending}>
                  {createAccount.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("joinRequests.createAccount")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
