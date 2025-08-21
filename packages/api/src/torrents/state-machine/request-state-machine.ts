import { Injectable, Logger } from '@nestjs/common';
import { RequestStatus } from '../../../generated/prisma';

export interface StateTransitionContext {
  requestId: string;
  currentStatus: RequestStatus;
  targetStatus: RequestStatus;
  metadata?: Record<string, any>;
  reason?: string;
}

export interface StateTransitionResult {
  success: boolean;
  newStatus: RequestStatus;
  actions: StateAction[];
  error?: string;
}

export interface StateAction {
  type: string;
  payload?: Record<string, any>;
}

export interface TransitionGuard {
  canTransition(context: StateTransitionContext): Promise<boolean> | boolean;
  reason?: string;
}

export interface StateHandler {
  onEnter?(context: StateTransitionContext): Promise<StateAction[]> | StateAction[];
  onExit?(context: StateTransitionContext): Promise<StateAction[]> | StateAction[];
}

@Injectable()
export class RequestStateMachine {
  private readonly logger = new Logger(RequestStateMachine.name);

  // Define valid state transitions
  private readonly validTransitions: Map<RequestStatus, RequestStatus[]> = new Map([
    [RequestStatus.PENDING, [RequestStatus.SEARCHING, RequestStatus.CANCELLED, RequestStatus.EXPIRED]],
    [RequestStatus.SEARCHING, [RequestStatus.FOUND, RequestStatus.PENDING, RequestStatus.CANCELLED, RequestStatus.EXPIRED]],
    [RequestStatus.FOUND, [RequestStatus.DOWNLOADING, RequestStatus.SEARCHING, RequestStatus.CANCELLED, RequestStatus.EXPIRED]],
    [RequestStatus.DOWNLOADING, [RequestStatus.COMPLETED, RequestStatus.FAILED, RequestStatus.CANCELLED, RequestStatus.PENDING]],
    [RequestStatus.FAILED, [RequestStatus.SEARCHING, RequestStatus.CANCELLED, RequestStatus.EXPIRED]],
    [RequestStatus.CANCELLED, [RequestStatus.PENDING, RequestStatus.SEARCHING]],
    [RequestStatus.EXPIRED, [RequestStatus.SEARCHING]],
    [RequestStatus.COMPLETED, []], // Final state - no transitions allowed
  ]);

  // State transition guards
  private readonly guards: Map<string, TransitionGuard> = new Map();

  // State handlers
  private readonly stateHandlers: Map<RequestStatus, StateHandler> = new Map();

  constructor() {
    this.initializeGuards();
    this.initializeStateHandlers();
  }

  /**
   * Attempt to transition a request from one state to another
   */
  async transition(context: StateTransitionContext): Promise<StateTransitionResult> {
    const { currentStatus, targetStatus, requestId } = context;

    this.logger.debug(`Attempting transition for request ${requestId}: ${currentStatus} → ${targetStatus}`);

    // Check if transition is valid
    if (!this.isValidTransition(currentStatus, targetStatus)) {
      return {
        success: false,
        newStatus: currentStatus,
        actions: [],
        error: `Invalid transition from ${currentStatus} to ${targetStatus}`,
      };
    }

    // Check transition guards
    const guardKey = `${currentStatus}_to_${targetStatus}`;
    const guard = this.guards.get(guardKey);
    if (guard && !(await guard.canTransition(context))) {
      return {
        success: false,
        newStatus: currentStatus,
        actions: [],
        error: guard.reason || `Transition guard failed for ${guardKey}`,
      };
    }

    // Execute state exit actions
    const exitActions = await this.executeStateHandler(currentStatus, 'onExit', context);

    // Execute state enter actions
    const enterActions = await this.executeStateHandler(targetStatus, 'onEnter', context);

    this.logger.log(`Successfully transitioned request ${requestId}: ${currentStatus} → ${targetStatus}`);

    return {
      success: true,
      newStatus: targetStatus,
      actions: [...exitActions, ...enterActions],
    };
  }

  /**
   * Check if a state transition is valid
   */
  isValidTransition(from: RequestStatus, to: RequestStatus): boolean {
    const allowedTransitions = this.validTransitions.get(from);
    return allowedTransitions ? allowedTransitions.includes(to) : false;
  }

  /**
   * Get all valid transitions from a given state
   */
  getValidTransitions(from: RequestStatus): RequestStatus[] {
    return this.validTransitions.get(from) || [];
  }

  /**
   * Register a transition guard
   */
  registerGuard(fromState: RequestStatus, toState: RequestStatus, guard: TransitionGuard): void {
    const key = `${fromState}_to_${toState}`;
    this.guards.set(key, guard);
  }

  /**
   * Register a state handler
   */
  registerStateHandler(state: RequestStatus, handler: StateHandler): void {
    this.stateHandlers.set(state, handler);
  }

