export interface INotificationPayload {
  userId?: string;
  email: string;
  subject: string;
  template: string;
  context: Record<string, any>;
}

export interface IPushNotificationPayload {
  userId: string;
  deviceToken: string;
  title: string;
  body: string;
  data?: Record<string, any>;
}
