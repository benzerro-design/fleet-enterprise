export type TenantMailSettings = {
  fromName: string | null;
  replyTo: string | null;
  signature: string | null;
  defaultCcEmails: string[];
  ccMemberUserIds: string[];
  ccActorOnSend: boolean;
};

export const DEFAULT_TENANT_MAIL_SETTINGS: TenantMailSettings = {
  fromName: null,
  replyTo: null,
  signature: null,
  defaultCcEmails: [],
  ccMemberUserIds: [],
  ccActorOnSend: false,
};

export const mailSettingsBrowserBase = "/api/tenant/mail-settings";
