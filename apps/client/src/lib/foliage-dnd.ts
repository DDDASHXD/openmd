export const FOLIAGE_PATH_MIME = 'text/foliage-path'
export const FOLIAGE_SOURCE_GROUP_MIME = 'text/foliage-source-group'
/** Set to "1" for workspace tree directories, "0" for files; omitted for tab drags. */
export const FOLIAGE_IS_DIR_MIME = 'text/foliage-is-dir'

const FOLIAGE_TYPE_PREFIX = 'foliage:'

const getTransferTypes = (dataTransfer: DataTransfer) =>
  [...dataTransfer.types].map((type) => type.toLowerCase())

export const setFoliageDragData = (
  dataTransfer: DataTransfer,
  path: string,
  options: {
    sourceGroupId?: string
    isDirectory?: boolean
  } = {},
) => {
  dataTransfer.setData(FOLIAGE_PATH_MIME, path)
  dataTransfer.setData('text/plain', `${FOLIAGE_TYPE_PREFIX}${path}`)

  if (options.sourceGroupId) {
    dataTransfer.setData(FOLIAGE_SOURCE_GROUP_MIME, options.sourceGroupId)
  }

  if (options.isDirectory !== undefined) {
    dataTransfer.setData(FOLIAGE_IS_DIR_MIME, options.isDirectory ? '1' : '0')
  }
}

export const hasFoliagePath = (dataTransfer: DataTransfer) =>
  getTransferTypes(dataTransfer).includes(FOLIAGE_PATH_MIME) ||
  dataTransfer.getData('text/plain').startsWith(FOLIAGE_TYPE_PREFIX)

export const getFoliagePath = (dataTransfer: DataTransfer) => {
  const customPath = dataTransfer.getData(FOLIAGE_PATH_MIME)
  if (customPath) {
    return customPath
  }

  const plainPath = dataTransfer.getData('text/plain')
  return plainPath.startsWith(FOLIAGE_TYPE_PREFIX)
    ? plainPath.slice(FOLIAGE_TYPE_PREFIX.length)
    : ''
}

export const getFoliageSourceGroup = (dataTransfer: DataTransfer) => {
  const sourceGroupId = dataTransfer.getData(FOLIAGE_SOURCE_GROUP_MIME)
  return sourceGroupId.length > 0 ? sourceGroupId : null
}

export const isTreeDirectoryDrag = (dataTransfer: DataTransfer) =>
  dataTransfer.getData(FOLIAGE_IS_DIR_MIME) === '1'
