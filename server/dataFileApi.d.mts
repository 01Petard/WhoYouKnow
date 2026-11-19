export interface DataFileApiOptions {
  /** 数据文件绝对路径；默认读取 LINKMAP_DATA_FILE 或 data/linkmap.json */
  dataFile?: string
  /** 对外展示的路径；默认取 LINKMAP_DATA_FILE 原值或 data/linkmap.json */
  label?: string
  /** 读取环境变量时使用；默认 process.env */
  env?: NodeJS.ProcessEnv
}

export interface DataFileApi {
  dataFile: string
  label: string
  /** 已处理返回 true；非本项目 API 返回 false，调用方继续处理静态资源 */
  handle(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse): Promise<boolean>
}

export function createDataFileApi(options?: DataFileApiOptions): DataFileApi
