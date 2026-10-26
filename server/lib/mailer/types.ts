import type { SendMailOptions } from 'nodemailer'
import type { AllowedComponentProps, VNodeProps } from 'vue'

export type ExtractComponentProps<TComponent> = TComponent extends new () => {
  $props: infer P
}
  ? Omit<P, keyof VNodeProps | keyof AllowedComponentProps>
  : never

export interface MailTransportContract {
  from: string

  /**
   * Send email
   */
  send: (message: NodeMailerMessage, config?: unknown) => Promise<void>

  /**
   * Cleanup transport long-lived connections
   */
  close?: () => void | Promise<void>
}

export type MailTransportContractFactory = () => MailTransportContract

export interface NodeMailerMessage {
  from?: Recipient
  to?: Recipient[]
  cc?: Recipient[]
  bcc?: Recipient[]
  replyTo?: Recipient[]
  messageId?: SendMailOptions['messageId']
  subject?: SendMailOptions['subject']
  inReplyTo?: SendMailOptions['inReplyTo']
  references?: SendMailOptions['references']
  encoding?: SendMailOptions['encoding']
  priority?: SendMailOptions['priority']
  envelope?: SendMailOptions['envelope']
  list?: SendMailOptions['list']
  icalEvent?: SendMailOptions['icalEvent'] & {
    content?: string
    path?: string
    href?: string
  }
  attachments?: SendMailOptions['attachments']
  headers?: SendMailOptions['headers']
  html?: SendMailOptions['html']
  text?: SendMailOptions['text']
  watch?: SendMailOptions['watchHtml']
}

export type Recipient = { address: string, name: string } | string
