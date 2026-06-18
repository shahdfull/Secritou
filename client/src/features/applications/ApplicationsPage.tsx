import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();
import type { FreelancerApplication } from "@/api/freelancerApplications.api";
import {
  useFreelancerApplications,
  useRejectFreelancerApplication,
  useAcceptFreelancerApplication,
} from "@/hooks/useFreelancerApplications";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { rejectFormSchema, createAcceptFormSchema } from "@/schemas/application.schema";
import {
  Download,
  MoreHorizontal,
  CheckCircle2,
  XCircle,
  Eye,
  Copy,
} from "lucide-react";
import { DataTablePagination } from "@/components/common/DataTablePagination";
import { useListParams } from "@/hooks/useListParams";
import { toast } from "sonner";

const ALL_STATUSES_VALUE = "__all__";

export function ApplicationsPage() {
  const { t } = useTranslation();
  const { page, pageSize, search, status, updateParams } = useListParams(10);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [acceptDialogOpen, setAcceptDialogOpen] = useState(false);
  const [selectedApplication, setSelectedApplication] = useState<FreelancerApplication | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [previewType, setPreviewType] = useState<"cv" | "portfolio" | null>(null);

  const { data: applicationsResult, isLoading } = useFreelancerApplications({
    page,
    pageSize,
    search,
    status,
  });

  const applications = useMemo(
    () => Array.isArray(applicationsResult?.data) ? applicationsResult.data : [],
    [applicationsResult?.data]
  );

  const rejectMutation = useRejectFreelancerApplication();
  const acceptMutation = useAcceptFreelancerApplication();

  // Create schemas with translated messages
  const acceptFormSchema = createAcceptFormSchema(t);
  
  type RejectForm = z.infer<typeof rejectFormSchema>;
  type AcceptForm = z.infer<typeof acceptFormSchema>;
  
  const rejectForm = useForm<RejectForm>({
    resolver: zodResolver(rejectFormSchema),
  });
  
  const acceptForm = useForm<AcceptForm>({
    resolver: zodResolver(acceptFormSchema),
  });

  const handleReject = (data: RejectForm) => {
    if (!selectedApplication) return;
    rejectMutation.mutate(
      { id: selectedApplication.id, ...data },
      {
        onSuccess: () => {
          setRejectDialogOpen(false);
          rejectForm.reset();
        },
      }
    );
  };

  const handleAccept = (data: AcceptForm) => {
    if (!selectedApplication) return;
    acceptMutation.mutate(
      { id: selectedApplication.id, ...data },
      {
        onSuccess: () => {
          setAcceptDialogOpen(false);
          acceptForm.reset();
        },
      }
    );
  };

  const generatePassword = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+-=[]{}|;:,.<>?";
    let password = "";
    for (let i = 0; i < 16; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const openRejectDialog = (application: FreelancerApplication) => {
    setSelectedApplication(application);
    setRejectDialogOpen(true);
  };

  const openAcceptDialog = (application: FreelancerApplication) => {
    setSelectedApplication(application);
    acceptForm.reset({
      firstName: application.firstName,
      lastName: application.lastName,
      email: application.email,
      phone: application.phone,
      role: "FREELANCER",
      username: `${application.firstName.toLowerCase()}${application.lastName.toLowerCase()}`,
      password: generatePassword(),
    });
    setAcceptDialogOpen(true);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING":
      return "bg-yellow-100 text-yellow-800";
      case "ACCEPTED":
      return "bg-green-100 text-green-800";
      case "REJECTED":
      return "bg-red-100 text-red-800";
      default:
      return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{t("applications.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("applications.subtitle")}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <Input
          placeholder={t("applications.search")}
          value={search || ""}
          onChange={(e) => updateParams({ search: e.target.value, page: 1 })}
          className="max-w-sm"
        />
        <Select
          value={status || ALL_STATUSES_VALUE}
          onValueChange={(value) =>
            updateParams({ status: value === ALL_STATUSES_VALUE ? undefined : value, page: 1 })
          }
        >
          <SelectTrigger className="max-w-sm">
            <SelectValue placeholder={t("applications.filterByStatus")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUSES_VALUE}>{t("applications.allStatuses")}</SelectItem>
            <SelectItem value="PENDING">
              {t("applications.statuses.pending")}
            </SelectItem>
            <SelectItem value="ACCEPTED">
              {t("applications.statuses.accepted")}
            </SelectItem>
            <SelectItem value="REJECTED">
              {t("applications.statuses.rejected")}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("applications.name")}</TableHead>
              <TableHead>{t("applications.email")}</TableHead>
              <TableHead>{t("applications.phone")}</TableHead>
              <TableHead>{t("applications.position")}</TableHead>
              <TableHead>{t("applications.date")}</TableHead>
              <TableHead>{t("applications.status")}</TableHead>
              <TableHead className="text-right">
                {t("applications.actions")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10">
                {t("common.loading")}
              </TableCell>
              </TableRow>
            ) : applications.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10">
                  {t("applications.empty")}
                </TableCell>
              </TableRow>
            ) : (
              applications.map((app) => (
                <TableRow key={app.id}>
                  <TableCell className="font-medium">
                    {app.firstName} {app.lastName}
                  </TableCell>
                  <TableCell>{app.email}</TableCell>
                  <TableCell>{app.phone || "-"}</TableCell>
                  <TableCell>{app.position}</TableCell>
                  <TableCell>
                    {new Date(app.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(app.status)}>
                      {t(`applications.statuses.${app.status.toLowerCase()}`)}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            if (app.cvUrl) {
                              setPdfPreviewUrl(app.cvUrl);
                              setPreviewType("cv");
                            }
                          }}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          {t("applications.view")} CV
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => {
                            if (app.portfolioUrl) {
                              setPdfPreviewUrl(app.portfolioUrl);
                              setPreviewType("portfolio");
                            }
                          }}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          {t("applications.view")} Portfolio
                        </DropdownMenuItem>

                        {app.status === "PENDING" && (
                          <>
                            <DropdownMenuItem onClick={() => openAcceptDialog(app)}>
                              <CheckCircle2 className="mr-2 h-4 w-4 text-green-600" />
                              {t("applications.accept")}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openRejectDialog(app)}>
                              <XCircle className="mr-2 h-4 w-4 text-red-600" />
                              {t("applications.reject")}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {applicationsResult && Number.isFinite(applicationsResult.total) && (
        <DataTablePagination
          page={applicationsResult.page}
          pageSize={applicationsResult.pageSize}
          total={applicationsResult.total}
          onPageChange={(nextPage) => updateParams({ page: nextPage })}
        />
      )}

      {/* Preview Dialog */}
      <Dialog open={!!pdfPreviewUrl} onOpenChange={() => { setPdfPreviewUrl(null); setPreviewType(null); }}>
        <DialogContent className="max-w-3xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{previewType === "cv" ? "CV Preview" : "Portfolio Preview"}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto flex flex-col items-center bg-muted/30 rounded p-2">
            <Document
              file={pdfPreviewUrl}
              onLoadSuccess={({ numPages }) => setNumPages(numPages)}
              onLoadError={() => toast.error("Failed to load PDF")}
              loading={<p className="text-sm text-muted-foreground mt-10">Loading PDF...</p>}
            >
              {Array.from({ length: numPages }, (_, i) => (
                <Page
                  key={i + 1}
                  pageNumber={i + 1}
                  width={700}
                  className="mb-2 shadow"
                />
              ))}
            </Document>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => window.open(pdfPreviewUrl!, "_blank")}>
              <Download className="mr-2 h-4 w-4" /> Download
            </Button>
            <Button variant="ghost" onClick={() => { setPdfPreviewUrl(null); setPreviewType(null); }}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialogOpen} onOpenChange={setRejectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("applications.rejectModal.title")}</DialogTitle>
            <DialogDescription>
              {t("applications.rejectModal.description")}
            </DialogDescription>
          </DialogHeader>
          <Form {...rejectForm}>
            <form
              onSubmit={rejectForm.handleSubmit(handleReject)}
              className="space-y-4"
            >
              <FormField
                control={rejectForm.control}
                name="rejectionReason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("applications.rejectModal.reason")}
                    </FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t("applications.rejectModal.reasonPlaceholder")}
                        rows={4}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setRejectDialogOpen(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={rejectMutation.isPending}
                >
                  {t("applications.rejectModal.confirm")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Accept Dialog */}
      <Dialog open={acceptDialogOpen} onOpenChange={setAcceptDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("applications.acceptModal.title")}</DialogTitle>
            <DialogDescription>
              {t("applications.acceptModal.description")}
            </DialogDescription>
          </DialogHeader>
          <Form {...acceptForm}>
            <form
              onSubmit={acceptForm.handleSubmit(handleAccept)}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={acceptForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("applications.acceptModal.firstName")}
                      </FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={acceptForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("applications.acceptModal.lastName")}
                      </FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <FormField
                control={acceptForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("applications.acceptModal.email")}
                    </FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={acceptForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("applications.acceptModal.phone")}
                    </FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={acceptForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("applications.acceptModal.username")}
                    </FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={acceptForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("applications.acceptModal.role")}
                    </FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue />
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
              <FormField
                control={acceptForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("applications.acceptModal.password")}
                    </FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const newPassword = generatePassword();
                          acceptForm.setValue("password", newPassword);
                        }}
                      >
                        🔄
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => copyToClipboard(field.value)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setAcceptDialogOpen(false)}
                >
                  {t("common.cancel")}
                </Button>
                <Button
                  type="submit"
                  disabled={acceptMutation.isPending}
                >
                  {t("applications.acceptModal.confirm")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
