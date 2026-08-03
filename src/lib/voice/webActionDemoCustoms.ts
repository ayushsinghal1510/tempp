import { buildVoiceCustoms } from "./voiceCustoms";
import { VX_SERVER, FLOW_API_KEY, PARTICIPANTS, waitForIceGathering } from "./customs";

export { VX_SERVER, FLOW_API_KEY, PARTICIPANTS, waitForIceGathering };

const WEB_ACTION_MARKER = "<|web_action|>";

const SYSTEM_PROMPT = `You are a helpful voice assistant that guides users through web pages by performing actions on their behalf. You are currently helping a user log into a sample website.

You can perform browser actions by placing ${WEB_ACTION_MARKER} markers in your speech. Each marker corresponds to one action in the "actions" list you return. The actions are executed in order, synchronized with your speech — the user hears you explain what you're doing while it happens on screen.

AVAILABLE ACTIONS (return these as JSON objects in the "actions" list):
- {"action": "focus", "selector": "<CSS selector>"} — highlight and focus an element
- {"action": "fill_field", "selector": "<CSS selector>", "value": "<text>"} — type text into an input field
- {"action": "click", "selector": "<CSS selector>"} — click a button or link
- {"action": "scroll_to", "selector": "<CSS selector>"} — scroll to an element

THE PAGE:
The page has a login form with:
- An email/username input: selector "#username"
- A password input: selector "#password"
- A sign-in button: selector "#login-btn"
- A forgot password link: selector "#forgot-link"

BEHAVIOR:
1. When the user asks you to log in or help them sign in, walk them through it step by step.
2. Ask what credentials they want to use, or offer to fill in demo credentials.
3. Place ${WEB_ACTION_MARKER} markers in your speech at the exact moments the browser should act.
4. Keep your speech natural and conversational — explain what you're doing as you do it.

EXAMPLE RESPONSE (when user says "log me in with demo credentials"):
{
  "speak": "Sure, let me help you log in. I'll start by entering the username. ${WEB_ACTION_MARKER} Great, now let me type in the password. ${WEB_ACTION_MARKER} Perfect, everything's filled in. Let me click sign in for you. ${WEB_ACTION_MARKER} And you're all set!",
  "actions": [
    {"action": "fill_field", "selector": "#username", "value": "demo@example.com"},
    {"action": "fill_field", "selector": "#password", "value": "SecurePass123"},
    {"action": "click", "selector": "#login-btn"}
  ]
}

SPEECH — NUMBERS MUST BE WORDS:
This is delivered by text-to-speech. Always write numbers as full spoken words.

OPENING YOUR REPLY:
A quick filler is already played before your response. Never start with a filler or acknowledgment word. Jump straight into the action.`;

export function buildWebActionDemoCustoms(userName: string) {
  return {
    "warmup-agent": true,
    "process-type": "speech-native",
    faces: [
      {
        uuid: "fd2741f8-652a-48cd-b4dd-6881d4dd7638",
        label: "main",
        usage: "default idle / speaking face",
      },
    ],
    agent_id: {
      workflow: {
        nodes: {
          greeting: {
            type: "out",
            parameters: {
              out_dict: {
                speak:
                  "Hi! I can see a login page in front of you. Would you like me to help you sign in? Just tell me what credentials to use, or I can fill in some demo ones for you.",
              },
              interruption_type: "no",
              interruption_metadata: {},
            },
            next: "ask_for_input",
          },
          ask_for_input: {
            type: "input",
            parameters: { input_variables: { user_input: "str" } },
            next: "transcription",
          },
          transcription: {
            type: "out",
            parameters: {
              variables: ["user_input"],
              interruption_type: "no",
              interruption_metadata: {},
            },
            next: "llm",
          },
          llm: {
            type: "llm",
            parameters: {
              input_variables: {
                user_input: {
                  type: "str",
                  description: "What the user just said.",
                },
              },
              prompt_template: "base_llm",
              system_prompt: SYSTEM_PROMPT,
              service: "groq",
              model: "openai/gpt-oss-120b",
              history_key: "conversation_history",
              llm_return_type: {
                speak: {
                  type: "str",
                  description:
                    "The agent's spoken response with <|web_action|> markers where browser actions should fire.",
                },
                actions: {
                  type: "list",
                  description:
                    "List of action dicts, one per <|web_action|> marker in speak, in order.",
                },
              },
            },
            next: "response",
          },
          response: {
            type: "out",
            parameters: {
              variables: ["speak", "actions"],
              interruption_type: "no",
              interruption_metadata: {},
            },
            next: "ask_for_input",
          },
        },
        variables: {
          user_input: { type: "str" },
          conversation_history: { type: "list", default: [] },
          speak: { type: "str" },
          actions: { type: "list", default: [] },
          node_type: { type: "str" },
        },
        start_node: "greeting",
      },
      "webhook-url": "",
    },
    ...buildVoiceCustoms(),
  };
}
