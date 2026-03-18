import apiService from "./apiService";

export interface NotificationPayload {
  title: string;
  message: string;
  type: string;
  status_color?: string;
  order_id?: number;
  reservation_id?: number;
}

export interface BackendNotification {
  id: string;
  type: string;
  notifiable_type: string;
  notifiable_id: number;
  data: NotificationPayload;
  read_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface NotificationResponse {
  data: BackendNotification[];
  meta: {
    current_page: number;
    last_page: number;
    unread_count: number;
  };
}

export const notificationService = {
  /** Fetch the latest notifications */
  async getNotifications(): Promise<NotificationResponse | null> {
    try {
      const response = await apiService.get<NotificationResponse>("/notifications");
      return response.data;
    } catch (error) {
      console.error("Failed to fetch notifications:", error);
      return null;
    }
  },

  /** Mark a single notification as read */
  async markAsRead(id: string): Promise<boolean> {
    try {
      await apiService.patch(`/notifications/${id}/read`);
      return true;
    } catch (error) {
      console.error("Failed to mark notification as read:", error);
      return false;
    }
  },

  /** Mark all notifications as read */
  async markAllAsRead(): Promise<boolean> {
    try {
      await apiService.post("/notifications/mark-all-read");
      return true;
    } catch (error) {
      console.error("Failed to mark all as read:", error);
      return false;
    }
  },
};

export default notificationService;