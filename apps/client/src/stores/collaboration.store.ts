import { create } from 'zustand'

export type Collaborator = {
  id: number
  name: string
  color: string
  isLocal: boolean
}

export type ConnectionStatus = 'connected' | 'connecting' | 'disconnected'

interface CollaborationStore {
  collaborators: Collaborator[]
  connectionStatus: ConnectionStatus
  setCollaborators: (collaborators: Collaborator[]) => void
  setConnectionStatus: (connectionStatus: ConnectionStatus) => void
}

export const useCollaborationStore = create<CollaborationStore>()((set) => ({
  collaborators: [],
  connectionStatus: 'disconnected',
  setCollaborators: (collaborators) => set({ collaborators }),
  setConnectionStatus: (connectionStatus) => set({ connectionStatus }),
}))
