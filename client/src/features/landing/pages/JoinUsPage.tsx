import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { toast } from "sonner";
import { Loader2, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCreateFreelancerApplication } from "@/hooks/useFreelancerApplications";
import { FileUploadField } from "@/components/common/FileUploadField";
import { useRef, useState } from "react";

export function JoinUsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createApplication = useCreateFreelancerApplication();
  const [isSuccess, setIsSuccess] = useState(false);

  // Track selected files (not uploaded yet - will be uploaded on form submit)
  const uploadedCv = useRef<File | null>(null);
  const uploadedPortfolio = useRef<File | null>(null);

  const schema = z.object({
    firstName: z.string().min(1, t("auth.nameMinLength")),
    lastName: z.string().min(1, t("auth.nameMinLength")),
    email: z.string().email(t("auth.validEmail")),
    phone: z.string().optional(),
    role: z.enum(["FREELANCER", "MANAGER"]),
    bio: z.string().min(20, t("joinUs.bioMinLength")),
    // Honeypot: hidden field a human never fills in. Left unconstrained so a
    // bot filling it still passes client-side validation and reaches the
    // server, which silently no-ops instead of revealing the trap.
    website: z.string().optional(),
  });
  type JoinUsForm = z.infer<typeof schema>;

  const form = useForm<JoinUsForm>({
    resolver: zodResolver(schema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      role: "FREELANCER",
      bio: "",
      website: "",
    },
  });

  const onSubmit = (data: JoinUsForm) => {
    if (!uploadedCv.current) {
      toast.error(t("joinUs.cvRequired"));
      return;
    }
    if (!uploadedPortfolio.current) {
      toast.error(t("joinUs.portfolioRequired"));
      return;
    }

    // Create FormData to send files + form data together
    const formData = new FormData();
    formData.append("firstName", data.firstName);
    formData.append("lastName", data.lastName);
    formData.append("email", data.email);
    formData.append("phone", data.phone || "");
    formData.append("role", data.role);
    formData.append("bio", data.bio);
    formData.append("position", data.role === "FREELANCER" ? "Freelancer" : "Manager");
    formData.append("cvFile", uploadedCv.current);
    formData.append("portfolioFile", uploadedPortfolio.current);
    formData.append("website", data.website || "");

    createApplication.mutate(formData, {
      onSuccess: () => {
        setIsSuccess(true);
        toast.success(t("joinUs.successMessage"));
      },
    });
  };

  return (
    <section className="container-page py-16">
      <div className="mx-auto max-w-2xl rounded-3xl border border-border bg-card p-8 shadow-soft">
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
            {t("nav.joinUs")}
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold text-ink">
            {t("joinUs.title")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("joinUs.subtitle")}
          </p>
        </div>

        {isSuccess ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircle2 className="h-16 w-16 text-green-600 mb-4" />
            <h2 className="text-2xl font-bold text-ink mb-2">
              {t("joinUs.successTitle")}
            </h2>
            <p className="text-muted-foreground mb-6 max-w-md">
              {t("joinUs.successDescription")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t("joinUs.successSubtext")}
            </p>
          </div>
        ) : (
          <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
            <input
              type="text"
              {...form.register("website")}
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              style={{ position: "absolute", left: "-9999px" }}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("joinUs.firstName")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("joinUs.lastName")}</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
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
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("contact.phone")}</FormLabel>
                  <FormControl>
                    <Input {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("joinUs.role")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("joinUs.rolePlaceholder")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="FREELANCER">
                        {t("joinUs.freelancer")}
                      </SelectItem>
                      <SelectItem value="MANAGER">{t("joinUs.manager")}</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* CV Upload */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-ink">
                {t("joinUs.cv")}
              </label>
              <FileUploadField
                context="cv"
                accept=".pdf"
                label={t("joinUs.uploadCv")}
                maxSizeMb={10}
                onUploaded={(result) => {
                  uploadedCv.current = result as File;
                }}
              />
            </div>

            {/* Portfolio Upload */}
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-ink">
                {t("joinUs.portfolio")}
              </label>
              <FileUploadField
                context="portfolio"
                accept=".pdf,.zip"
                label={t("joinUs.uploadPortfolio")}
                maxSizeMb={20}
                onUploaded={(result) => {
                  uploadedPortfolio.current = result as File;
                }}
              />
            </div>

            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("joinUs.motivations")}</FormLabel>
                  <FormControl>
                    <Textarea rows={5} placeholder={t("joinUs.motivationsPlaceholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              className="w-full rounded-full bg-ink text-white hover:bg-ink/90"
              type="submit"
              disabled={createApplication.isPending}
            >
              {createApplication.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t("joinUs.submit")}
            </Button>
          </form>
          </Form>
        )}
      </div>
    </section>
  );
}
