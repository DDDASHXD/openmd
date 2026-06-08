export type WorkspaceDropHighlight =
  | { kind: 'root' }
  | { kind: 'folder'; path: string }
  | { kind: 'sibling-of-file'; filePath: string }

export const getWorkspaceParentDir = (filePath: string) => {
  const i = filePath.lastIndexOf('/')
  return i === -1 ? '' : filePath.slice(0, i)
}

export const getDropTargetDirectory = (h: WorkspaceDropHighlight): string => {
  switch (h.kind) {
    case 'root':
      return ''
    case 'folder':
      return h.path
    case 'sibling-of-file':
      return getWorkspaceParentDir(h.filePath)
    default:
      return ''
  }
}
