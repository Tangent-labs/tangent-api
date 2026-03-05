import { MonitoringModuleName, ALL_MODULES, MODULE_CONFIG, ModuleFilters } from "./monitoring.types.js"

export interface ParsedMonitoringQuery {
  requestedModules: MonitoringModuleName[]
  isSingleModule: boolean
  refresh: boolean
  globalFilters: Record<string, string | number>
  perModuleOverrides: Record<string, Record<string, string | number>>
}

export function parseMonitoringQuery(query: Record<string, string | number>): ParsedMonitoringQuery {
  const modulesParam = (query.modules as string) || "all"
  const requestedModules: MonitoringModuleName[] =
    modulesParam === "all"
      ? [...ALL_MODULES]
      : (modulesParam.split(",").filter((m) => ALL_MODULES.includes(m as MonitoringModuleName)) as MonitoringModuleName[])

  const isSingleModule = requestedModules.length === 1
  const refresh = query.refresh === "true"

  const globalFilters: Record<string, string | number> = {}
  const perModuleOverrides: Record<string, Record<string, string | number>> = {}
  const GLOBAL_KEYS = ["market_address", "borrower_address", "status", "offset", "limit", "asset"]

  for (const [key, value] of Object.entries(query)) {
    if (["modules", "refresh"].includes(key)) continue
    const dotIndex = key.indexOf(".")
    if (dotIndex > 0) {
      const mod = key.slice(0, dotIndex)
      const param = key.slice(dotIndex + 1)
      if (!perModuleOverrides[mod]) perModuleOverrides[mod] = {}
      perModuleOverrides[mod][param] = value
    } else if (GLOBAL_KEYS.includes(key)) {
      globalFilters[key] = value
    }
  }

  return { requestedModules, isSingleModule, refresh, globalFilters, perModuleOverrides }
}

export function resolveFiltersForModule(moduleName: MonitoringModuleName, parsed: ParsedMonitoringQuery): ModuleFilters {
  // default configuration
  const config = MODULE_CONFIG[moduleName]
  const isPaginated = config.paginated

  // overrides from the URL
  const overrides = parsed.perModuleOverrides[moduleName] || {}

  const resolved: ModuleFilters = {
    offset: 0,
    limit: parsed.isSingleModule ? 50 : 10,
  }

  for (const key of config.filters) {
    if (key in parsed.globalFilters) {
      Object.assign(resolved, { [key]: parsed.globalFilters[key] })
    }
  }

  if (isPaginated) {
    if ("offset" in parsed.globalFilters) resolved.offset = Number(parsed.globalFilters.offset)
    if ("limit" in parsed.globalFilters) resolved.limit = Number(parsed.globalFilters.limit)
  }

  const VALID_FILTER_KEYS: Set<string> = new Set(["market_address", "borrower_address", "status", "offset", "limit", "sort_by", "period", "asset"])
  for (const [key, value] of Object.entries(overrides)) {
    if (VALID_FILTER_KEYS.has(key)) {
      Object.assign(resolved, { [key]: value })
    }
  }

  resolved.offset = Number(resolved.offset)
  resolved.limit = Number(resolved.limit)

  return resolved
}
