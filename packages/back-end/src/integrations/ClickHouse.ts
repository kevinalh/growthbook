import { ClickHouse as ClickHouseClient } from "clickhouse";
import { decryptDataSourceParams } from "../services/datasource";
import { ClickHouseConnectionParams } from "../../types/integrations/clickhouse";
import SqlIntegration from "./SqlIntegration";

export default class ClickHouse extends SqlIntegration {
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  params: ClickHouseConnectionParams;
  setParams(encryptedParams: string) {
    this.params = decryptDataSourceParams<ClickHouseConnectionParams>(
      encryptedParams
    );

    if (this.params.user) {
      this.params.username = this.params.user;
      delete this.params.user;
    }
    if (this.params.host) {
      this.params.url = this.params.host;
      delete this.params.host;
    }
  }
  getSensitiveParamKeys(): string[] {
    return ["password"];
  }
  async runQuery(sql: string) {
    const client = new ClickHouseClient({
      url: this.params.url,
      port: this.params.port,
      basicAuth: this.params.username
        ? {
            username: this.params.username,
            password: this.params.password,
          }
        : null,
      format: "json",
      debug: false,
      raw: false,
      config: {
        database: this.params.database,
      },
      reqParams: {
        headers: {
          "x-clickhouse-format": "JSON",
        },
      },
    });
    return Array.from(await client.query(sql).toPromise());
  }
  toTimestamp(date: Date) {
    return `toDateTime('${date
      .toISOString()
      .substr(0, 19)
      .replace("T", " ")}')`;
  }
  addTime(
    col: string,
    unit: "day" | "hour" | "minute",
    sign: "+" | "-",
    amount: number
  ): string {
    return `date${sign === "+" ? "Add" : "Sub"}(${unit}, ${amount}, ${col})`;
  }
  dateTrunc(col: string) {
    return `dateTrunc('day', ${col})`;
  }
  dateDiff(startCol: string, endCol: string) {
    return `dateDiff('day', ${startCol}, ${endCol})`;
  }
  stddev(col: string) {
    return `stddevSamp(${col})`;
  }
  formatDate(col: string): string {
    return `formatDateTime(${col}, '%F')`;
  }
  formatDateTimeString(col: string): string {
    return `formatDateTime(${col}, '%Y-%m-%d %H:%i:%S.%f')`;
  }
  ifElse(condition: string, ifTrue: string, ifFalse: string) {
    return `if(${condition}, ${ifTrue}, ${ifFalse})`;
  }
  castToString(col: string): string {
    return `toString(${col})`;
  }
  getDateTable(startDate: Date, endDate: Date | null): string {
    const startDateStr = this.castToDate(this.toTimestamp(startDate));
    return `
    SELECT
      ${startDateStr} + INTERVAL i DAY AS day
    FROM
    (
        SELECT arrayJoin(range(${
          endDate
            ? this.castToDate(this.toTimestamp(endDate))
            : this.currentDate()
        } - ${startDateStr} + 1)) AS i
    )
  `;
  }
  getInformationSchemaWhereClause(): string {
    if (!this.params.database)
      throw new Error(
        "No database name provided in ClickHouse connection. Please add a database by editing the connection settings."
      );
    return `table_schema IN ('${this.params.database}')`;
  }
}
