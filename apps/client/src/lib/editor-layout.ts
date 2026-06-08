export type EditorSide = 'left' | 'right' | 'top' | 'bottom'

export type LayoutLeaf = { type: 'leaf'; groupId: string }

export type LayoutSplit = {
  type: 'split'
  orientation: 'horizontal' | 'vertical'
  first: LayoutNode
  second: LayoutNode
}

export type LayoutNode = LayoutLeaf | LayoutSplit

export const createInitialLayout = (rootGroupId: string): LayoutNode => ({
  type: 'leaf',
  groupId: rootGroupId,
})

export const splitLeaf = (
  root: LayoutNode,
  targetGroupId: string,
  side: EditorSide,
  newGroupId: string,
): LayoutNode | null => {
  if (root.type === 'leaf') {
    if (root.groupId !== targetGroupId) {
      return null
    }
    const newLeaf: LayoutLeaf = { type: 'leaf', groupId: newGroupId }
    return mergeSide(side, root, newLeaf)
  }

  const nextFirst = splitLeaf(root.first, targetGroupId, side, newGroupId)
  if (nextFirst) {
    return { ...root, first: nextFirst }
  }

  const nextSecond = splitLeaf(root.second, targetGroupId, side, newGroupId)
  if (nextSecond) {
    return { ...root, second: nextSecond }
  }

  return null
}

const mergeSide = (
  side: EditorSide,
  oldLeaf: LayoutLeaf,
  newLeaf: LayoutLeaf,
): LayoutSplit => {
  switch (side) {
    case 'left':
      return {
        type: 'split',
        orientation: 'horizontal',
        first: newLeaf,
        second: oldLeaf,
      }
    case 'right':
      return {
        type: 'split',
        orientation: 'horizontal',
        first: oldLeaf,
        second: newLeaf,
      }
    case 'top':
      return {
        type: 'split',
        orientation: 'vertical',
        first: newLeaf,
        second: oldLeaf,
      }
    case 'bottom':
      return {
        type: 'split',
        orientation: 'vertical',
        first: oldLeaf,
        second: newLeaf,
      }
  }
}

export type EditorGroupState = {
  openFiles: { path: string; name: string }[]
  activeFile: string | null
}

export const remapPathsInGroups = (
  groups: Record<string, EditorGroupState>,
  remap: (path: string) => string,
): Record<string, EditorGroupState> => {
  const next: Record<string, EditorGroupState> = {}
  for (const [id, g] of Object.entries(groups)) {
    next[id] = {
      openFiles: g.openFiles.map((f) => ({
        ...f,
        path: remap(f.path),
      })),
      activeFile: g.activeFile ? remap(g.activeFile) : null,
    }
  }
  return next
}

export const hasAnyOpenEditor = (groups: Record<string, EditorGroupState>) =>
  Object.values(groups).some((g) => g.openFiles.length > 0)

export const countLeaves = (node: LayoutNode): number => {
  if (node.type === 'leaf') {
    return 1
  }
  return countLeaves(node.first) + countLeaves(node.second)
}

export const collectLeafGroupIds = (node: LayoutNode): string[] => {
  if (node.type === 'leaf') {
    return [node.groupId]
  }
  return [...collectLeafGroupIds(node.first), ...collectLeafGroupIds(node.second)]
}

export const getFirstLeafGroupId = (node: LayoutNode): string => {
  if (node.type === 'leaf') {
    return node.groupId
  }
  return getFirstLeafGroupId(node.first)
}

/** Removes the leaf with the given groupId. Returns null only when the root is that leaf. */
export const removeLeafGroupNode = (node: LayoutNode, groupId: string): LayoutNode | null => {
  if (node.type === 'leaf') {
    return node.groupId === groupId ? null : node
  }

  const first = removeLeafGroupNode(node.first, groupId)
  const second = removeLeafGroupNode(node.second, groupId)

  if (first === null && second === null) {
    return null
  }
  if (first === null) {
    return second
  }
  if (second === null) {
    return first
  }

  return { ...node, first, second }
}
