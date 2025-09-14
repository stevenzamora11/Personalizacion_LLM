import { useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'

type ReasoningEffort = 'high' | 'medium' | 'low' | 'minimal'

interface Message {
  id: string
  content: string
  isUser: boolean
  timestamp: Date
}

interface ChatResponse {
  message: string
}

interface Params {
  temperature: number
  top_p: number | null
  top_k: number | null
  reasoning_effort: ReasoningEffort
}

// Config
const DEFAULT_PARAMS: Params = {
  temperature: 1.0,
  top_p: 1.0,     // por defecto top_p activo
  top_k: null,    // top_k apagado
  reasoning_effort: 'medium',
}

const API_URL = import.meta.env.VITE_API_URL ?? 'https://llm-bootcamp.cardor.dev/api/completion';

// Helper de validación
function validateParams(p: Params): Array<string> {
  const errs: Array<string> = []

  if (Number.isNaN(p.temperature) || p.temperature < 0 || p.temperature > 2) {
    errs.push('Temperature debe estar entre 0 y 2.')
  }
  if (p.top_p !== null) {
    if (Number.isNaN(p.top_p) || p.top_p < 0 || p.top_p > 1) {
      errs.push('Top-p debe estar entre 0 y 1.')
    }
  }
  if (p.top_k !== null) {
    if (
      Number.isNaN(p.top_k) ||
      p.top_k < 0 ||
      p.top_k > 20 ||
      !Number.isInteger(p.top_k)
    ) {
      errs.push('Top-k debe ser un entero entre 0 y 20.')
    }
  }
  if (p.top_p !== null && p.top_k !== null) {
    errs.push('Solo se permite enviar top-p o top-k, no ambos.')
  }
  if (!['high', 'medium', 'low', 'minimal'].includes(p.reasoning_effort)) {
    errs.push('Reasoning effort inválido.')
  }

  return errs
}

// Función para llamar al servidor de chat
async function sendMessage(input: string, params: Params): Promise<ChatResponse> {
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      input,
      params: {
        temperature: params.temperature,
        top_p: params.top_p,
        top_k: params.top_k,
        reasoning_effort: params.reasoning_effort,
      },
    }),
  })

  if (!response.ok) {
    let text = 'Error al enviar mensaje'
    try {
      const err = await response.json()
      text = err?.error ?? text
    }catch {}
    throw new Error(text)
  }

  const data = await response.json()
  return { message: data.message || data.content || 'Sin respuesta' }
}

