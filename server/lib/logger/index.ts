import type { LogLevel } from 'consola'
import { createConsola } from 'consola'

export type ILogger = ReturnType<typeof setupLogger>
export function setupLogger(config: { level: LogLevel, discordWebhookUrl?: string }) {
  const consola = createConsola({
    level: config.level,
    formatOptions: {
      date: true,
      colors: true,
    },
  })
  if (config.discordWebhookUrl !== undefined) {
    const discordWebhookUrl = config.discordWebhookUrl
    consola.addReporter({
      log(logObj) {
        if (logObj.type === 'fatal') {
        // SEND NOTIFICATION ON DISCORD
          $fetch(discordWebhookUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: {
              content: formatDiscordMessage(logObj),
            },
          })
        }
      },
    })
  }
  return consola
}

/**
 * Formats a log object into a Discord-friendly message format
 */
function formatDiscordMessage(logObj: any): string {
  // Format the message for Discord
  let formattedMessage = `**[${logObj.type.toUpperCase()}]** ${logObj.message || ''}\n`

  // If there's an error object, extract and format its details
  if (logObj.args && logObj.args.length > 0) {
    for (const arg of logObj.args) {
      if (arg instanceof Error) {
        formattedMessage += `\`\`\`\nError: ${arg.message}\nStack: ${arg.stack}\n\`\`\`\n`
      }
      else if (arg && typeof arg === 'object') {
        // Check if it's an AggregateError or has nested errors
        if (arg.errors && Array.isArray(arg.errors)) {
          formattedMessage += `\`\`\`\nAggregate Error: ${arg.message || ''}\nCode: ${arg.code || 'unknown'}\n`
          arg.errors.forEach((err: any, i: number) => {
            formattedMessage += `Error ${i + 1}: ${err.message || err}\n`
          })
          formattedMessage += `\`\`\`\n`
        }
        else {
          // For other objects
          formattedMessage += `\`\`\`json\n${JSON.stringify(arg, null, 2)}\n\`\`\`\n`
        }
      }
      else if (arg !== undefined) {
        formattedMessage += `${arg}\n`
      }
    }
  }

  // Ensure we don't exceed Discord's character limit (2000 chars)
  if (formattedMessage.length > 1900) {
    formattedMessage = `${formattedMessage.substring(0, 1900)}...\n(message truncated)`
  }

  return formattedMessage
}
