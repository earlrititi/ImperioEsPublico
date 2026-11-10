import { inertMessage, redactedText } from "./communications-model";
import { normalizeEmail, validEmail } from "./newsletter-audience";

export type MailboxCursor = {uidvalidity: number|null; last_uid: number};
export type MailboxConfiguration = {id:string;mailbox:string;enabled:boolean;authorised_at:string|null;authorised_by:string|null;import_since:string;retention_days:number};
export type ImapMessage = {uid:number;messageId?:string;inReplyTo?:string;references?:string[];from:string;to:string[];subject:string;at:string;html?:string;text?:string;seen?:boolean;attachments?:Array<{name:string;size:number}>};
export type ImapPage = {uidvalidity:number;messages:ImapMessage[];deletedUids:number[];lastUid:number;hasMore:boolean;flagStateSynced:boolean};
// A future IMAP transport must implement read-only TLS itself. No outgoing Resend
// credential is accepted as mailbox access; no transport is installed or enabled.
export interface ReadOnlyImapTransport {
 readonly tls: true; readonly readOnly: true;
 readPage(input:{mailbox:string;afterUid:number;since:string;limit:number;signal?:AbortSignal}):Promise<ImapPage>;
}
export type MailboxCommit = {mailbox_id:string;expected_uidvalidity:number|null;expected_last_uid:number;uidvalidity:number;last_uid:number;messages:Record<string,unknown>[];deleted_uids:number[];synced_at:string};
const messageId = (value:unknown) => typeof value==="string"&&/^<[^<>\s@]{1,400}@[^<>\s]{1,400}>$/.test(value)?value:null;

export async function syncMailboxPage(config:MailboxConfiguration,cursor:MailboxCursor,transport:ReadOnlyImapTransport|null,commit:(batch:MailboxCommit)=>Promise<void>,now=new Date(),signal?:AbortSignal){
  if(!transport||!config.enabled)return {state:"not_connected" as const,synced:0,hasMore:false};
  if(!transport.tls||!transport.readOnly||!config.authorised_at||!config.authorised_by)throw Error("MAILBOX_NOT_AUTHORISED");
  if(!Number.isInteger(config.retention_days)||config.retention_days<1||config.retention_days>365||!Number.isFinite(Date.parse(config.import_since)))throw Error("MAILBOX_INVALID_SCOPE");
  const cutoff=new Date(Math.max(Date.parse(config.import_since),now.getTime()-config.retention_days*86400000)).toISOString();
  if(Date.parse(cutoff)>now.getTime())throw Error("MAILBOX_INVALID_SCOPE");
  const page=await transport.readPage({mailbox:config.mailbox,afterUid:cursor.last_uid,since:cutoff,limit:100,signal});
  if(!Number.isSafeInteger(page.uidvalidity)||page.uidvalidity<=0||!Number.isSafeInteger(page.lastUid)||page.lastUid<cursor.last_uid||page.messages.length>100||page.deletedUids.length>100)throw Error("MAILBOX_INVALID_PAGE");
  // A UID reset requires an explicit, scoped historical re-import. Never blindly
  // reuse the old cursor against a different mailbox generation.
  if(cursor.uidvalidity!==null&&cursor.uidvalidity!==page.uidvalidity)return {state:"reset_required" as const,synced:0,hasMore:false};
  const messages:Record<string,unknown>[]=[];
  for(const raw of page.messages){
    if(!Number.isSafeInteger(raw.uid)||raw.uid<1||raw.uid>page.lastUid||!Number.isFinite(Date.parse(raw.at)))throw Error("MAILBOX_INVALID_MESSAGE");
    if(Date.parse(raw.at)<Date.parse(cutoff)||Date.parse(raw.at)>now.getTime()+300000)continue;
    const sender=normalizeEmail(raw.from),recipients=[...new Set(raw.to.map(normalizeEmail))];
    if(!validEmail(sender)||!recipients.length||recipients.length>50||recipients.some(e=>!validEmail(e)))throw Error("MAILBOX_INVALID_MESSAGE");
    const preview=inertMessage(raw.html,raw.text);
    messages.push({uid:raw.uid,internet_message_id:messageId(raw.messageId),in_reply_to:messageId(raw.inReplyTo),references_ids:(raw.references??[]).map(messageId).filter(Boolean).slice(0,30),sender,recipients,
      subject:redactedText(raw.subject,500),safe_html:preview.html,safe_text:preview.text,occurred_at:new Date(raw.at).toISOString(),seen:page.flagStateSynced?Boolean(raw.seen):null,
      attachments:(raw.attachments??[]).slice(0,20).map(a=>({name:redactedText(a.name.split(/[\\/]/).pop(),180),size:Number.isSafeInteger(a.size)&&a.size>=0?a.size:0}))});
  }
  if(page.deletedUids.some(uid=>!Number.isSafeInteger(uid)||uid<1))throw Error("MAILBOX_INVALID_PAGE");
  await commit({mailbox_id:config.id,expected_uidvalidity:cursor.uidvalidity,expected_last_uid:cursor.last_uid,uidvalidity:page.uidvalidity,last_uid:page.lastUid,messages,deleted_uids:page.deletedUids,synced_at:now.toISOString()});
  return {state:"ready" as const,synced:messages.length,hasMore:page.hasMore};
}

export async function commitMailboxBatch(batch:MailboxCommit){
  const {rpc}=await import("./reservations");
  await rpc("commit_mailbox_read_batch",{p_batch:batch});
}
