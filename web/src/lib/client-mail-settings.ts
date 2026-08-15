export type ClientMailSettings = {
  ccMemberUserIds: string[];
  ccEmails: string[];
};

export type ClientMailSettingsPayload = ClientMailSettings & {
  members: Array<{
    userId: string;
    email: string;
    displayName: string | null;
    role: string;
  }>;
};

export const DEFAULT_CLIENT_MAIL_SETTINGS: ClientMailSettings = {
  ccMemberUserIds: [],
  ccEmails: [],
};
