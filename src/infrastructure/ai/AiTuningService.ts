import { CalibrationMap } from '../../core/domain/CalibrationMap';

/**
 * AI message role
 */
export type MessageRole = 'system' | 'user' | 'assistant';

/**
 * Chat message
 */
export interface ChatMessage {
  role: MessageRole;
  content: string;
  timestamp?: Date;
}

/**
 * AI context for tuning assistance
 */
export interface TuningContext {
  mapTitle?: string;
  mapValues?: number[][];
  mapUnits?: string;
  mapCategory?: string;
  ecuType?: string;
  currentCell?: { row: number; col: number; value: number };
}

/**
 * AI chat request
 */
export interface AiChatRequest {
  messages: ChatMessage[];
  context?: TuningContext;
  stream?: boolean;
}

/**
 * AI chat response
 */
export interface AiChatResponse {
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * AI configuration
 */
export interface AiConfig {
  apiKey?: string;
  endpoint?: string;
  model?: string;
  mockMode?: boolean;
}

/**
 * Stream callback
 */
export type StreamCallback = (chunk: string) => void;

/**
 * AI Tuning Service - handles AI-powered tuning assistance
 */
export class AiTuningService {
  private config: AiConfig = { mockMode: true };
  private streamCallbacks: Set<StreamCallback> = new Set();

  /**
   * Configure AI service
   */
  configure(config: Partial<AiConfig>): void {
    this.config = { ...this.config, ...config };

    // If API key is provided, disable mock mode
    if (config.apiKey) {
      this.config.mockMode = false;
    }

    if (typeof window !== 'undefined' && window.electronAPI?.ai?.setConfig) {
      void window.electronAPI.ai.setConfig({
        apiKey: this.config.apiKey ?? null,
        endpoint: this.config.endpoint,
      });
    }
  }

  /**
   * Check if service is in mock mode
   */
  get isMockMode(): boolean {
    return this.config.mockMode || !this.config.apiKey;
  }

  /**
   * Register stream callback
   */
  onStream(callback: StreamCallback): () => void {
    this.streamCallbacks.add(callback);
    return () => this.streamCallbacks.delete(callback);
  }

  /**
   * Send chat message
   */
  async chat(request: AiChatRequest): Promise<AiChatResponse> {
    if (this.isMockMode) {
      return this.mockChat(request);
    }

    // Use Electron IPC to communicate with main process
    if (typeof window !== 'undefined' && window.electronAPI) {
      return window.electronAPI.ai.chat(request);
    }

    return { success: false, error: 'AI service not available' };
  }

  /**
   * Generate explanation for a map
   */
  async explainMap(map: CalibrationMap): Promise<string> {
    const request: AiChatRequest = {
      messages: [
        {
          role: 'user',
          content: `Please explain what the "${map.title}" calibration map does and how it affects engine performance. Include safety considerations.`,
        },
      ],
      context: {
        mapTitle: map.title,
        mapValues: map.values,
        mapUnits: map.units,
        mapCategory: map.category,
      },
    };

    const response = await this.chat(request);
    return response.message || 'Unable to generate explanation.';
  }

  /**
   * Get tuning suggestions for a map
   */
  async getSuggestions(map: CalibrationMap, goal: string): Promise<string> {
    const stats = map.getStatistics();

    const request: AiChatRequest = {
      messages: [
        {
          role: 'user',
          content: `I'm tuning the "${map.title}" map. My goal is: ${goal}.
Current map statistics: min=${stats.min.toFixed(2)}, max=${stats.max.toFixed(2)}, avg=${stats.avg.toFixed(2)}.
What safe adjustments would you suggest?`,
        },
      ],
      context: {
        mapTitle: map.title,
        mapValues: map.values,
        mapUnits: map.units,
        mapCategory: map.category,
      },
    };

    const response = await this.chat(request);
    return response.message || 'Unable to generate suggestions.';
  }

  /**
   * Analyze map for anomalies
   */
  async analyzeMap(map: CalibrationMap): Promise<string> {
    const stats = map.getStatistics();
    const modifiedCells = map.getModifiedCells();

    const request: AiChatRequest = {
      messages: [
        {
          role: 'user',
          content: `Please analyze this "${map.title}" map for any anomalies or potentially dangerous values.
Statistics: min=${stats.min.toFixed(2)}, max=${stats.max.toFixed(2)}, avg=${stats.avg.toFixed(2)}, stdDev=${stats.stdDev.toFixed(2)}
Modified cells: ${modifiedCells.length}
Units: ${map.units}`,
        },
      ],
      context: {
        mapTitle: map.title,
        mapValues: map.values,
        mapUnits: map.units,
        mapCategory: map.category,
      },
    };

    const response = await this.chat(request);
    return response.message || 'Unable to analyze map.';
  }

  /**
   * Generate tuning changelog
   */
  async generateChangelog(maps: CalibrationMap[]): Promise<string> {
    const modifiedMaps = maps.filter(m => m.isModified);

    if (modifiedMaps.length === 0) {
      return 'No modifications made.';
    }

    const summaries = modifiedMaps.map(m => {
      const cells = m.getModifiedCells();
      return `- ${m.title}: ${cells.length} cells modified`;
    });

    const request: AiChatRequest = {
      messages: [
        {
          role: 'user',
          content: `Generate a professional tuning changelog for these modifications:\n${summaries.join('\n')}\n\nInclude any safety notes.`,
        },
      ],
    };

    const response = await this.chat(request);
    return response.message || 'Unable to generate changelog.';
  }