  private async executeStateHandler(
    state: RequestStatus,
    method: 'onEnter' | 'onExit',
    context: StateTransitionContext
  ): Promise<StateAction[]> {
    const handler = this.stateHandlers.get(state);
    if (!handler || !handler[method]) {
      return [];
    }

    try {
      const result = await handler[method]!(context);
      return Array.isArray(result) ? result : [];
    } catch (error) {
      this.logger.error(`Error executing ${method} for state ${state}:`, error);
      return [];
    }
  }

  private initializeGuards(): void {
    // Guard: Can only search if under max attempts
    this.registerGuard(RequestStatus.PENDING, RequestStatus.SEARCHING, {
      canTransition: (context) => {
        const searchAttempts = context.metadata?.searchAttempts || 0;
        const maxAttempts = context.metadata?.maxSearchAttempts || 50;
        return searchAttempts < maxAttempts;
      },
      reason: 'Maximum search attempts exceeded',
    });

    this.registerGuard(RequestStatus.FAILED, RequestStatus.SEARCHING, {
      canTransition: (context) => {
        const searchAttempts = context.metadata?.searchAttempts || 0;
        const maxAttempts = context.metadata?.maxSearchAttempts || 50;
        return searchAttempts < maxAttempts;
      },
      reason: 'Maximum search attempts exceeded',
    });

    // Guard: Can only download if torrent is selected
    this.registerGuard(RequestStatus.FOUND, RequestStatus.DOWNLOADING, {
      canTransition: (context) => {
        return !!(context.metadata?.selectedTorrent || context.metadata?.autoSelected);
      },
      reason: 'No torrent selected for download',
    });

    // Guard: Can only complete if download is actually complete
    this.registerGuard(RequestStatus.DOWNLOADING, RequestStatus.COMPLETED, {
      canTransition: (context) => {
        return context.metadata?.downloadComplete === true;
      },
      reason: 'Download not yet complete',
    });

    // Guard: Can only reset to PENDING from DOWNLOADING for TV shows that need more content
    this.registerGuard(RequestStatus.DOWNLOADING, RequestStatus.PENDING, {
      canTransition: (context) => {
        return context.metadata?.contentType === 'TV_SHOW' && context.reason?.includes('needs more content');
      },
      reason: 'Only TV shows needing more content can transition from DOWNLOADING to PENDING',
    });
  }

  private initializeStateHandlers(): void {
    // PENDING state handler (for re-search scenarios)
    this.registerStateHandler(RequestStatus.PENDING, {
      onEnter: (context) => {
        // Only reset data if this is a re-search from CANCELLED state
        if (context.currentStatus === RequestStatus.CANCELLED) {
          return [
            { type: 'RESET_SEARCH_DATA' },
            { type: 'CLEAR_FOUND_TORRENT_DATA' },
          ];
        }
        return [];
      },
    });

    // SEARCHING state handler
    this.registerStateHandler(RequestStatus.SEARCHING, {
      onEnter: (context) => [
        { type: 'INCREMENT_SEARCH_ATTEMPTS' },
        { type: 'UPDATE_SEARCH_TIMESTAMP' },
        { type: 'SCHEDULE_NEXT_SEARCH' },
      ],
    });

    // FOUND state handler
    this.registerStateHandler(RequestStatus.FOUND, {
      onEnter: (context) => [
        { type: 'STORE_TORRENT_INFO', payload: context.metadata?.torrentInfo },
        { type: 'RESET_SEARCH_INTERVAL' },
      ],
    });

    // DOWNLOADING state handler
    this.registerStateHandler(RequestStatus.DOWNLOADING, {
      onEnter: (context) => [
        { type: 'CREATE_DOWNLOAD_JOB', payload: context.metadata },
        { type: 'STORE_ARIA2_GID', payload: { gid: context.metadata?.aria2Gid } },
      ],
    });

    // COMPLETED state handler
    this.registerStateHandler(RequestStatus.COMPLETED, {
      onEnter: (context) => [
        { type: 'SET_COMPLETION_TIMESTAMP' },
        { type: 'CLEANUP_TEMP_FILES' },
        { type: 'NOTIFY_COMPLETION' },
      ],
    });

    // FAILED state handler
    this.registerStateHandler(RequestStatus.FAILED, {
      onEnter: (context) => [
        { type: 'LOG_FAILURE_REASON', payload: { reason: context.reason } },
        { type: 'SCHEDULE_RETRY' },
        { type: 'CLEANUP_FAILED_DOWNLOAD' },
      ],
    });

    // CANCELLED state handler
    this.registerStateHandler(RequestStatus.CANCELLED, {
      onEnter: (context) => [
        { type: 'CANCEL_DOWNLOAD_JOBS' },
        { type: 'CLEANUP_DOWNLOAD_FILES' },
        { type: 'RESET_FOR_RESEARCH' },
      ],
    });

    // EXPIRED state handler
    this.registerStateHandler(RequestStatus.EXPIRED, {
      onEnter: (context) => [
        { type: 'SET_EXPIRATION_TIMESTAMP' },
        { type: 'CLEANUP_EXPIRED_DATA' },
      ],
    });
  }
}
