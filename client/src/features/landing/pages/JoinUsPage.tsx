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
import { Loader2, Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useCreateFreelancerApplication } from "@/hooks/useFreelancerApplications";
import { useState } from "react";

export function JoinUsPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const createApplication = useCreateFreelancerApplication();
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [portfolioFile, setPortfolioFile] = useState<File | null>(null);

  const schema = z.object({
    firstName: z.string().min(1, t("auth.nameMinLength")),
    lastName: z.string().min(1, t("auth.nameMinLength")),
    email: z.string().email(t("auth.validEmail")),
    phone: z.string().optional(),
    role: z.enum(["FREELANCER", "MANAGER"]),
    bio: z.string().min(20, t("joinUs.bioMinLength")),
    cvUrl: z.string().url(t("joinUs.cvInvalid")).optional(),
    portfolioUrl: z.string().url(t("joinUs.portfolioInvalid")).optional(),
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
      cvUrl: "",
      portfolioUrl: "",
    },
  });

  // Placeholder for file upload - in real app, you'd upload to storage service
  const handleFileUpload = (file: File, type: "cv" | "portfolio") => {
    // For now, we'll use a dummy URL - in production, use S3, Cloudinary, etc.
    const dummyUrl = URL.createObjectURL(file);
    if (type === "cv") {
      setCvFile(file);
      form.setValue("cvUrl", dummyUrl);
    } else {
      setPortfolioFile(file);
      form.setValue("portfolioUrl", dummyUrl);
    }
  };

  const onSubmit = (data: JoinUsForm) => {
    if (!data.cvUrl) {
      toast.error(t("joinUs.cvRequired"));
      return;
    }
    if (!data.portfolioUrl) {
      toast.error(t("joinUs.portfolioRequired"));
      return;
    }

    createApplication.mutate(
      {
        ...data,
        position: data.role === "FREELANCER" ? "Freelancer" : "Manager",
      },
      {
        onSuccess: () => {
          navigate("/");
        },
      }
    );
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

        <Form {...form}>
          <form className="space-y-4" onSubmit={form.handleSubmit(onSubmit)}>
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
            <FormField
              control={form.control}
              name="cvUrl"
              render={() => (
                <FormItem>
                  <FormLabel>{t("joinUs.cv")}</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-4">
                      <label className="flex-1 cursor-pointer">
                        <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary transition-colors">
                          <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">
                            {cvFile ? cvFile.name : "Click to upload CV"}
                          </p>
                        </div>
                        <input
                          type="file"
                          accept=".pdf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(file, "cv");
                          }}
                        />
                      </label>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Portfolio Upload */}
            <FormField
              control={form.control}
              name="portfolioUrl"
              render={() => (
                <FormItem>
                  <FormLabel>{t("joinUs.portfolio")}</FormLabel>
                  <FormControl>
                    <div className="flex items-center gap-4">
                      <label className="flex-1 cursor-pointer">
                        <div className="border-2 border-dashed border-border rounded-xl p-6 text-center hover:border-primary transition-colors">
                          <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                          <p className="text-sm text-muted-foreground">
                            {portfolioFile ? portfolioFile.name : "Click to upload portfolio (PDF or ZIP)"}
                          </p>
                        </div>
                        <input
                          type="file"
                          accept=".pdf,.zip"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleFileUpload(file, "portfolio");
                          }}
                        />
                      </label>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="bio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("joinUs.bio")}</FormLabel>
                  <FormControl>
                    <Textarea rows={5} {...field} />
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
      </div>
    </section>
  );
}
