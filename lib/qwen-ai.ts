export class QwenAI {
  private apiKey: string;
  private baseUrl = 'https://openrouter.ai/api/v1';
  private model = 'qwen/qwen3-coder:free';
  private lastRequest = 0;
  private minInterval = 2000; // 2 seconds between requests

  constructor() {
    this.apiKey = process.env.OPENROUTER_API_KEY || '';
  }

  async chat(messages: Array<{role: string; content: string}>) {
    // Rate limiting
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequest;
    if (timeSinceLastRequest < this.minInterval) {
      await new Promise(resolve => setTimeout(resolve, this.minInterval - timeSinceLastRequest));
    }
    this.lastRequest = Date.now();

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        messages,
        temperature: 0.7,
        max_tokens: 150, // Limit tokens to reduce usage
      }),
    });

    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    }

    if (!response.ok) {
      throw new Error(`AI request failed: ${response.statusText}`);
    }

    return response.json();
  }
}