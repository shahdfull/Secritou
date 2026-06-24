import { Bell, Check, FileText, CheckCircle, XCircle, Clock, CreditCard, FolderOpen, ClipboardList, MessageSquare, Users, FileSignature, TrendingUp, AlertCircle } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsApi, type Notification, type NotificationType } from "../api/notifications.api";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { Card } from "./ui/card";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

function getNotificationIcon(type: NotificationType) {
  switch (type) {
    case "PROPOSAL_SENT":
    case "PROPOSAL_ACCEPTED":
    case "PROPOSAL_REJECTED":
    case "PROPOSAL_EXPIRED":
      return <FileText className="h-4 w-4 text-blue-500 shrink-0" />;
    case "APPROVAL_REQUESTED":
      return <ClipboardList className="h-4 w-4 text-purple-500 shrink-0" />;
    case "APPROVAL_ACCEPTED":
      return <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />;
    case "APPROVAL_REJECTED":
      return <XCircle className="h-4 w-4 text-red-500 shrink-0" />;
    case "INVOICE_SENT":
    case "INVOICE_OVERDUE":
      return <CreditCard className="h-4 w-4 text-orange-500 shrink-0" />;
    case "PAYMENT_RECEIVED":
      return <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />;
    case "PROJECT_STATUS_CHANGED":
      return <FolderOpen className="h-4 w-4 text-indigo-500 shrink-0" />;
    case "TASK_ASSIGNED":
      return <ClipboardList className="h-4 w-4 text-yellow-500 shrink-0" />;
    case "SERVICE_REQUEST_CREATED":
    case "SERVICE_REQUEST_STATUS_CHANGED":
    case "SERVICE_REQUEST_COMMENT":
      return <MessageSquare className="h-4 w-4 text-teal-500 shrink-0" />;
    case "BRIEF_COMPLETED":
      return <FileText className="h-4 w-4 text-blue-400 shrink-0" />;
    case "DOCUMENT_SIGNED":
      return <FileSignature className="h-4 w-4 text-green-600 shrink-0" />;
    case "LEAD_CONVERTED":
      return <TrendingUp className="h-4 w-4 text-emerald-500 shrink-0" />;
    case "FREELANCER_APPLICATION":
      return <Users className="h-4 w-4 text-violet-500 shrink-0" />;
    default:
      return <AlertCircle className="h-4 w-4 text-muted-foreground shrink-0" />;
  }
}

function resolveLink(notification: Notification): string | null {
  return notification.link ?? null;
}

export function NotificationBell() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: notificationsApi.getNotifications,
    refetchInterval: 30000,
  });

  const unreadCount = notifications?.filter((n) => !n.read).length || 0;

  const markAsReadMutation = useMutation({
    mutationFn: notificationsApi.markAsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAllAsReadMutation = useMutation({
    mutationFn: notificationsApi.markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success(t("toasts.notificationsMarkedRead"));
    },
  });

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) markAsReadMutation.mutate(notification.id);
    const link = resolveLink(notification);
    if (link) {
      // Internal links (same origin): use react-router navigate.
      // External links (emails containing full URLs): open in new tab.
      try {
        const url = new URL(link);
        if (url.origin === window.location.origin) {
          navigate(url.pathname + url.search + url.hash);
        } else {
          window.open(link, "_blank", "noopener,noreferrer");
        }
      } catch {
        navigate(link);
      }
    }
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={t("notifications.open")}>
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs">
              {unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-semibold">{t("notifications.title")}</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs" onClick={() => markAllAsReadMutation.mutate()}>
              <Check className="mr-1 h-3 w-3" />
              {t("notifications.markAllRead")}
            </Button>
          )}
        </div>
        <ScrollArea className="h-80">
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">{t("common.loading")}</div>
          ) : notifications?.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">{t("notifications.empty")}</div>
          ) : (
            notifications?.map((notification) => (
              <Card
                key={notification.id}
                className={`mb-2 p-3 transition-colors ${!notification.read ? "bg-primary/5" : ""} ${notification.link ? "cursor-pointer hover:bg-accent" : ""}`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex items-start gap-2">
                  {getNotificationIcon(notification.type)}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{notification.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground line-clamp-2">{notification.message}</div>
                  </div>
                  {!notification.read && <div className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />}
                </div>
              </Card>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