export default function ChatInterface() {
  const [messages, setMessages] = useState<Array<Message>>([])
  const [inputValue, setInputValue] = useState('')
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS)

  // Validaciones
  const errors = useMemo(() => validateParams(params), [params])
  const sendDisabled = !inputValue.trim() || errors.length > 0

  // Si se escribe top_p apaga top_k y viceversa
  const setTopP = (v: string) => {
    const val = v === '' ? null : Number(v)
    setParams((p) => ({ ...p, top_p: val, top_k: val !== null ? null : p.top_k }))
  }
  const setTopK = (v: string) => {
    const n = v === '' ? null : Number(v)
    const val = n === null ? null : Math.trunc(n)
    setParams((p) => ({ ...p, top_k: val, top_p: val !== null ? null : p.top_p }))
  }

  const chatMutation = useMutation({
    mutationFn: ({ text, cfg }: { text: string; cfg: Params }) => sendMessage(text, cfg),
    onSuccess: (data) => {
      const botMessage: Message = {
        id: Date.now().toString() + '-bot',
        content: data.message,
        isUser: false,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, botMessage])
    },
    onError: (error: any) => {
      const errorMessage: Message = {
        id: Date.now().toString() + '-error',
        content: `❌ Error: ${error?.message ?? 'desconocido'}`,
        isUser: false,
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, errorMessage])
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!inputValue.trim() || chatMutation.isPending || errors.length > 0) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      isUser: true,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    chatMutation.mutate({ text: inputValue, cfg: params })
    setInputValue('')
  }

  const clearChat = () => {
    setMessages([])
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 p-4 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🤖</span>
          <h1 className="text-xl font-semibold text-gray-800">Chat Assistant</h1>
        </div>
        <button
          onClick={clearChat}
          className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors flex items-center gap-1"
        >
          🗑️ Limpiar
        </button>
      </div>

      {/* Área de mensajes */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 mt-20">
            <span className="text-4xl block mb-2">💬</span>
            <p>¡Hola! Escribe un mensaje para comenzar.</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex items-start gap-2 max-w-xs md:max-w-md lg:max-w-lg`}>
                {!message.isUser && (
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    🤖
                  </div>
                )}
                <div
                  className={`px-4 py-2 rounded-lg ${
                    message.isUser
                      ? 'bg-blue-500 text-white rounded-br-sm'
                      : 'bg-white border border-gray-200 rounded-bl-sm'
                  }`}
                >
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">
                    {message.content}
                  </p>
                  <p
                    className={`text-xs mt-1 ${
                      message.isUser ? 'text-blue-100' : 'text-gray-500'
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString()}
                  </p>
                </div>
                {message.isUser && (
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    👤
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {chatMutation.isPending && (
          <div className="flex justify-start">
            <div className="flex items-start gap-2">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                🤖
              </div>
              <div className="bg-white border border-gray-200 rounded-lg rounded-bl-sm px-4 py-2">
                <div className="flex items-center gap-1">
                  <span className="text-sm text-gray-500">Escribiendo</span>
                  <div className="flex gap-1">
                    <div className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"></div>
                    <div
                      className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: '0.1s' }}
                    ></div>
                    <div
                      className="w-1 h-1 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: '0.2s' }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Config + Input, la config va sobre el input */}
      <div className="bg-white border-t border-gray-200 p-4 space-y-3">
        {/* Sección Configuración */}
        <section className="rounded-lg border border-gray-200 p-3">
          <h2 className="text-sm font-semibold mb-3">Configuración</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Temperature */}
            <div className="flex flex-col gap-1">
              <label htmlFor="temperature" className="text-xs font-medium">
                Temperature (0–2)
              </label>
              <input
                id="temperature"
                type="number"
                min={0}
                max={2}
                step={0.1}
                className="rounded-md border px-2 py-1"
                value={params.temperature}
                onChange={(e) =>
                  setParams((p) => ({ ...p, temperature: Number(e.target.value) }))
                }
              />
            </div>

            {/* Top-p */}
            <div className="flex flex-col gap-1">
              <label htmlFor="top_p" className="text-xs font-medium">
                Top-p (0–1)
              </label>
              <input
                id="top_p"
                type="number"
                min={0}
                max={1}
                step={0.05}
                className="rounded-md border px-2 py-1"
                value={params.top_p ?? ''}
                onChange={(e) => setTopP(e.target.value)}
                placeholder="p.ej. 0.9 (vacío si usas top-k)"
              />
            </div>

            {/* Top-k */}
            <div className="flex flex-col gap-1">
              <label htmlFor="top_k" className="text-xs font-medium">
                Top-k (0–20)
              </label>
              <input
                id="top_k"
                type="number"
                min={0}
                max={20}
                step={1}
                className="rounded-md border px-2 py-1"
                value={params.top_k ?? ''}
                onChange={(e) => setTopK(e.target.value)}
                placeholder="entero (vacío si usas top-p)"
              />
            </div>

            {/* Reasoning effort */}
            <div className="flex flex-col gap-1">
              <label htmlFor="reasoning_effort" className="text-xs font-medium">
                Reasoning effort
              </label>
              <select
                id="reasoning_effort"
                className="rounded-md border px-2 py-1"
                value={params.reasoning_effort}
                onChange={(e) =>
                  setParams((p) => ({
                    ...p,
                    reasoning_effort: e.target.value as ReasoningEffort,
                  }))
                }
              >
                <option value="high">high</option>
                <option value="medium">medium</option>
                <option value="low">low</option>
                <option value="minimal">minimal</option>
              </select>
            </div>
          </div>

          {/* Errores */}
          {errors.length > 0 && (
            <ul className="mt-3 list-disc pl-5 text-sm text-red-600">
              {errors.map((er, i) => (
                <li key={i}>{er}</li>
              ))}
            </ul>
          )}
        </section>

        {/* Input Area */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="Escribe tu mensaje..."
            disabled={chatMutation.isPending}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100"
          />
          <button
            type="submit"
            disabled={sendDisabled || chatMutation.isPending}
            title={errors.length > 0 ? 'Corrige los parámetros' : 'Enviar'}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
          >
            <span>📤</span>
            Enviar
          </button>
        </form>
      </div>
    </div>
  )
}
