import { create } from 'zustand';

import { IAgent } from '@/types/agent';

/**
 * @file This file contains the Zustand store for managing agent-related state.
 * This store tracks which agents are available and which
 * one is currently active.
 */

/**
 * Defines the state and actions for the agent store.
 */
type FetchAgentByIdResult =
  | { ok: true; agent: IAgent }
  | {
      ok: false;
      reason: 'invalid_request' | 'not_found' | 'request_failed';
      message: string;
      status?: number;
    };

interface AgentStoreState {
  /** The full data object for the currently selected agent. */
  agent: IAgent | null;
  /** A list of all agents available on the platform, unfiltered. */
  allAgents: IAgent[];
  /** A list of agents owned by or available to the current user. */
  userAgents: IAgent[];

  /** The ID of the currently selected agent. */
  selectedAgent: number | null;
  /** A boolean controlling the visibility of the agent details popout sidebar. */
  popoutOpen: boolean;
  /** A counter that can be incremented to trigger a re-fetch of agent data. */
  fetchUpdateTrigger: number;
  /** A flag indicating if an agent's data is currently being loaded. */
  isLoading: boolean;
  /** The most recent agent loading error, if any. */
  error: string | null;
  /** A temporary store for agents that were recently created by the user. */
  newAgents: IAgent[];
  /** A boolean to control the main agent selection sidebar's visibility. */
  isSidebarOpen: boolean;
  // --- Actions ---
  /** Sets the complete list of all agents. */
  setAllAgents: (agents: IAgent[]) => void;

  /** Sets the list of agents available to the user. */
  setUserAgents: (agents: IAgent[]) => void;

  /**
   * Sets the specified agent as the currently selected one and triggers a fetch for its full data.
   * @param agentId The ID of the agent to select.
   * @param token Optional authentication token for fetching private agent data.
   */
  setSelectedAgent: (agentId: number, token?: string) => void;

  /** Sets the visibility state of the agent details popout. */
  setPopoutOpen: (open: boolean) => void;
  /** Increments the fetch trigger to force a refresh of agent data. */
  triggerFetchAgents: () => void;
  /** Sets the list of newly created agents. */
  setNewAgents: (newAgents: IAgent[]) => void;
  /** Sets the visibility state of the main agent sidebar. */
  setIsSidebarOpen: (isOpen: boolean) => void;
  /** Sets the global loading state for agent operations. */
  setIsLoading: (isLoading: boolean) => void;
  /** Sets or clears the agent loading error. */
  setError: (error: string | null) => void;
  /**
   * Inserts a new agent or updates an existing one in both `allAgents` and `userAgents` lists.
   * @param updatedAgent The agent data to insert or update.
   */
  setOneAgent: (updatedAgent: IAgent) => void;
  /** Hydrates the current agent from an embedded preview parent snapshot. */
  hydratePreviewAgent: (agent: IAgent) => void;

  /** Fetches the complete list of all public agents from the API and updates the store. */
  fetchAllAgents: () => Promise<void>;

  /**
   * Fetches the detailed data for a single agent by its ID and updates the `agent` state.
   * @param agentId The ID of the agent to fetch.
   * @param token Optional authentication token.
   */
  fetchAgentById: (
    agentId: number,
    token?: string
  ) => Promise<FetchAgentByIdResult>;

  /**
   * Finds an agent by its URL slug and sets it as the selected agent.
   * @param slug The URL-friendly slug of the agent.
   * @param skipTab A flag to prevent switching tabs (if applicable).
   */
  setSelectedAgentBySlug: (slug: string, skipTab?: boolean) => void;
}

/**
 * Zustand store for managing the application's agent state.
 * @see {@link AgentStoreState}
 */
