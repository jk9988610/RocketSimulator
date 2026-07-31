export const BUILD_ID = __BUILD_ID__
export const BUILD_TIME = __BUILD_TIME__

export function formatBuildLabel(): string {
  return `构建 ${BUILD_ID}`
}

export function formatBuildTooltip(): string {
  return `版本 ${BUILD_ID}\n构建时间 ${BUILD_TIME}`
}
