import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  Send, Bot, User, Check, Edit2, MessageSquare, Sparkles, AlertCircle,
} from 'lucide-react'
import { ai } from '../api/client'
import type { AIConversation, AIAskRequest } from '../types'

type ContextType = 'general' | 'training_analysis' | 'meet_prep'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: string
  overridden?: boolean
  overrideNote?: string
}

export default function AICoach() {
  const [contextType, setContextType] = useState<ContextType>('general')
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversationId, setConversationId] = useState<number | undefined>()
  const [overrideIdx, setOverrideIdx] = useState<number | null>(null)
  const [overrideText, setOverrideText] = useState('')
  const [aiUnavailable, setAiUnavailable] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const conversationsQuery = useQuery<AIConversation[]>({
    queryKey: ['ai', 'conversations'],
    queryFn: ai.conversations,
  })

  const askMutation = useMutation({
    mutationFn: (data: AIAskRequest) => ai.ask(data),
    onSuccess: (response: { message?: string; content?: string; conversation_id?: number }) => {
      const content = response.message || response.content || 'No response received.'
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content,
          timestamp: new Date().toISOString(),
        },
      ])
      if (response.conversation_id) {
        setConversationId(response.conversation_id)
      }
    },
    onError: (error: any) => {
      const status = error?.response?.status
      if (status === 501 || status === 503) {
        setAiUnavailable(true)
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content:
              'AI coaching is coming soon! This feature is currently under development.',
            timestamp: new Date().toISOString(),
          },
        ])
      } else {
        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            content: 'Sorry, something went wrong. Please try again.',
            timestamp: new Date().toISOString(),
          },
        ])
      }
    },
  })

  const overrideMutation = useMutation({
    mutationFn: ai.override,
  })

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    if (!input.trim() || askMutation.isPending) return
    const userMsg: ChatMessage = {
      role: 'user',
      content: input.trim(),
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    askMutation.mutate({
      message: input.trim(),
      context_type: contextType,
    })
    setInput('')
  }

  const handleOverride = (idx: number) => {
    if (!overrideText.trim()) return
    overrideMutation.mutate({
      conversation_id: conversationId ?? 0,
      user_override_notes: overrideText.trim(),
    })
    setMessages((prev) =>
      prev.map((m, i) =>
        i === idx ? { ...m, overridden: true, overrideNote: overrideText.trim() } : m,
      ),
    )
    setOverrideIdx(null)
    setOverrideText('')
  }

  const loadConversation = (conv: AIConversation) => {
    setConversationId(conv.id)
    const msgs: ChatMessage[] = []
    if (conv.user_message) {
      msgs.push({ role: 'user', content: conv.user_message, timestamp: conv.created_at })
    }
    if (conv.ai_response) {
      msgs.push({ role: 'assistant', content: conv.ai_response, timestamp: conv.created_at })
    }
    setMessages(msgs)
  }

  const CONTEXT_OPTIONS: { value: ContextType; label: string }[] = [
    { value: 'general', label: 'General' },
    { value: 'training_analysis', label: 'Training Analysis' },
    { value: 'meet_prep', label: 'Meet Prep' },
  ]

  return (
    <div className="p-6 max-w-5xl mx-auto h-[calc(100vh-5rem)] flex flex-col">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-4">
        <h1 className="text-3xl font-bold text-text flex items-center gap-3">
          <Bot size={28} className="text-primary" /> AI Coach
        </h1>
        <div className="flex items-center gap-2 bg-surface border border-surface-light rounded-lg p-1">
          {CONTEXT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setContextType(opt.value)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                contextType === opt.value
                  ? 'bg-primary text-white'
                  : 'text-text-muted hover:text-text'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {aiUnavailable && (
        <div className="bg-accent/10 border border-accent/30 rounded-lg p-4 mb-4 flex items-center gap-3">
          <AlertCircle size={18} className="text-accent" />
          <p className="text-accent text-sm">
            AI coaching is coming soon. Responses are placeholders for now.
          </p>
        </div>
      )}

      <div className="flex flex-1 gap-4 min-h-0">
        {/* Conversation history sidebar */}
        <div className="hidden lg:flex flex-col w-64 bg-surface rounded-xl border border-surface-light overflow-hidden">
          <div className="p-3 border-b border-surface-light">
            <h2 className="text-text font-medium text-sm flex items-center gap-2">
              <MessageSquare size={14} /> History
            </h2>
          </div>
          <div className="flex-1 overflow-y-auto">
            {conversationsQuery.isLoading && (
              <p className="p-3 text-text-muted text-sm">Loading...</p>
            )}
            {(conversationsQuery.data ?? []).length === 0 && !conversationsQuery.isLoading && (
              <p className="p-3 text-text-muted text-sm">No past conversations.</p>
            )}
            {(conversationsQuery.data ?? []).map((conv) => (
              <button
                key={conv.id}
                onClick={() => loadConversation(conv)}
                className={`w-full text-left px-3 py-2.5 border-b border-surface-light/50 hover:bg-surface-light/50 transition-colors ${
                  conversationId === conv.id ? 'bg-surface-light/50' : ''
                }`}
              >
                <p className="text-text text-sm font-medium truncate">{conv.user_message?.slice(0, 50) || conv.context_type || 'Conversation'}</p>
                <p className="text-text-muted text-xs mt-0.5">
                  {new Date(conv.created_at).toLocaleDateString()}
                </p>
              </button>
            ))}
          </div>
          <div className="p-2 border-t border-surface-light">
            <button
              onClick={() => {
                setMessages([])
                setConversationId(undefined)
              }}
              className="w-full text-sm text-primary hover:text-primary-dark font-medium py-1.5"
            >
              New Conversation
            </button>
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col bg-surface rounded-xl border border-surface-light overflow-hidden">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Sparkles size={48} className="text-primary/30 mb-4" />
                <p className="text-text-muted text-lg">Ask your AI coach anything</p>
                <p className="text-text-muted/60 text-sm mt-1 max-w-md">
                  Get training advice, analyze your progress, or plan for your next meet.
                </p>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : ''}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <Bot size={16} className="text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[75%] ${
                    msg.role === 'user'
                      ? 'bg-primary/20 rounded-2xl rounded-br-sm'
                      : 'bg-bg rounded-2xl rounded-bl-sm'
                  } px-4 py-3`}
                >
                  <p className="text-text text-sm whitespace-pre-wrap">{msg.content}</p>
                  <p className="text-text-muted text-[10px] mt-1">
                    {new Date(msg.timestamp).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>

                  {/* Accept / Override for assistant messages */}
                  {msg.role === 'assistant' && !msg.overridden && (
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() =>
                          setMessages((prev) =>
                            prev.map((m, i) => (i === idx ? { ...m, overridden: false } : m)),
                          )
                        }
                        className="flex items-center gap-1 text-xs text-success hover:text-success/80"
                      >
                        <Check size={12} /> Accept
                      </button>
                      <button
                        onClick={() => {
                          setOverrideIdx(idx)
                          setOverrideText('')
                        }}
                        className="flex items-center gap-1 text-xs text-accent hover:text-accent/80"
                      >
                        <Edit2 size={12} /> Override
                      </button>
                    </div>
                  )}

                  {msg.overridden && msg.overrideNote && (
                    <div className="mt-2 px-2 py-1.5 bg-accent/10 rounded text-xs text-accent">
                      Override: {msg.overrideNote}
                    </div>
                  )}

                  {/* Override input */}
                  {overrideIdx === idx && (
                    <div className="mt-2 flex gap-2">
                      <input
                        type="text"
                        value={overrideText}
                        onChange={(e) => setOverrideText(e.target.value)}
                        placeholder="Your notes..."
                        autoFocus
                        className="flex-1 bg-bg border border-surface-light rounded px-2 py-1 text-text text-xs focus:outline-none focus:border-primary"
                        onKeyDown={(e) => e.key === 'Enter' && handleOverride(idx)}
                      />
                      <button
                        onClick={() => handleOverride(idx)}
                        className="text-xs text-primary font-medium"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setOverrideIdx(null)}
                        className="text-xs text-text-muted"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-surface-light flex items-center justify-center shrink-0">
                    <User size={16} className="text-text-muted" />
                  </div>
                )}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>

          {/* Input area */}
          <div className="border-t border-surface-light p-4">
            <div className="flex gap-3">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder={
                  contextType === 'meet_prep'
                    ? 'Ask about meet preparation...'
                    : contextType === 'training_analysis'
                      ? 'Ask about your training data...'
                      : 'Ask your AI coach...'
                }
                className="flex-1 bg-bg border border-surface-light rounded-lg px-4 py-2.5 text-text placeholder:text-text-muted/50 focus:outline-none focus:border-primary"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || askMutation.isPending}
                className="bg-primary hover:bg-primary-dark text-white px-4 py-2.5 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <Send size={16} />
                {askMutation.isPending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
