declare module "sql.js" {
  export type QueryResult = { columns: string[]; values: unknown[][] }
  export class Database {
    exec(sql: string): QueryResult[]
    close(): void
  }
  type InitSqlJs = (config?: { locateFile?: (file: string) => string }) => Promise<{ Database: new () => Database }>
  const initSqlJs: InitSqlJs
  export default initSqlJs
}
