import { Mastra } from '@mastra/core'
import { DefaultExporter, Observability, SensitiveDataFilter } from '@mastra/observability'
import { PostgresStore } from '@mastra/pg'

export type IAI = ReturnType<typeof setupAI>
export function setupAI(config: { connectionString: string, isDev: boolean }) {
  return new Mastra({
    agents: {},
    tools: {},
    workflows: {},
    storage: new PostgresStore({
      id: 'mastra-pg-storage',
      connectionString: config.connectionString,
      schemaName: 'mastra',
    }),
    ...(config.isDev && {
      observability: new Observability({
        configs: {
          default: {
            serviceName: 'mastra',
            exporters: [new DefaultExporter()],
            spanOutputProcessors: [new SensitiveDataFilter()],
          },
        },
      }),
    }),
  })
}
