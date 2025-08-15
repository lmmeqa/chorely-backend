import OpenAI from 'openai';

// Initialize OpenAI client only if API key is available
let openai: OpenAI | null = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

export interface GeneratedTodo {
  name: string;
}

export class GptService {
  static async generateTodosForChore(choreName: string, choreDescription: string): Promise<GeneratedTodo[]> {
    if (!openai || !process.env.OPENAI_API_KEY) {
      console.log("no openai or api key")
      // Fallback to predefined todos if no API key
      return this.getFallbackTodos(choreName);
    }

    try {
      const prompt = this.buildPrompt(choreName, choreDescription);

      const response = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: "You are a helpful assistant that generates step-by-step todo lists for household chores. Each todo should be clear, actionable, and in logical order."
          },
          {
            role: "user",
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error("No response from GPT API");
      }
      return this.parseGptResponse(content);
    } catch (error) {
      console.error("GPT API error:", error);
      // Fallback to predefined todos on error
      return this.getFallbackTodos(choreName);
    }
  }

  private static buildPrompt(choreName: string, choreDescription: string): string {
    return `Generate a step-by-step todo list for the chore: "${choreName}"

Description: ${choreDescription}

Please provide fewer than 6 clear, actionable steps. Average amt of todos should be 3 with a std dev of 1. 6 is max and 2 is minimum Each step should be:
- Specific and actionable
- In logical order
- fewer than 13 words

Format your response as a numbered list, with each step on a new line starting with a number and period.

Example format:
1. First step description
2. Second step description
3. Third step description

Please generate the todo list for "${choreName}":`;
  }

  private static parseGptResponse(content: string): GeneratedTodo[] {
    try {
      // Try to parse numbered list format
      const lines = content.split('\n').filter(line => line.trim());
      const todos: GeneratedTodo[] = [];

      for (const line of lines) {
        const match = line.match(/^\d+\.\s*(.+)$/);
        if (match) {
          const todoText = match[1].trim();
          todos.push({
            name: todoText
          });
        }
      }

      if (todos.length > 0) {
        return todos;
      }

      // Fallback parsing
      return this.parseManualResponse(content);
    } catch (error) {
      console.error("Error parsing GPT response:", error);
      return this.getFallbackTodos("Unknown chore");
    }
  }

  private static parseManualResponse(content: string): GeneratedTodo[] {
    // Simple fallback parsing
    const lines = content.split('\n').filter(line => line.trim());
    return lines.slice(0, 5).map((line) => ({
      name: line.trim()
    }));
  }

  private static getFallbackTodos(choreName: string): GeneratedTodo[] {
    const fallbackTodos: { [key: string]: GeneratedTodo[] } = {
      "Vacuum Living Room": [
        { name: "Clear the floor of any small objects or debris" },
        { name: "Plug in the vacuum cleaner and unwind the cord" },
        { name: "Start from one corner of the room and vacuum in rows" },
        { name: "Pay extra attention to high-traffic areas and under furniture" },
        { name: "Empty the vacuum canister or replace the bag when full" },
        { name: "Once done, wind the cord and store the vacuum cleaner" }
      ],
      "Wash Dishes": [
        { name: "Scrape off any leftover food from plates and utensils" },
        { name: "Fill the sink with warm soapy water" },
        { name: "Wash dishes in order: glasses, plates, utensils, then pots and pans" },
        { name: "Rinse each item thoroughly with clean water" },
        { name: "Place items in the drying rack or dry with a clean towel" },
        { name: "Empty the sink and wipe down the counter" }
      ],
      "Make Bed": [
        { name: "Remove any items from the bed" },
        { name: "Straighten the fitted sheet and tuck in corners" },
        { name: "Smooth out the top sheet and tuck it under the mattress" },
        { name: "Fluff and arrange pillows at the head of the bed" },
        { name: "Add any decorative pillows or throws" },
        { name: "Smooth out the comforter or duvet cover" }
      ]
    };

    return fallbackTodos[choreName] || [
      { name: "Step 1: Prepare the area" },
      { name: "Step 2: Complete the main task" },
      { name: "Step 3: Clean up and organize" }
    ];
  }
} 