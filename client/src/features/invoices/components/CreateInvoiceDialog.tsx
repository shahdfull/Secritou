import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useClients } from "@/hooks/useClients";
import { useCreateInvoice } from "@/hooks/useInvoices";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { DEFAULT_CURRENCY } from "@/lib/currencies";

interface CreateInvoiceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateInvoiceDialog({ open, onOpenChange }: CreateInvoiceDialogProps) {
  const { t } = useTranslation();
  const formSchema = z.object({
    clientId: z.string().min(1, t("invoices.validation.clientRequired")),
    title: z.string().min(1, t("invoices.validation.titleRequired")),
    amount: z.number().min(0, t("invoices.validation.amountPositive")),
    dueDate: z.string().optional(),
    description: z.string().optional(),
  });
  const createInvoice = useCreateInvoice();
  const { data: clientsResult } = useClients({ pageSize: 100 });
  const clients = clientsResult?.data || [];

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      amount: 0,
      dueDate: "",
      description: "",
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    await createInvoice.mutateAsync({
      title: values.title,
      description: values.description,
      amount: values.amount,
      currency: DEFAULT_CURRENCY,
      dueDate: values.dueDate || undefined,
      clientId: values.clientId,
    }, {
      onSuccess: () => {
        onOpenChange(false);
        form.reset();
      },
      onError: () => {
        toast.error(t("toasts.invoiceCreateError"));
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t("invoices.createDialog.title")}</DialogTitle>
          <DialogDescription>
            {t("invoices.createDialog.description")}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="clientId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("invoices.createDialog.clientLabel")}</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t("invoices.createDialog.clientPlaceholder")} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {clients.map((client) => (
                        <SelectItem key={client.id} value={client.id}>
                          {client.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("invoices.createDialog.titleLabel")}</FormLabel>
                  <FormControl>
                    <Input placeholder={t("invoices.createDialog.titlePlaceholder")} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-1 gap-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("invoices.createDialog.amountLabel")}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="dueDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("invoices.createDialog.dueDateLabel")}</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("invoices.createDialog.descriptionLabel")}</FormLabel>
                  <FormControl>
                    <Textarea
                        placeholder={t("invoices.createDialog.descriptionPlaceholder")}
                        className="resize-none"
                        {...field}
                      />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit" disabled={createInvoice.isPending}>
                {createInvoice.isPending ? t("invoices.createDialog.submitting") : t("invoices.createDialog.submit")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
