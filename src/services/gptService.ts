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
  description: string;
}

export class GptService {
  static async generateTodosForChore(choreName: string, choreDescription: string): Promise<GeneratedTodo[]> {
    if (!openai || !process.env.OPENAI_API_KEY) {
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

Please provide at most 5clear, actionable steps. Each step should be:
- Specific and actionable
- In logical order

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
          const description = match[1].trim();
          todos.push({
            name: description,
            description: description
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
    return lines.slice(0, 5).map((line, index) => ({
      name: line.trim(),
      description: line.trim()
    }));
  }

  private static getFallbackTodos(choreName: string): GeneratedTodo[] {
    // Fallback todos for common chores
    const fallbackTodos: { [key: string]: GeneratedTodo[] } = {
      "Taking out trash": [
        { name: "Collect all trash bags from bins", description: "Gather all full trash bags from around the house" },
        { name: "Tie bags securely", description: "Make sure all bags are properly tied to prevent spills" },
        { name: "Take bags to outdoor bin", description: "Carry bags to the main outdoor trash container" },
        { name: "Place new bags in bins", description: "Replace empty bins with fresh trash bags" },
        { name: "Clean any spills", description: "Wipe up any mess around the bins" }
      ],
      "Doing laundry": [
        { name: "Sort clothes by color and fabric", description: "Separate whites, colors, and delicate items" },
        { name: "Check pockets and remove items", description: "Empty all pockets and remove any loose items" },
        { name: "Add detergent and start wash", description: "Add appropriate amount of detergent and start the washing machine" },
        { name: "Transfer to dryer or hang to dry", description: "Move clothes to dryer or hang on drying rack" },
        { name: "Fold and put away clothes", description: "Fold clean clothes and return them to their proper places" }
      ],
      "Washing dishes": [
        { name: "Scrape food scraps into trash", description: "Remove any leftover food from plates and utensils" },
        { name: "Rinse dishes with warm water", description: "Rinse off any remaining food particles" },
        { name: "Wash with soap and sponge", description: "Clean dishes thoroughly with dish soap and sponge" },
        { name: "Rinse with clean water", description: "Rinse off all soap suds" },
        { name: "Dry and put away", description: "Dry dishes and return them to their storage locations" }
      ]
    };

    const lowerChoreName = choreName.toLowerCase();
    for (const [key, todos] of Object.entries(fallbackTodos)) {
      if (lowerChoreName.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerChoreName)) {
        return todos;
      }
    }

    // Generic fallback
    return [
      { name: "Prepare materials", description: "Gather all necessary supplies and tools" },
      { name: "Start the task", description: "Begin the chore following proper procedures" },
      { name: "Complete the task", description: "Finish all required steps thoroughly" },
      { name: "Clean up", description: "Put away tools and clean any mess made" },
      { name: "Verify completion", description: "Double-check that everything is done correctly" }
    ];
  }
} 