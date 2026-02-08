import { NextResponse } from 'next/server'

import dataset from '@/src/data/dataset'

// Switch to the Node runtime so we can call local/remote HTTP services like Ollama.
export const runtime = 'nodejs'

type Message = {
  role: 'user' | 'assistant';
  content: string;
};

type RequestBody = {
  question: string;
  context?: Message[];
};

const DEFAULT_OLLAMA_URL = 'http://127.0.0.1:11434';
const DEFAULT_MODEL = 'llama3:8b';
const FALLBACK_SOURCE = 'SyncIn Knowledge Base';
const DEFAULT_FALLBACK_RESPONSE =
  "I'm still learning and couldn't find an exact answer. Could you add more details so I can help better?";

const ollamaBaseUrl = process.env.OLLAMA_BASE_URL?.trim() || DEFAULT_OLLAMA_URL;
const ollamaModel = process.env.OLLAMA_MODEL?.trim() || DEFAULT_MODEL;
const ollamaSystemPrompt =
  process.env.OLLAMA_SYSTEM_PROMPT?.trim() ||
  'You are CS Mentor, an AI assistant specialized in computer science education and career guidance. You provide clear, concise, and accurate information about programming concepts, interview preparation, and career development in the tech industry.';

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;

  let intersection = 0;
  a.forEach((token) => {
    if (b.has(token)) {
      intersection += 1;
    }
  });

  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

function findDatasetAnswer(question: string): string | null {
  const questionTokens = new Set(tokenize(question));
  if (questionTokens.size === 0) {
    return null;
  }

  let bestScore = 0;
  let bestAnswer: string | null = null;

  dataset.forEach((item) => {
    const candidateTokens = new Set(tokenize(`${item.instruction} ${item.input}`));
    if (candidateTokens.size === 0) {
      return;
    }

    const score = jaccardSimilarity(questionTokens, candidateTokens);

    if (score > bestScore) {
      bestScore = score;
      bestAnswer = item.output.trim();
    }
  });

  return bestScore > 0 ? bestAnswer : null;
}

function buildFallbackAnswer(question: string) {
  const datasetAnswer = findDatasetAnswer(question);

  if (datasetAnswer) {
    return {
      answer: datasetAnswer,
      source: FALLBACK_SOURCE,
    };
  }

  return {
    answer: DEFAULT_FALLBACK_RESPONSE,
    source: 'SyncIn Assistant',
  };
}

function buildMessages(question: string, context: Message[]): { role: string; content: string }[] {
  const history = context.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  return [
    { role: 'system', content: ollamaSystemPrompt },
    ...history,
    { role: 'user', content: question },
  ];
}

export async function POST(request: Request) {
  try {
    const { question, context = [] }: RequestBody = await request.json();

    if (!question?.trim()) {
      return NextResponse.json(
        { error: 'Question is required' },
        { status: 400 }
      );
    }

    const messages = buildMessages(question, context);

    let answer: string | undefined;
    let source: string | undefined;

    try {
      const response = await fetch(`${ollamaBaseUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: ollamaModel,
          messages,
          stream: false,
        }),
      });

      if (response.ok) {
        const payload = await response.json();
        const backendAnswer = payload?.message?.content?.trim();

        if (backendAnswer) {
          answer = backendAnswer;
          source = ollamaModel;
        } else {
          console.warn('Ollama response did not include message content:', payload);
        }
      } else {
        const errorText = await response.text();
        console.error('Ollama chat error:', response.status, errorText);
      }
    } catch (error) {
      console.error('Unable to reach Ollama backend:', error);
    }

    if (!answer) {
      const fallback = buildFallbackAnswer(question);
      answer = fallback.answer;
      source = fallback.source;
    }

    return NextResponse.json({
      answer,
      source,
    });
  } catch (error) {
    console.error('Error processing chat:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
