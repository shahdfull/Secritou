import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useTranslation } from "react-i18next";
import { useAddInvoicePayment } from "@/hooks/useInvoices";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { AlertCircle } from "lucide-react";

interface AddPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoice: {
    id: string;
    number: string;
    amount: number;
    amountPaid: number;
    currency: string;
    status: string;
  } | null;
}

export function AddPaymentDialog({ open, onOpenChange, invoice }: AddPaymentDialogProps) {
  const { t } = useTranslation();
  const addPayment = useAddInvoicePayment();

  const unpaidBalance = invoice ? Math.max(Number(invoice.amount) - Number(invoice.amountPaid), 0) : 0;

  const formSchema = z.object({
    amount: z.number().positive(t("invoices.validation.amountPositive")),
    method: z.string().max(100).optional(),
    reference: z.string().max(255).optional(),
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      amount: 0,
      method: "",
      reference: "",
    },
  });

  // One idempotency key per dialog session: stable across retries of the same submission
  // (e.g. a network retry or an accidental double-click before the first request resolves),
  // but regenerated the next time the dialog opens for a genuinely new payment.
  const idempotencyKeyRef = useRef<string>(crypto.randomUUID());

  // Reset form with new unpaid balance when dialog opens
  useEffect(() => {
    if (open && invoice) {
      idempotencyKeyRef.current = crypto.randomUUID();
      form.reset({
        amount: Number(unpaidBalance.toFixed(2)),
        method: "",
        reference: "",
      });
    }
  }, [open, invoice, unpaidBalance]);

  const watchedAmount = form.watch("amount") || 0;
  const overpaidAmount = Math.max(watchedAmount - unpaidBalance, 0);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    if (!invoice) return;
    await addPayment.mutateAsync(
      {
        id: invoice.id,
        data: { ...values, idempotencyKey: idempotencyKeyRef.current },
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      }
    );
  };

  if (!invoice) return null;
  const isInvoiceAcceptingPayments = ["SENT", "PARTIAL", "OVERDUE"].includes(invoice.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Ajouter un paiement</DialogTitle>
          <DialogDescription>
            {isInvoiceAcceptingPayments ? (
              <>
                Enregistrer un paiement pour la facture <span className="font-mono">{invoice.number}</span>.
                Le solde restant est de <span className="font-semibold">{unpaidBalance.toFixed(2)} {invoice.currency}</span>.
              </>
            ) : (
              <>
                Impossible d'ajouter un paiement à une facture en statut <span className="font-semibold">{invoice.status}</span>.
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        {isInvoiceAcceptingPayments ? (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Montant payé ({invoice.currency})</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="method"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Méthode de paiement</FormLabel>
                    <FormControl>
                      <Input placeholder="Virement, Carte, Espèces..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="reference"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Référence de transaction (Optionnel)</FormLabel>
                    <FormControl>
                      <Input placeholder="N° de transaction, chèque..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {overpaidAmount > 0 && (
                <div className="flex gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs items-start">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">Avertissement : Surpaiement détecté</p>
                    <p className="mt-0.5">
                      Le montant saisi dépasse le solde restant. L'excédent de{" "}
                      <span className="font-bold">{overpaidAmount.toFixed(2)} {invoice.currency}</span> sera
                      automatiquement converti en avoir pour ce client.
                    </p>
                  </div>
                </div>
              )}

              <DialogFooter>
                <Button type="submit" disabled={addPayment.isPending}>
                  {addPayment.isPending ? "Enregistrement..." : "Enregistrer le paiement"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        ) : (
          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>Fermer</Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
