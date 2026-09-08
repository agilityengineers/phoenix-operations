export {
  accountScopes,
  clearStatusCache,
  domainAuthentication,
  emailStatus,
  isConfigured,
  isSandbox,
  listDomainAuthentication,
  sendEmail,
  validateDomainAuthentication,
  verifiedSenders,
} from "./client";
export { coveredByDomain, domainOf, mailDomain, orgName, senderFor, senderList, senders } from "./senders";
export { isSenderKey, SENDER_KEYS } from "./types";
export type {
  DnsRecord,
  DomainAuthentication,
  EmailAddress,
  EmailErrorCode,
  EmailMessage,
  EmailStatus,
  Recipient,
  Sender,
  SenderAuthentication,
  SenderKey,
  SenderStatus,
  SendGridResult,
  SendReceipt,
  VerifiedSender,
} from "./types";
