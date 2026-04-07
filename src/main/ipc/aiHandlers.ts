import { IpcMain, BrowserWindow } from 'electron';
import { IpcChannels } from '../../shared/types/ipc';
import type { AiChatRequest, AiChatResponse, AiConfigRequest } from '../../shared/types/ipc';

interface OpenAiChatCompletionResponse {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
}

// Store API key in memory (in production, use secure storage)
let apiKey: string | null = null;
let apiEndpoint: string = 'https://api.openai.com/v1';
const defaultModel = 'gpt-4';

export function setupAiHandlers(ipcMain: IpcMain): void {
  // Set API configuration
  ipcMain.handle(IpcChannels.AI_SET_CONFIG, async (_, config: AiConfigRequest) => {
    apiKey = config.apiKey?.trim() || null;
    apiEndpoint = config.endpoint?.trim() || 'https://api.openai.com/v1';
    return { success: true };
  });

  // Main chat handler
  ipcMain.handle(
    IpcChannels.AI_CHAT,
    async (event, request: AiChatRequest): Promise<AiChatResponse> => {
      const window = BrowserWindow.fromWebContents(event.sender);

      try {
        // If no API key, use mock mode
        if (!apiKey) {
          return handleMockChat(request, window);
        }

        // Build system prompt with context
        const systemPrompt = buildSystemPrompt(request.context);
        const messages = [
          { role: 'system' as const, content: systemPrompt },
          ...request.messages,
        ];

        if (request.stream) {
          return await handleStreamingChat(messages, window);
        } else {
          return await handleDirectChat(messages);
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'AI request failed',
        };
      }
    }
  );
}

/**
 * Build system prompt with ECU context
 */
function buildSystemPrompt(context?: AiChatRequest['context']): string {
  let prompt = `You are an expert ECU tuning assistant with deep knowledge of automotive engine management systems.
You help users understand and safely modify ECU calibration maps.

Key responsibilities:
1. Explain what maps and parameters do in simple terms
2. Suggest safe tuning adjustments based on the user's goals
3. Warn about potentially dangerous values or changes
4. Provide educational context about engine tuning principles

Safety guidelines you MUST follow:
- Always warn about lean AFR conditions under load (< 11.5:1)
- Caution against excessive ignition timing (> 35° NA, > 25° boosted)
- Recommend conservative changes and incremental adjustments
- Emphasize the importance of dyno tuning and data logging
- Never recommend changes that could cause immediate engine damage

`;

  if (context) {
    prompt += '\nCurrent context:\n';
    if (context.mapTitle) {
      prompt += `- Currently viewing map: ${context.mapTitle}\n`;
    }
    if (context.mapUnits) {
      prompt += `- Map units: ${context.mapUnits}\n`;
    }
    if (context.ecuType) {
      prompt += `- ECU type: ${context.ecuType}\n`;
    }
    if (context.mapValues && context.mapValues.length > 0) {
      const flatValues = context.mapValues.flat();
      const min = Math.min(...flatValues);
      const max = Math.max(...flatValues);
      const avg = flatValues.reduce((a, b) => a + b, 0) / flatValues.length;
      prompt += `- Map value range: ${min.toFixed(2)} to ${max.toFixed(2)} (avg: ${avg.toFixed(2)})\n`;
      prompt += `- Map dimensions: ${context.mapValues.length} x ${context.mapValues[0]?.length || 1}\n`;
    }
  }

  return prompt;
}

/**
 * Handle direct (non-streaming) chat
 */
async function handleDirectChat(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
): Promise<AiChatResponse> {
  const response = await fetch(`${apiEndpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: defaultModel,
      messages,
      temperature: 0.7,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${response.status} - ${error}`);
  }

  const data = await response.json() as OpenAiChatCompletionResponse;
  return {
    success: true,
    message: data.choices?.[0]?.message?.content || '',
  };
}

/**
 * Handle streaming chat
 */
