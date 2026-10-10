// Random greetings shown on the Dashboard and in the AI Assistant.

const GREETINGS = [
  (name) => `Hi ${name} 👋`,
  (name) => `Hey ${name} 👋`,
  (name) => `Welcome back, ${name} 👋`,
  (name) => `Good to see you, ${name} 👋`,
  (name) => `Hello, ${name} 👋`,
  (name) => `What's up, ${name} 👋`,
]

// Picks one random greeting for the given name.
export function randomGreeting(name) {
  const pick = GREETINGS[Math.floor(Math.random() * GREETINGS.length)]
  return pick(name)
}
