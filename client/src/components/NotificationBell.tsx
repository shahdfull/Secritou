import { Bell, Check } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationsApi, type Notification } from "../api/notifications.api";
import { Button } from "./ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { Badge } from "./ui/badge";
import { ScrollArea } from "./ui/scroll-area";
import { Card } from "./ui/card";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export function NotificationBell() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data: notifications, isLoading } = useQuery({ queryKey: ["notifications"], queryFn: notificationsApi.getNotifications, refetchInterval: 30000 });
  const unreadCount = notifications?.filter((n) => !n.read).length || 0;
  const markAsReadMutation = useMutation({ mutationFn: notificationsApi.markAsRead, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }) });
  const markAllAsReadMutation = useMutation({
    mutationFn: notificationsApi.markAllAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      toast.success(t("toasts.notificationsMarkedRead"));
    },
  });
  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) markAsReadMutation.mutate(notification.id);
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={t("notifications.open")}>
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 p-0 text-xs">{unreadCount}</Badge>}
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
              <Card key={notification.id} className={`mb-2 cursor-pointer p-3 transition-colors ${!notification.read ? "bg-primary/5" : ""}`} onClick={() => handleNotificationClick(notification)}>
                <div className="text-sm font-medium">{notification.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{notification.message}</div>
              </Card>
            ))
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
