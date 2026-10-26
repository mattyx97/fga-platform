import type { Transport, Transporter, TransportOptions } from 'nodemailer'
import type JSONTransport from 'nodemailer/lib/json-transport'
import type SendmailTransport from 'nodemailer/lib/sendmail-transport'
import type SESTransport from 'nodemailer/lib/ses-transport'
import type SMTPPool from 'nodemailer/lib/smtp-pool'
import type SMTPTransport from 'nodemailer/lib/smtp-transport'
import type StreamTransport from 'nodemailer/lib/stream-transport'
import type { MailTransportContract, NodeMailerMessage } from '../types'
import nodemailer from 'nodemailer'

export type NodeMailerTransportOptions
  = | { transport: SMTPPool | SMTPPool.Options, defaults?: SMTPPool.Options }
    | { transport: SendmailTransport | SendmailTransport.Options, defaults?: SendmailTransport.Options }
    | { transport: StreamTransport | StreamTransport.Options, defaults?: StreamTransport.Options }
    | { transport: JSONTransport | JSONTransport.Options, defaults?: JSONTransport.Options }
    | { transport: SESTransport | SESTransport.Options, defaults?: SESTransport.Options }
    | { transport?: SMTPTransport | SMTPTransport.Options | string, defaults?: SMTPTransport.Options }
    | { transport: Transport<any> | TransportOptions, defaults?: TransportOptions }

export class NodeMailerTransport implements MailTransportContract {
  name = 'nodemailer'
  version = '1.0.0'
  from: string

  #transporter?: Transporter

  constructor(private readonly options: NodeMailerTransportOptions & { from: string }) {
    this.from = options.from
  }

  async send(message: NodeMailerMessage): Promise<void> {
    await this.#getTransport().sendMail(message)
  }

  #getTransport() {
    return this.#transporter ??= nodemailer.createTransport(this.options.transport, this.options.defaults)
  }

  close(): void {
    this.#transporter?.close()
    this.#transporter = undefined
  }
}
