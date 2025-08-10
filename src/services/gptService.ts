import OpenAI from 'openai';
import { TodoItem } from '../db/models';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface GeneratedTodo {
  name: string;
  description: string;
}

export class GptService {
  static async generateTodosForChore(choreName: string, choreDescription: string): Promise<GeneratedTodo[]> {
    if (!process.env.OPENAI_API_KEY) {
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

Please provide 3-6 clear, actionable steps. Format your response as a JSON array of objects with "name" and "description" fields.

Example format:
[
  {
    "name": "Step 1 name",
    "description": "Detailed description of what to do"
  },
  {
    "name": "Step 2 name", 
    "description": "Detailed description of what to do"
  }
]

Make sure each step is:
- Clear and actionable
- In logical order
- Specific enough to be followed
- Appropriate for a household chore

Respond only with the JSON array, no additional text.`;
  }

  private static parseGptResponse(content: string): GeneratedTodo[] {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const todos = JSON.parse(jsonMatch[0]);
        if (Array.isArray(todos) && todos.every(todo => todo.name && todo.description)) {
          return todos;
        }
      }
      
      // If JSON parsing fails, try to parse manually
      return this.parseManualResponse(content);
    } catch (error) {
      console.error("Failed to parse GPT response:", error);
      return [];
    }
  }

  private static parseManualResponse(content: string): GeneratedTodo[] {
    const lines = content.split('\n').filter(line => line.trim());
    const todos: GeneratedTodo[] = [];
    
    for (const line of lines) {
      // Look for numbered steps
      const stepMatch = line.match(/^\d+\.\s*(.+)/);
      if (stepMatch) {
        const name = stepMatch[1].trim();
        todos.push({
          name,
          description: `Complete: ${name}`
        });
      }
    }
    
    return todos;
  }

  private static getFallbackTodos(choreName: string): GeneratedTodo[] {
    const fallbackTodos: Record<string, GeneratedTodo[]> = {
      "Taking out trash": [
        {
          name: "Collect trash",
          description: "Gather trash from all bins in the house."
        },
        {
          name: "Replace liners", 
          description: "Put new liners in all the trash cans."
        },
        {
          name: "Take out to curb",
          description: "Take the main trash bag to the outdoor bin/curb."
        }
      ],
      "Dusting": [
        {
          name: "Gather supplies",
          description: "Get a duster or microfiber cloth."
        },
        {
          name: "Dust high surfaces",
          description: "Start from top to bottom."
        },
        {
          name: "Dust furniture",
          description: "Dust tables, shelves, and other furniture."
        }
      ],
      "Mopping": [
        {
          name: "Sweep/vacuum first",
          description: "Remove loose dirt and debris."
        },
        {
          name: "Prepare mop solution",
          description: "Fill a bucket with water and cleaning solution."
        },
        {
          name: "Mop the floors",
          description: "Mop from the farthest corner towards the door."
        },
        {
          name: "Let it dry",
          description: "Allow the floor to air dry completely."
        }
      ],
      "Washing Dishes": [
        {
          name: "Scrape plates",
          description: "Remove leftover food from dishes."
        },
        {
          name: "Wash with soap",
          description: "Use hot, soapy water to wash each dish."
        },
        {
          name: "Rinse thoroughly",
          description: "Rinse off all soap suds."
        },
        {
          name: "Dry and put away",
          description: "Use a towel or drying rack."
        }
      ],
      "Vacuum": [
        {
          name: "Clear the floor",
          description: "Pick up any large items or clutter from the floor."
        },
        {
          name: "Vacuum room by room",
          description: "Work systematically through the house."
        },
        {
          name: "Use attachments",
          description: "Use attachments for corners and edges."
        }
      ],
      "Laundry": [
        {
          name: "Sort clothes",
          description: "Separate lights, darks, and colors."
        },
        {
          name: "Wash load",
          description: "Put one load in the washing machine with detergent."
        },
        {
          name: "Dry load",
          description: "Transfer washed clothes to the dryer."
        },
        {
          name: "Fold and put away",
          description: "Fold the dry clothes and put them away."
        }
      ]
    };

    return fallbackTodos[choreName] || [
      {
        name: "Step 1",
        description: "Complete the first step of the chore."
      },
      {
        name: "Step 2", 
        description: "Complete the second step of the chore."
      },
      {
        name: "Step 3",
        description: "Complete the final step of the chore."
      }
    ];
  }
} 