  /**
   * Mock chat for offline/demo mode
   */
  private async mockChat(request: AiChatRequest): Promise<AiChatResponse> {
    const lastMessage = request.messages[request.messages.length - 1]?.content || '';
    const context = request.context;

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));

    let response = '';

    if (lastMessage.toLowerCase().includes('explain')) {
      response = this.getMockExplanation(context?.mapTitle, context?.mapCategory);
    } else if (lastMessage.toLowerCase().includes('suggest')) {
      response = this.getMockSuggestions(context?.mapTitle);
    } else if (lastMessage.toLowerCase().includes('analyze')) {
      response = this.getMockAnalysis(context?.mapTitle);
    } else if (lastMessage.toLowerCase().includes('changelog')) {
      response = this.getMockChangelog();
    } else {
      response = this.getMockGenericResponse();
    }

    // Simulate streaming if callbacks are registered
    if (request.stream && this.streamCallbacks.size > 0) {
      const words = response.split(' ');
      for (const word of words) {
        await new Promise(resolve => setTimeout(resolve, 30));
        for (const callback of this.streamCallbacks) {
          callback(word + ' ');
        }
      }
    }

    return { success: true, message: response };
  }

  private getMockExplanation(mapTitle?: string, category?: string): string {
    const title = mapTitle?.toLowerCase() || '';

    if (title.includes('fuel') || category === 'Fuel') {
      return `**Fuel Map Explanation**

This fuel calibration table controls the base fuel delivery to the engine. The values represent the fuel quantity modifier applied based on engine load (typically on the Y-axis) and RPM (typically on the X-axis).

**Key Points:**
- Higher values = more fuel (richer mixture)
- Lower values = less fuel (leaner mixture)
- Under high load, you want richer mixtures (AFR 11.5-12.5:1)
- At cruise, leaner mixtures improve economy (AFR 14.5-15:1)

**Safety Warning:** Never run lean under boost or high load. This can cause detonation and severe engine damage. Always verify changes with a wideband O2 sensor.

*Running in offline mode - connect API key for full AI capabilities.*`;
    }

    if (title.includes('ignition') || title.includes('timing') || category === 'Ignition') {
      return `**Ignition Timing Map Explanation**

This map controls spark advance timing in degrees Before Top Dead Center (BTDC). Proper timing is critical for both power and engine safety.

**Key Points:**
- More advance = more power (up to a point)
- Too much advance = detonation/knock = engine damage
- Boost significantly reduces safe timing limits
- Modern engines use knock sensors as a safety net

**Safe Ranges:**
- Naturally aspirated: 28-38° at peak torque RPM
- Turbocharged: 15-25° (varies with boost level)
- Never exceed 45° in any condition

**Safety Warning:** Always monitor for knock when adjusting timing. Use proper knock detection equipment and make small, incremental changes.

*Running in offline mode - connect API key for full AI capabilities.*`;
    }

    return `**Map Explanation**

This calibration table "${mapTitle || 'Unknown'}" controls engine parameters. The specific behavior depends on the ECU and map type.

General principles:
- Understand what the map controls before making changes
- Make small, incremental adjustments
- Always log data before and after changes
- Have a way to revert to known-good calibration

*Running in offline mode - connect API key for full AI capabilities.*`;
  }

  private getMockSuggestions(mapTitle?: string): string {
    return `**Tuning Suggestions for ${mapTitle || 'this map'}**

Based on general tuning principles:

1. **Start Conservative** - Make changes of 2-5% at a time
2. **Test Each Change** - Log data to verify the effect
3. **Monitor Safety Parameters** - Watch knock, AFR, and temperatures
4. **Document Everything** - Keep notes on what you changed and why

**Incremental Approach:**
- Modify one variable at a time
- Allow the engine to reach operating temperature
- Test across the full RPM range
- Verify changes under actual driving conditions

**Warning:** These are general suggestions. Your specific application may require different approaches. Always prioritize engine safety.

*Running in offline mode - connect API key for full AI capabilities.*`;
  }

  private getMockAnalysis(mapTitle?: string): string {
    return `**Analysis of ${mapTitle || 'Current Map'}**

**General Observations:**
- Values appear within typical operating ranges
- No obvious outliers detected
- Smooth transitions between cells

**Recommendations:**
1. Verify map values against known-good calibration
2. Check for any discontinuities that could cause drivability issues
3. Ensure edge cases (high RPM, high load) are safe

**Safety Check:**
- Review any cells that were significantly modified
- Confirm AFR targets are safe for your application
- Verify timing values are appropriate for fuel quality

*Running in offline mode - connect API key for full AI capabilities.*`;
  }

  private getMockChangelog(): string {
    return `**Tuning Session Changelog**

**Modifications Summary:**
- Multiple calibration maps were adjusted
- Changes were made to optimize performance/efficiency

**Safety Notes:**
- All modifications should be verified on a dyno
- Monitor engine parameters during initial testing
- Keep a backup of the original calibration

**Next Steps:**
1. Perform a test drive with data logging
2. Review logged data for anomalies
3. Fine-tune based on real-world results

*Running in offline mode - connect API key for full AI capabilities.*`;
  }

  private getMockGenericResponse(): string {
    return `I'm your ECU tuning AI assistant. I can help you with:

- **Explain** - Understand what maps and parameters do
- **Suggest** - Get safe tuning recommendations
- **Analyze** - Check for anomalies in your calibration
- **Changelog** - Generate documentation for your changes

Just select a map and ask me any question about ECU tuning!

*Note: Running in offline mode. Connect an OpenAI-compatible API key in settings for full AI capabilities.*`;
  }
}
