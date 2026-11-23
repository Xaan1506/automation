import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SubjectSelection {
  subjectId: string;
  selected: boolean;
}

export interface AssignmentSelection {
  assignmentId: string;
  subjectId: string;
  selected: boolean;
}

interface SelectionStore {
  // Subject selections (persisted)
  selectedSubjectIds: Set<string>;
  toggleSubject: (id: string) => void;
  selectAllSubjects: (ids: string[]) => void;
  deselectAllSubjects: () => void;
  isSubjectSelected: (id: string) => boolean;

  // Assignment selections (persisted)
  selectedAssignmentIds: Set<string>;
  toggleAssignment: (id: string) => void;
  selectAllAssignments: (ids: string[]) => void;
  deselectAllAssignments: (subjectId?: string, assignmentIds?: string[]) => void;
  isAssignmentSelected: (id: string) => boolean;

  // Batch creation state
  batchName: string;
  setBatchName: (name: string) => void;

  // Reset
  clearAll: () => void;
}

// Zustand doesn't natively serialize Sets, so we store as arrays and convert
interface PersistedState {
  selectedSubjectIds: string[];
  selectedAssignmentIds: string[];
  batchName: string;
}

export const useSelectionStore = create<SelectionStore>()(
  persist(
    (set, get) => ({
      selectedSubjectIds: new Set<string>(),
      selectedAssignmentIds: new Set<string>(),
      batchName: '',

      toggleSubject: (id) =>
        set((state) => {
          const next = new Set(state.selectedSubjectIds);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return { selectedSubjectIds: next };
        }),

      selectAllSubjects: (ids) =>
        set({ selectedSubjectIds: new Set(ids) }),

      deselectAllSubjects: () =>
        set({ selectedSubjectIds: new Set() }),

      isSubjectSelected: (id) => get().selectedSubjectIds.has(id),

      toggleAssignment: (id) =>
        set((state) => {
          const next = new Set(state.selectedAssignmentIds);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return { selectedAssignmentIds: next };
        }),

      selectAllAssignments: (ids) =>
        set((state) => {
          const next = new Set(state.selectedAssignmentIds);
          ids.forEach((id) => next.add(id));
          return { selectedAssignmentIds: next };
        }),

      deselectAllAssignments: (subjectId?, assignmentIds?) =>
        set((state) => {
          if (!assignmentIds) {
            return { selectedAssignmentIds: new Set() };
          }
          const next = new Set(state.selectedAssignmentIds);
          assignmentIds.forEach((id) => next.delete(id));
          return { selectedAssignmentIds: next };
        }),

      isAssignmentSelected: (id) => get().selectedAssignmentIds.has(id),

      setBatchName: (name) => set({ batchName: name }),

      clearAll: () =>
        set({
          selectedSubjectIds: new Set(),
          selectedAssignmentIds: new Set(),
          batchName: '',
        }),
    }),
    {
      name: 'newton-selection-store',
      storage: {
        getItem: (key) => {
          const item = localStorage.getItem(key);
          if (!item) return null;
          const parsed: { state: PersistedState; version: number } = JSON.parse(item);
          return {
            ...parsed,
            state: {
              ...parsed.state,
              selectedSubjectIds: new Set(parsed.state.selectedSubjectIds || []),
              selectedAssignmentIds: new Set(parsed.state.selectedAssignmentIds || []),
            },
          };
        },
        setItem: (key, value) => {
          const toStore = {
            ...value,
            state: {
              ...value.state,
              selectedSubjectIds: Array.from(value.state.selectedSubjectIds),
              selectedAssignmentIds: Array.from(value.state.selectedAssignmentIds),
            },
          };
          localStorage.setItem(key, JSON.stringify(toStore));
        },
        removeItem: (key) => localStorage.removeItem(key),
      },
    }
  )
);

// Separate store for UI state (not persisted)
interface UIStore {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  currentPage: string;
  setCurrentPage: (page: string) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: true,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  currentPage: 'overview',
  setCurrentPage: (page) => set({ currentPage: page }),
}));
