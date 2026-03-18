// src/components/AppSidebar.tsx
"use client"

import * as React from "react"
import { NavLink } from "react-router-dom"
import { IconGauge, IconBell } from "@tabler/icons-react"

import useAuth from "@/hooks/useAuth"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Inbox } from "lucide-react"
import { cn } from "@/lib/utils"

import { notificationService, type BackendNotification } from "@/api/notification"
import initEcho from "@/api/echo"

/* -------------------- Notifications panel -------------------- */

type NoticeType = "info" | "success" | "warning" | "error"

type Notice = {
  id: string
  title: string
  description?: string
  time?: string
  unread?: boolean
  type?: NoticeType
  rawId: string
}

const formatTimeAgo = (dateString: string) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('fr-FR', { 
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' 
  }).format(date);
};

const mapType = (backendType: string): NoticeType => {
  if (backendType === 'new_order' || backendType === 'info') return 'info';
  if (backendType === 'confirmed' || backendType === 'completed') return 'success';
  if (backendType === 'in_progress') return 'warning';
  if (backendType === 'cancelled') return 'error';
  return 'info';
};

function EmptyState({
  title = "Aucune notification",
  description = "Tout est calme pour le moment.",
}: { title?: string; description?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <div className="p-3 rounded-full ring-1 ring-border">
        <Inbox className="w-5 h-5" />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { user } = useAuth()
  const role = (user?.role ?? "").toString().toLowerCase()
  const isAdmin = role === "admin" || role === "superadmin" || role === "agent"

  const [notifications, setNotifications] = React.useState<Notice[]>([])
  const unreadCount = notifications.filter((n) => n.unread).length

  // 1. Initial HTTP Fetch
  const fetchNotifications = React.useCallback(async () => {
    if (!isAdmin) return;
    const res = await notificationService.getNotifications();
    if (res && res.data) {
      const formattedNotices: Notice[] = res.data.map((n: BackendNotification) => ({
        id: n.id,
        rawId: n.id,
        title: n.data.title || "Mise à jour",
        description: n.data.message,
        time: formatTimeAgo(n.created_at),
        unread: n.read_at === null,
        type: mapType(n.data.type || 'info'),
      }));
      setNotifications(formattedNotices);
    }
  }, [isAdmin]);

  // Load via HTTP on mount
  React.useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // 2. Real-time WebSocket Listener
  React.useEffect(() => {
    if (!isAdmin || !user?.id) return;

    const echo = initEcho();
    if (!echo) return;

    // Laravel natively broadcasts to App.Models.User.{id}
    const channelName = `App.Models.User.${user.id}`;

    echo.private(channelName)
      .notification((notification: any) => {
        // 'notification' will contain the payload we defined in toBroadcast()
        const newNotice: Notice = {
          id: notification.id,
          rawId: notification.id,
          title: notification.data?.title || "Mise à jour",
          description: notification.data?.message,
          time: "À l'instant", // Feels instant and highly responsive
          unread: true,
          type: mapType(notification.data?.type || 'info'),
        };

        // Unshift pushes the new notification to the very top
        setNotifications((prev) => [newNotice, ...prev]);
        
        // Optional: Play a sound effect here for the dispatcher!
      });

    // Cleanup: Unsubscribe when the component unmounts
    return () => {
      echo.leave(channelName);
    };
  }, [isAdmin, user?.id]);

  const markAllRead = async () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, unread: false })));
    await notificationService.markAllAsRead();
  }

  const markSingleAsRead = async (id: string) => {
    const notice = notifications.find(n => n.id === id);
    if (!notice || !notice.unread) return;

    setNotifications((prev) => 
      prev.map((n) => (n.id === id ? { ...n, unread: false } : n))
    );
    await notificationService.markAsRead(id);
  }

  return (
    <Sidebar
      collapsible="offcanvas"
      className="w-[68px] border-r h-screen sticky top-0"
      {...props}
    >
      <SidebarHeader className="p-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="justify-center p-2">
              <NavLink to="/" aria-label="Accueil">
                <img
                  src="/assets/images/logo.png"
                  alt="Mova"
                  width={50}
                  height={50}
                  className="mx-auto rounded-md"
                />
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-0">
        <SidebarMenu className="gap-1">
          {isAdmin && (
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                className="justify-center p-2"
                tooltip="Tableau de bord"
              >
                <NavLink to="/overview" aria-label="Tableau de bord" title="Tableau de bord">
                  <IconGauge className="w-5 h-5" />
                  <span className="sr-only">Tableau de bord</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarContent>

      <SidebarFooter className="p-2 mt-auto">
        <SidebarMenu className="gap-1">
          <SidebarMenuItem>
            <Popover onOpenChange={(open) => {
              if (open) fetchNotifications();
            }}>
              <PopoverTrigger asChild>
                <SidebarMenuButton
                  className="relative justify-center p-2"
                  aria-label="Notifications"
                  title="Notifications"
                  tooltip="Notifications"
                >
                  <IconBell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[8px] text-white">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                  <span className="sr-only">Notifications</span>
                </SidebarMenuButton>
              </PopoverTrigger>
              <PopoverContent
                side="right"
                align="start"
                sideOffset={8}
                className="p-0 w-80"
              >
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">Notifications</p>
                    <p className="text-xs text-muted-foreground">
                      {unreadCount > 0 ? `${unreadCount} non lue(s)` : "Aucune non lue"}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                    onClick={markAllRead}
                    disabled={unreadCount === 0}
                  >
                    
                    Tout marquer lu
                  </button>
                </div>

                {notifications.length === 0 ? (
                  <EmptyState />
                ) : (
                  <ScrollArea className="max-h-80">
                    <ul className="divide-y">
                      {notifications.map((n) => (
                        <li
                          key={n.id}
                          onClick={() => markSingleAsRead(n.id)}
                          className={cn(
                            "flex items-start gap-3 p-4 transition-colors hover:bg-accent/40 cursor-pointer",
                            n.unread && "bg-accent/20"
                          )}
                        >
                          <div className="pt-0.5">
                            <Badge
                              variant={
                                n.type === "success"
                                  ? "default"
                                  : n.type === "warning"
                                  ? "secondary"
                                  : n.type === "error"
                                  ? "destructive"
                                  : "outline"
                              }
                              className="text-[10px]"
                            >
                              {n.type ?? "info"}
                            </Badge>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn("text-sm leading-5", n.unread ? "font-bold" : "font-medium text-muted-foreground")}>{n.title}</p>
                            {n.description && (
                              <p className={cn("mt-0.5 line-clamp-2 text-xs", n.unread ? "text-foreground" : "text-muted-foreground")}>
                                {n.description}
                              </p>
                            )}
                            <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground">
                              {n.time && <span>{n.time}</span>}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </ScrollArea>
                )}
              </PopoverContent>
            </Popover>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <NavUser />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
