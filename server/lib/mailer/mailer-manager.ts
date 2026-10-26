import type * as emails from './templates'
import type { ExtractComponentProps, MailTransportContract, MailTransportContractFactory, Recipient } from './types'

export class MailerManager<KnownMailers extends Record<string, MailTransportContractFactory>> {
  #mailersCache: Partial<Record<keyof KnownMailers, MailSender<MailTransportContract>>> = {}

  constructor(private readonly config: {
    default: keyof KnownMailers
    transports: KnownMailers
  }) {}

  async send<Name extends keyof typeof emails>(
    name: Name,
    opts: {
      to: Recipient | Recipient[]
      data: ExtractComponentProps<typeof emails[Name]>
      from?: string
    },
  ) {
    return this.use().send(name, opts)
  }

  use<K extends keyof KnownMailers>(mailerName?: K): MailSender<ReturnType<KnownMailers[K]>> {
    const mailerToUse: keyof KnownMailers | undefined = mailerName || this.config.default

    if (!mailerToUse) {
      throw new Error(
        'Cannot create mailer instance. No default mailer is defined in the config',
      )
    }
    if (!this.config.transports[mailerToUse]) {
      throw new Error(
        `Unknown mailer "${String(mailerToUse)}". Make sure it is configured inside the config file`,
      )
    }

    return (this.#mailersCache[mailerToUse] ??= new MailSender(this.config.transports[mailerToUse]())) as MailSender<ReturnType<KnownMailers[K]>>
  }

  /**
   * Clear mailer from cache and close its transport
   */
  async close<K extends keyof KnownMailers>(mailerName: K) {
    const mailer = this.#mailersCache[mailerName]!
    if (mailer) {
      await mailer.close()
      delete this.#mailersCache[mailerName]
    }
  }

  /**
   * Clear all mailers from cache and close their transports
   */
  async closeAll() {
    await Promise.all(Object.keys(this.#mailersCache).map(mailerName => this.close(mailerName)))
  }
}

export class MailSender<Transport extends MailTransportContract> {
  constructor(private readonly transport: Transport) {}

  async send<Name extends keyof typeof emails>(
    name: Name,
    opts: {
      to: Recipient | Recipient[]
      data: ExtractComponentProps<typeof emails[Name]>
      /**
       * Override the default from address
       */
      from?: string
    },
  ) {
    const content = await renderEmailComponent(name, opts.data)
    if (typeof content === 'string') {
      // Subject is missing in the template
      throw new TypeError('Subject is missing in the template')
    }

    return this.transport.send({
      to: Array.isArray(opts.to) ? opts.to : [opts.to],
      from: opts.from || this.transport.from,
      subject: content.subject,
      html: content.html,
    })
  }

  /**
   * Invokes `close` method on the transport
   */
  async close() {
    await this.transport.close?.()
  }
}