const useAgentStore = create<AgentStoreState>((set, get) => ({
  agent: null,
  allAgents: [],
  userAgents: [],
  selectedAgent: null,
  popoutOpen: false,
  fetchUpdateTrigger: 0,
  isLoading: true,
  error: null,
  newAgents: [],
  isSidebarOpen: true,

  /** ======= SETTERS ======= */
  setAllAgents: (agents) => set(() => ({ allAgents: agents })),
  setUserAgents: (agents) => set(() => ({ userAgents: agents })),

  setSelectedAgent: (agentId: number, token?: string) => {
    set({
      selectedAgent: agentId,
      popoutOpen: true,
    });
    get().fetchAgentById(agentId, token);
  },

  setPopoutOpen: (open) => set(() => ({ popoutOpen: open })),

  triggerFetchAgents: () =>
    set((state) => ({ fetchUpdateTrigger: state.fetchUpdateTrigger + 1 })),

  setNewAgents: (newAgents) => set(() => ({ newAgents })),

  setIsSidebarOpen: (isOpen) => set(() => ({ isSidebarOpen: isOpen })),

  setIsLoading: (isLoading) =>
    set(() => ({
      isLoading,
    })),

  setError: (error) => set(() => ({ error })),

  /** Insert or update agent in both userAgents and allAgents. */
  setOneAgent: (updatedAgent) =>
    set((state) => {
      // update allAgents
      const newAll = state.allAgents.map((old) =>
        old.id === updatedAgent.id ? { ...old, ...updatedAgent } : old
      );
      const foundAll = newAll.some((a) => a.id === updatedAgent.id);
      if (!foundAll) {
        newAll.push(updatedAgent);
      }

      // update userAgents
      const newUser = state.userAgents.map((old) =>
        old.id === updatedAgent.id ? { ...old, ...updatedAgent } : old
      );
      const foundUser = newUser.some((a) => a.id === updatedAgent.id);
      if (!foundUser) {
        // only add if belongs to user
        // note: we can compare updatedAgent.user?.userId to the session user if needed
        newUser.push(updatedAgent);
      }

      return {
        allAgents: newAll,
        userAgents: newUser,
      };
    }),

  hydratePreviewAgent: (agent) =>
    set((state) => {
      const allAgents = state.allAgents.some((item) => item.id === agent.id)
        ? state.allAgents.map((item) =>
            item.id === agent.id ? { ...item, ...agent } : item
          )
        : [agent, ...state.allAgents];

      const userAgents = state.userAgents.some((item) => item.id === agent.id)
        ? state.userAgents.map((item) =>
            item.id === agent.id ? { ...item, ...agent } : item
          )
        : [agent, ...state.userAgents];

      return {
        agent,
        allAgents,
        error: null,
        isLoading: false,
        popoutOpen: true,
        selectedAgent: agent.id,
        userAgents,
      };
    }),

  async fetchAgentById(agentId: number, token?: string) {
    if (!agentId) {
      const message = 'No agent ID supplied, skipping fetchAgentById';
      console.warn(message);
      set({ error: message, isLoading: false });
      return { ok: false, reason: 'invalid_request', message };
    }

    set({ isLoading: true, error: null });

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/agent/ms-agent/${agentId}`, {
        method: 'GET',
        headers,
      });
      if (!res.ok) {
        const errorText = await res.text();
        let message = `Failed to fetch agent ${agentId}`;
        try {
          const payload = JSON.parse(errorText) as { message?: string };
          message = payload.message ?? message;
        } catch {
          message = errorText || message;
        }

        console.error('fetchAgentById: fetch failed =>', message, res.status);
        set({ agent: null, error: message });
        return {
          ok: false,
          reason: res.status === 404 ? 'not_found' : 'request_failed',
          message,
          status: res.status,
        };
      }
      const data = await res.json();
      // Adjusting based on potential API response structures
      const newAgent: IAgent | null =
        data?.agent || data?.data?.agent || data?.data || null;
      if (!newAgent) {
        const message = `No agent data found in response for ID: ${agentId}`;
        console.warn(message);
        set({ agent: null, error: message });
        return { ok: false, reason: 'not_found', message };
      }

      set(() => ({ agent: newAgent, error: null }));
      get().setOneAgent(newAgent);
      return { ok: true, agent: newAgent };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown error fetching agent';
      console.error('Error in fetchAgentById:', err);
      set({ agent: null, error: message });
      return { ok: false, reason: 'request_failed', message };
    } finally {
      set({ isLoading: false });
    }
  },

  async fetchAllAgents() {
    try {
      const apiUrl = `/api/agent/ms-agent`;
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const { data } = await response.json();

      // data should be the entire array of agents
      set(() => ({ allAgents: data }));
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    }
  },

  setSelectedAgentBySlug: (slug: string, _skipTab?: boolean) => {
    const { allAgents } = get();
    if (!Array.isArray(allAgents) || allAgents.length === 0) {
      console.warn('[useAgentStore] setSelectedAgentBySlug: no allAgents yet');
      return;
    }
    const found = allAgents.find((agent) => agent.slug === slug);
    if (found) {
      set({
        selectedAgent: found.id,
        popoutOpen: true,
      });
    } else {
      console.warn('[useAgentStore] No agent found for slug =>', slug);
    }
  },
}));

export default useAgentStore;
