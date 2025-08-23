import { createFileRoute } from '@tanstack/react-router'
import ChatInterface from '../components/ChatInterface'

export const Route = createFileRoute('/')({
  component: App,
})

function App() {
  return <ChatInterface />
}