async function handleStreamingChat(
  messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
  window: BrowserWindow | null
): Promise<AiChatResponse> {
  const response = await fetch(`${apiEndpoint}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: defaultModel,
      messages,
      temperature: 0.7,
      max_tokens: 1000,
      stream: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API error: ${response.status} - ${error}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error('No response body');
  }

  const decoder = new TextDecoder();
  let fullMessage = '';

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter((line) => line.startsWith('data: '));

      for (const line of lines) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices[0]?.delta?.content;
          if (content) {
            fullMessage += content;
            window?.webContents.send(IpcChannels.AI_STREAM_CHUNK, content);
          }
        } catch {
          // Skip invalid JSON
        }
      }
    }

    window?.webContents.send(IpcChannels.AI_STREAM_END);
    return { success: true, message: fullMessage };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Stream error';
    window?.webContents.send(IpcChannels.AI_STREAM_ERROR, errorMessage);
    throw error;
  }
}

/**
 * Mock chat for offline/demo mode
 */
function handleMockChat(
  request: AiChatRequest,
  window: BrowserWindow | null
): AiChatResponse {
  const lastMessage = request.messages[request.messages.length - 1]?.content || '';
  const context = request.context;

  let response = '';

  // Generate contextual mock responses
  if (lastMessage.toLowerCase().includes('explain') || lastMessage.toLowerCase().includes('what')) {
    if (context?.mapTitle?.toLowerCase().includes('fuel')) {
      response = `**Fuel Map Explanation**

This fuel map controls the base fuel injection timing and quantity. The values typically represent either:
- Injection pulse width (milliseconds)
- Volumetric efficiency percentage
- Fuel multiplier values

**Key areas to note:**
- Low RPM/load: Idle and cruise economy
- High RPM/load: Full throttle enrichment
- Transition zones: Important for throttle response

**Safety tip:** Always ensure adequate fueling under boost. Target AFR of 11.5-12.5:1 at WOT.`;
    } else if (context?.mapTitle?.toLowerCase().includes('timing') || context?.mapTitle?.toLowerCase().includes('ignition')) {
      response = `**Ignition Timing Map Explanation**

This map controls spark advance in degrees Before Top Dead Center (BTDC). Higher values = more advance = more power (to a point).

**Key considerations:**
- Too much advance → detonation/knock → engine damage
- Too little advance → lost power and efficiency
- Boost reduces safe timing limits significantly

**Safe ranges:**
- Naturally aspirated: 28-38° typical WOT
- Boosted: 15-25° typical WOT (depends on boost level)

**Warning:** Always use knock detection when advancing timing!`;
    } else {
      response = `I'd be happy to explain this map. Based on the title "${context?.mapTitle || 'this calibration table'}", this appears to control engine parameters.

Could you provide more context about:
1. What ECU/vehicle this is for?
2. What specific aspect you'd like explained?

I can then give you more detailed guidance.`;
    }
  } else if (lastMessage.toLowerCase().includes('safe') || lastMessage.toLowerCase().includes('suggest')) {
    response = `**Tuning Recommendations**

Based on the current map values, here are some general guidelines:

1. **Start conservative** - Make small changes (2-5%) and test
2. **Monitor everything** - Use data logging to verify changes
3. **Check for knock** - Always monitor knock sensors during testing

**Incremental approach:**
- Modify one parameter at a time
- Test each change before moving to the next
- Keep detailed notes of all modifications

Would you like specific suggestions for this particular map?`;
  } else {
    response = `I'm your ECU tuning assistant. I can help you:

- **Explain** what maps and values mean
- **Suggest** safe tuning modifications
- **Analyze** your current calibration
- **Warn** about potentially dangerous values

Just ask me about any aspect of your tune, or select a map and ask me to explain it!

*Note: Running in offline mode. Connect an API key for full AI capabilities.*`;
  }

  // Simulate streaming if requested
  if (request.stream && window) {
    const words = response.split(' ');
    let index = 0;

    const interval = setInterval(() => {
      if (index < words.length) {
        const word = words[index] + (index < words.length - 1 ? ' ' : '');
        window.webContents.send(IpcChannels.AI_STREAM_CHUNK, word);
        index++;
      } else {
        clearInterval(interval);
        window.webContents.send(IpcChannels.AI_STREAM_END);
      }
    }, 50);
  }

  return { success: true, message: response };
}
