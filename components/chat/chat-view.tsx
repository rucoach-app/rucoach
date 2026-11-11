'use client'

import {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  memo,
} from 'react'
import { createClient } from '@/lib/supabase/client'
import { sendMessage, markMessagesAsRead } from '@/app/actions/messages'
import { CHAT_THREAD_MESSAGE_LIMIT } from '@/lib/performance-limits'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { cn } from '@/lib/utils'
import Image from 'next/image'
import Link from 'next/link'
import { toast } from 'sonner'
import {
  MessageCircle,
  ChevronLeft,
  Send,
  Smile,
  Check,
  CheckCheck,
  Search,
  UsersRound,
  CalendarDays,
  Trophy,
  Dumbbell,
  Sparkles,
} from 'lucide-react'

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const EMOJI_PICKER = ['💪', '🔥', '⭐', '🎯', '👍', '❤️', '👏', '✨']

const ADMIN_QUICK_REPLIES = [
  { text: '¡Excelente sesión!', icon: Trophy },
  { text: '¿Cómo te fue el entreno?', icon: Dumbbell },
  { text: 'Recuerda hidratarte.', icon: Sparkles },
  { text: 'Avísame si algo duele al hacer el movimiento.', icon: MessageCircle },
] as const

const CLIENT_QUICK_REPLIES = [
  { text: '¡Listo el entreno de hoy!', icon: Trophy },
  { text: 'Tengo una duda con un ejercicio', icon: Dumbbell },
  { text: 'Sentí una molestia entrenando', icon: MessageCircle },
  { text: '¿Cómo ves mi progreso?', icon: Sparkles },
] as const

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface Message {
  id: string
  from_user_id: string
  to_user_id: string
  content: string
  is_read: boolean
  created_at: string
}

export interface ChatViewProps {
  currentUserId: string
  role: string
  otherUser: { id: string; name: string; avatarUrl?: string | null } | null
  conversations: {
    id: string
    name: string
    avatarUrl?: string | null
    lastMessage?: string
    lastAt?: string
    unread: number
  }[]
  initialSelectedUserId?: string | null
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatTime(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  if (now.toDateString() === d.toDateString()) {
    return d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  }
  return (
    d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) +
    ' · ' +
    d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
  )
}

function dayKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

function formatDaySeparator(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  if (now.toDateString() === d.toDateString()) return 'Hoy'
  const y = new Date(now)
  y.setDate(y.getDate() - 1)
  if (y.toDateString() === d.toDateString()) return 'Ayer'
  return d.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })
}

type MessageRow =
  | { kind: 'sep'; key: string; label: string }
  | { kind: 'msg'; m: Message }

function buildMessageRows(messages: Message[]): MessageRow[] {
  const rows: MessageRow[] = []
  let lastKey = ''
  for (const m of messages) {
    const k = dayKey(m.created_at)
    if (k !== lastKey) {
      lastKey = k
      rows.push({ kind: 'sep', key: `sep-${k}`, label: formatDaySeparator(m.created_at) })
    }
    rows.push({ kind: 'msg', m })
  }
  return rows
}

/* ------------------------------------------------------------------ */
/*  Shared header fragment — logo or sidebar trigger                   */
/*  Matches AdminPageHeader / ClientStackPageHeader top-level pattern  */
/* ------------------------------------------------------------------ */

function PageHeaderLeadingIcon() {
  return (
    <div className="flex items-center md:hidden">
      <div className="size-10 sm:size-11 rounded-full overflow-hidden border border-primary/20 shadow-xs shrink-0 bg-primary/10 flex items-center justify-center p-1.5">
        <Image
          src="/android-chrome-192x192.png"
          alt="Logo RU Coach"
          width={36}
          height={36}
          className="size-full object-contain p-0.5"
        />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Conversation row — sidebar item for admin inbox                    */
/* ------------------------------------------------------------------ */

function stripMarkdownBold(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, '$1')
}

function renderFormattedMessage(text: string) {
  const parts = text.split(/(\*\*.*?\*\*)/g)
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={idx} className="font-bold">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return part
  })
}

const ConversationRow = memo(function ConversationRow({
  c,
  selected,
  onSelect,
}: {
  c: ChatViewProps['conversations'][number]
  selected: boolean
  onSelect: () => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          'flex w-full min-h-14 items-center gap-3 px-4 py-3 text-left transition-colors',
          'hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          selected && 'bg-primary/10 border-l-[3px] border-l-primary',
          !selected && 'border-l-[3px] border-l-transparent',
        )}
      >
        <Avatar className="size-11 shrink-0">
          <AvatarImage src={c.avatarUrl ?? undefined} alt="" />
          <AvatarFallback className="bg-muted text-sm font-medium">
            {c.name.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{c.name}</span>
            {c.lastAt ? (
              <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                {formatTime(c.lastAt)}
              </span>
            ) : null}
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {c.lastMessage ? stripMarkdownBold(c.lastMessage) : 'Sin mensajes todavía'}
          </p>
        </div>
        {c.unread > 0 ? (
          <Badge className="shrink-0 tabular-nums" variant="default">
            {c.unread > 99 ? '99+' : c.unread}
          </Badge>
        ) : null}
      </button>
    </li>
  )
})

/* ------------------------------------------------------------------ */
/*  Message bubble                                                     */
/* ------------------------------------------------------------------ */

const MessageBubble = memo(function MessageBubble({
  message: m,
  isMe,
}: {
  message: Message
  isMe: boolean
}) {
  return (
    <div className={cn('flex', isMe ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[min(85vw,28rem)] rounded-2xl px-3.5 py-2.5 shadow-sm sm:max-w-[75%]',
          isMe
            ? 'rounded-br-md bg-primary text-primary-foreground'
            : 'rounded-bl-md border border-border/80 bg-card text-card-foreground',
        )}
      >
        <p className="wrap-break-word whitespace-pre-wrap text-[15px] leading-relaxed sm:text-sm">
          {renderFormattedMessage(m.content)}
        </p>
        <div
          className={cn(
            'mt-1 flex items-center justify-end gap-1',
            isMe ? 'text-primary-foreground/80' : 'text-muted-foreground',
          )}
        >
          <time className="text-[10px] tabular-nums" dateTime={m.created_at}>
            {formatTime(m.created_at)}
          </time>
          {isMe ? (
            m.is_read ? (
              <CheckCheck className="size-3.5 shrink-0 opacity-90" aria-label="Leído" />
            ) : (
              <Check className="size-3.5 shrink-0 opacity-90" aria-label="Enviado" />
            )
          ) : null}
        </div>
      </div>
    </div>
  )
})

/* ------------------------------------------------------------------ */
/*  Empty‑chat inline hint                                             */
/* ------------------------------------------------------------------ */

function EmptyInlineHint({ role }: { role: string }) {
  const isClient = role === 'client'
  return (
    <>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <Sparkles />
        </EmptyMedia>
        <EmptyTitle className="text-base">{isClient ? 'Primer mensaje' : 'Inicia el chat'}</EmptyTitle>
        <EmptyDescription>
          {isClient
            ? 'Escribe abajo o usa una respuesta rápida. Tu coach verá el mensaje al instante.'
            : 'Saluda a tu asesorado o envía un recordatorio desde las sugerencias.'}
        </EmptyDescription>
      </EmptyHeader>
    </>
  )
}

/* ------------------------------------------------------------------ */
/*  Thread pane — messages + input (used by both admin and client)     */
/* ------------------------------------------------------------------ */

function ThreadPane({
  peer,
  currentUserId,
  role,
  isAdmin,
  messages: _messages,
  messagesLoading,
  messageRows,
  input,
  setInput,
  sending,
  handleSend,
  textareaRef,
  messagesContainerRef,
  messagesEndRef,
  emojiOpen,
  setEmojiOpen,
  isKeyboardOpen,
  onInputFocusChange,
  onBack,
}: {
  peer: { id: string; name: string; avatarUrl?: string | null }
  currentUserId: string
  role: string
  isAdmin: boolean
  messages: Message[]
  messagesLoading: boolean
  messageRows: MessageRow[]
  input: string
  setInput: (v: string | ((prev: string) => string)) => void
  sending: boolean
  handleSend: () => Promise<void>
  textareaRef: React.RefObject<HTMLTextAreaElement | null>
  messagesContainerRef: React.RefObject<HTMLDivElement | null>
  messagesEndRef: React.RefObject<HTMLDivElement | null>
  emojiOpen: boolean
  setEmojiOpen: (v: boolean) => void
  isKeyboardOpen: boolean
  onInputFocusChange: (focused: boolean) => void
  onBack?: () => void
}) {
  const quickReplies =
    role === 'client' ? CLIENT_QUICK_REPLIES : ADMIN_QUICK_REPLIES

  return (
    <div className="flex w-full min-h-0 flex-1 flex-col relative overflow-hidden">
      {/* ─── Thread header ─── */}
      <header className="shrink-0 flex items-center gap-3 border-b border-border/50 bg-background/90 backdrop-blur-xl safe-area-header-pt safe-area-x transition-all">
        <div
          className={cn(
            'flex items-center gap-3 sm:gap-4 px-4 sm:px-6 md:px-8 w-full',
            isKeyboardOpen
              ? 'min-h-[56px] sm:min-h-[104px] py-2 sm:py-0'
              : 'min-h-[68px] sm:min-h-[104px] py-3 sm:py-0',
          )}
        >
          {/* Leading icon: back chevron only (admin mobile). El cliente ya navega con la barra inferior,
              así que no se repite el logo junto a la foto del coach. */}
          {isAdmin && onBack ? (
            <div className="shrink-0 flex items-center h-full md:hidden">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="-ml-3 size-10 sm:size-11 rounded-full hover:bg-primary/10 hover:text-primary transition-all duration-300"
                onClick={onBack}
                aria-label="Volver a la lista de conversaciones"
              >
                <ChevronLeft className="size-6 sm:size-7" strokeWidth={2.5} />
              </Button>
            </div>
          ) : null}

          {/* Peer info */}
          <Avatar className="size-11 shrink-0 ring-2 ring-primary/20 sm:size-12">
            <AvatarImage
              src={peer.avatarUrl ?? undefined}
              alt={peer.name}
              className="object-cover"
            />
            <AvatarFallback className="bg-primary/15 text-sm font-black text-primary">
              {peer.name
                .split(' ')
                .filter(Boolean)
                .slice(0, 2)
                .map((w) => w[0])
                .join('')
                .toUpperCase() || peer.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1 flex flex-col justify-center">
            <h1 className="truncate text-base font-black tracking-tight sm:text-lg lg:text-xl">
              {peer.name}
            </h1>
            <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground/80 leading-none mt-1">
              {role === 'client' ? 'Tu coach' : 'Asesorado'}
            </p>
          </div>
        </div>
      </header>

      {/* ─── Messages area ─── */}
      <div
        ref={messagesContainerRef}
        className="flex flex-1 min-h-0 flex-col overflow-y-auto overscroll-contain bg-linear-to-b from-muted/15 to-background px-3 py-3 sm:px-4 sm:py-4"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
      >
        {messagesLoading ? (
          <div className="mx-auto mt-auto flex w-full max-w-2xl flex-col gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton
                key={i}
                className={cn(
                  'h-14 rounded-2xl',
                  i % 2 === 0
                    ? 'ms-8 w-[85%] sm:w-[70%]'
                    : 'me-8 w-[80%] sm:w-[60%]',
                )}
              />
            ))}
          </div>
        ) : messageRows.length === 0 ? (
          <Empty className="my-auto flex-none border-0 bg-transparent py-6">
            <EmptyInlineHint role={role} />
          </Empty>
        ) : (
          <div className="mx-auto mt-auto flex w-full max-w-2xl flex-col gap-3">
            {messageRows.map((row) =>
              row.kind === 'sep' ? (
                <div key={row.key} className="flex items-center gap-3 py-2">
                  <Separator className="flex-1" />
                  <span className="flex shrink-0 items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                    <CalendarDays className="size-3.5" aria-hidden />
                    {row.label}
                  </span>
                  <Separator className="flex-1" />
                </div>
              ) : (
                <MessageBubble
                  key={row.m.id}
                  message={row.m}
                  isMe={row.m.from_user_id === currentUserId}
                />
              ),
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* ─── Composer footer ─── */}
      <footer className="shrink-0 border-t border-border bg-background md:safe-area-pb">
        <div className="container">
          <div className="mx-auto flex max-w-2xl flex-col gap-2 sm:gap-3 py-2 sm:py-3">
            {/* Quick replies */}
            <div
              className={cn(
                'no-scrollbar flex gap-2 overflow-x-auto md:flex-wrap pb-0.5',
                isKeyboardOpen && input.trim().length > 0 && 'hidden md:flex',
              )}
              aria-label="Respuestas rápidas"
            >
              {quickReplies.map((qr) => (
                <Button
                  key={qr.text}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 sm:h-9 shrink-0 rounded-full px-3 text-xs font-normal"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    setInput(qr.text)
                    textareaRef.current?.focus()
                  }}
                >
                  <qr.icon data-icon="inline-start" />
                  {qr.text}
                </Button>
              ))}
            </div>

            {/* Text area + send */}
            <div className="flex items-end gap-2 pb-0.5">
              <div className="relative flex-1 min-w-0">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onFocus={() => onInputFocusChange(true)}
                  onBlur={() => onInputFocusChange(false)}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      void handleSend()
                    }
                  }}
                  placeholder="Escribe un mensaje…"
                  rows={1}
                  className="max-h-[110px] min-h-11 w-full resize-none overflow-y-auto rounded-2xl pr-12 text-base scrollbar-hide sm:text-sm"
                  aria-label="Mensaje"
                />
                <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute bottom-1.5 right-1.5 size-9 rounded-xl"
                      aria-label="Insertar emoji"
                    >
                      <Smile />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-2" align="end" side="top">
                    <div className="grid max-w-[240px] grid-cols-5 gap-1">
                      {EMOJI_PICKER.map((emo) => (
                        <button
                          key={emo}
                          type="button"
                          className="rounded-md p-2 text-lg leading-none transition-colors hover:bg-muted"
                          onClick={() => {
                            setInput((prev: string) => prev + emo)
                            setEmojiOpen(false)
                            textareaRef.current?.focus()
                          }}
                        >
                          {emo}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
              <Button
                type="button"
                size="icon"
                className="mb-0.5 size-11 shrink-0 rounded-2xl shadow-sm active:scale-95 transition-all"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => void handleSend()}
                disabled={!input.trim() || sending}
                aria-label="Enviar"
              >
                {sending ? <Spinner className="size-5" /> : <Send />}
              </Button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main ChatView component                                            */
/* ------------------------------------------------------------------ */

export function ChatView({
  currentUserId,
  role,
  otherUser,
  conversations,
  initialSelectedUserId,
}: ChatViewProps) {
  const supabase = useRef(createClient()).current
  const isAdmin = role === 'admin'
  const [conversationsState, setConversationsState] = useState(conversations)

  useEffect(() => {
    setConversationsState(conversations)
  }, [conversations])

  const validInitialId = useMemo(() => {
    if (!initialSelectedUserId) return null
    return conversations.some((c) => c.id === initialSelectedUserId)
      ? initialSelectedUserId
      : null
  }, [initialSelectedUserId, conversations])

  const [selectedUserId, setSelectedUserId] = useState<string | null>(() =>
    role === 'client'
      ? otherUser?.id ?? null
      : validInitialId ?? conversations[0]?.id ?? null,
  )
  const [adminMobilePane, setAdminMobilePane] = useState<'inbox' | 'thread'>(
    () => (validInitialId ? 'thread' : 'inbox'),
  )
  const adminMobilePaneRef = useRef(adminMobilePane)
  useEffect(() => {
    adminMobilePaneRef.current = adminMobilePane
  }, [adminMobilePane])

  const [messages, setMessages] = useState<Message[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [inboxQuery, setInboxQuery] = useState('')
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [isInputFocused, setIsInputFocused] = useState(false)
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false)
  const [mobileViewportHeight, setMobileViewportHeight] = useState<number | null>(
    null,
  )

  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const lastLoadedPeerRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isAdmin || !validInitialId) return
    setSelectedUserId(validInitialId)
    setAdminMobilePane('thread')
  }, [isAdmin, validInitialId])

  useEffect(() => {
    if (!isAdmin || conversationsState.length === 0) return
    setSelectedUserId((prev) => prev ?? conversationsState[0].id)
  }, [isAdmin, conversationsState])

  useEffect(() => {
    if (role === 'client' && otherUser) {
      setSelectedUserId(otherUser.id)
    }
  }, [role, otherUser?.id])

  const filteredConversations = useMemo(() => {
    const q = inboxQuery.trim().toLowerCase()
    if (!q) return conversationsState
    return conversationsState.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.lastMessage ?? '').toLowerCase().includes(q),
    )
  }, [conversationsState, inboxQuery])

  const peer =
    role === 'client'
      ? otherUser
      : selectedUserId
        ? {
            id: selectedUserId,
            name:
              conversationsState.find((c) => c.id === selectedUserId)?.name ??
              'Cliente',
            avatarUrl: conversationsState.find((c) => c.id === selectedUserId)
              ?.avatarUrl,
          }
        : null

  const scrollToEnd = useCallback((smooth = true) => {
    const container = messagesContainerRef.current
    if (container) {
      const reduce =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
      container.scrollTo({
        top: container.scrollHeight,
        behavior: !smooth || reduce ? 'auto' : 'smooth',
      })
      return
    }
    const el = messagesEndRef.current
    if (!el) return
    el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'end' })
  }, [])

  // Sincronizar con el teclado virtual móvil (iOS Safari / Android Chrome) para que
  // nunca empuje el header ni oculte los mensajes enviados
  useEffect(() => {
    if (typeof window === 'undefined') return

    const vv = window.visualViewport
    const updateViewport = () => {
      const isMobile = window.innerWidth < 768
      if (!isMobile) {
        setIsKeyboardOpen(false)
        setMobileViewportHeight(null)
        delete document.documentElement.dataset.chatKeyboardOpen
        return
      }

      const vvHeight = vv ? Math.round(vv.height) : window.innerHeight
      const heightDiff = window.innerHeight - vvHeight
      const keyboardActive = heightDiff > 110 || isInputFocused

      setIsKeyboardOpen(keyboardActive)
      if (keyboardActive) {
        document.documentElement.dataset.chatKeyboardOpen = 'true'
        setMobileViewportHeight(vvHeight)
        if (window.scrollY !== 0) {
          window.scrollTo(0, 0)
        }
        requestAnimationFrame(() => scrollToEnd(false))
      } else {
        delete document.documentElement.dataset.chatKeyboardOpen
        setMobileViewportHeight(null)
      }
    }

    updateViewport()
    vv?.addEventListener('resize', updateViewport)
    vv?.addEventListener('scroll', updateViewport)
    window.addEventListener('resize', updateViewport)

    return () => {
      vv?.removeEventListener('resize', updateViewport)
      vv?.removeEventListener('scroll', updateViewport)
      window.removeEventListener('resize', updateViewport)
      delete document.documentElement.dataset.chatKeyboardOpen
    }
  }, [isInputFocused, scrollToEnd])

  useEffect(() => {
    if (!selectedUserId) return

    let cancelled = false
    let pgChannel: ReturnType<typeof supabase.channel> | null = null
    let syncChannel: ReturnType<typeof supabase.channel> | null = null

    const isPeerSwitch = lastLoadedPeerRef.current !== selectedUserId
    if (isPeerSwitch) {
      setMessagesLoading(true)
      setMessages([])
      lastLoadedPeerRef.current = selectedUserId
    }

    const shouldMarkReadNow = () =>
      !isAdmin ||
      adminMobilePaneRef.current === 'thread' ||
      (typeof window !== 'undefined' && window.innerWidth >= 768)

    const load = async (silent = false) => {
      const pairFilter = `and(from_user_id.eq.${currentUserId},to_user_id.eq.${selectedUserId}),and(from_user_id.eq.${selectedUserId},to_user_id.eq.${currentUserId})`
      const { data: rows } = await supabase
        .from('messages')
        .select('id, from_user_id, to_user_id, content, is_read, created_at')
        .or(pairFilter)
        .order('created_at', { ascending: false })
        .limit(CHAT_THREAD_MESSAGE_LIMIT)

      if (cancelled) return

      const chronological = [...(rows ?? [])].reverse()
      let hasNewUnreadFromPeer = false

      setMessages((prev) => {
        if (prev.length === 0) {
          hasNewUnreadFromPeer = chronological.some(
            (m) => m.from_user_id === selectedUserId && !m.is_read,
          )
          return chronological
        }
        const prevIds = new Set(prev.map((p) => p.id))
        const byId = new Map<string, Message>()
        for (const m of chronological) {
          byId.set(m.id, m)
          if (!prevIds.has(m.id) && m.from_user_id === selectedUserId) {
            hasNewUnreadFromPeer = true
          }
        }
        for (const m of prev) {
          const involvesSelected =
            (m.from_user_id === currentUserId &&
              m.to_user_id === selectedUserId) ||
            (m.from_user_id === selectedUserId &&
              m.to_user_id === currentUserId)
          if (involvesSelected && !byId.has(m.id)) {
            byId.set(m.id, m)
          }
        }
        const merged = Array.from(byId.values())
          .sort((a, b) => a.created_at.localeCompare(b.created_at))
          .slice(-CHAT_THREAD_MESSAGE_LIMIT)

        // Evitar re-render si no cambió ningún mensaje ni su estado is_read
        if (
          merged.length === prev.length &&
          merged.every(
            (m, idx) =>
              m.id === prev[idx].id && m.is_read === prev[idx].is_read,
          )
        ) {
          return prev
        }
        return merged
      })

      if (!silent) {
        setMessagesLoading(false)
      }

      if ((!silent || hasNewUnreadFromPeer) && shouldMarkReadNow()) {
        setConversationsState((prev) =>
          prev.map((c) => (c.id === selectedUserId ? { ...c, unread: 0 } : c)),
        )
        void markMessagesAsRead(selectedUserId)
      }
    }

    const handleRealtimeInsert = (m: Message) => {
      if (!m?.id) return
      const involvesMe =
        m.from_user_id === currentUserId || m.to_user_id === currentUserId
      if (!involvesMe) return

      const peerId =
        m.from_user_id === currentUserId ? m.to_user_id : m.from_user_id
      const isCurrentThread = peerId === selectedUserId
      const threadVisible = shouldMarkReadNow()

      if (isAdmin) {
        setConversationsState((prev) =>
          prev
            .map((c) => {
              if (c.id !== peerId) return c
              const shouldIncrementUnread =
                m.to_user_id === currentUserId &&
                (!isCurrentThread || !threadVisible)
              return {
                ...c,
                lastMessage: m.content,
                lastAt: m.created_at,
                unread: shouldIncrementUnread
                  ? (c.unread || 0) + 1
                  : isCurrentThread && threadVisible
                    ? 0
                    : c.unread,
              }
            })
            .sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || '')),
        )
      }

      if (isCurrentThread) {
        setMessages((prev) => {
          if (prev.some((x) => x.id === m.id)) return prev
          const next = [...prev, m]
          return next.length > CHAT_THREAD_MESSAGE_LIMIT
            ? next.slice(-CHAT_THREAD_MESSAGE_LIMIT)
            : next
        })
        if (m.to_user_id === currentUserId && threadVisible) {
          void markMessagesAsRead(selectedUserId)
        }
      }
    }

    const initRealtime = async () => {
      void load(false)

      const {
        data: { session },
      } = await supabase.auth.getSession()
      if (cancelled) return

      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token)
      }

      const chanId = `messages:${currentUserId}:${selectedUserId}`
      pgChannel = supabase
        .channel(chanId)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'messages' },
          (payload) => {
            handleRealtimeInsert(payload.new as Message)
          },
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'messages' },
          (payload) => {
            const updated = payload.new as Message
            setMessages((prev) =>
              prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)),
            )
          },
        )
        .subscribe()

      syncChannel = supabase
        .channel(`chat-sync:${currentUserId}`)
        .on('broadcast', { event: 'new_message' }, ({ payload }) => {
          handleRealtimeInsert(payload as Message)
        })
        .subscribe()
    }

    void initRealtime()

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        void load(true)
      }
    }

    window.addEventListener('focus', handleVisibilityOrFocus)
    document.addEventListener('visibilitychange', handleVisibilityOrFocus)

    const pollId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void load(true)
      }
    }, 3500)

    return () => {
      cancelled = true
      window.removeEventListener('focus', handleVisibilityOrFocus)
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus)
      window.clearInterval(pollId)
      if (pgChannel) void supabase.removeChannel(pgChannel)
      if (syncChannel) void supabase.removeChannel(syncChannel)
    }
  }, [selectedUserId, currentUserId, isAdmin, supabase])

  useEffect(() => {
    if (!isAdmin || adminMobilePane !== 'thread' || !selectedUserId) return
    setConversationsState((prev) =>
      prev.map((c) => (c.id === selectedUserId ? { ...c, unread: 0 } : c)),
    )
    void markMessagesAsRead(selectedUserId)
  }, [isAdmin, adminMobilePane, selectedUserId])

  useEffect(() => {
    if (messagesLoading) return
    const id = requestAnimationFrame(() => scrollToEnd(true))
    return () => cancelAnimationFrame(id)
  }, [messages.length, messagesLoading, scrollToEnd])

  const handleSelectConversation = useCallback((id: string) => {
    setSelectedUserId(id)
    setAdminMobilePane('thread')
    setConversationsState((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unread: 0 } : c)),
    )
    void markMessagesAsRead(id)
  }, [])

  const handleSend = useCallback(async () => {
    const text = input.trim()
    if (!text || !selectedUserId || sending) return
    setSending(true)
    setInput('')
    try {
      const inserted = await sendMessage(selectedUserId, text)
      if (inserted) {
        setMessages((prev) => {
          if (prev.some((x) => x.id === inserted.id)) return prev
          const next = [...prev, inserted as Message]
          return next.length > CHAT_THREAD_MESSAGE_LIMIT
            ? next.slice(-CHAT_THREAD_MESSAGE_LIMIT)
            : next
        })
        if (isAdmin) {
          setConversationsState((prev) =>
            prev
              .map((c) =>
                c.id === selectedUserId
                  ? {
                      ...c,
                      lastMessage: inserted.content,
                      lastAt: inserted.created_at,
                      unread: 0,
                    }
                  : c,
              )
              .sort((a, b) => (b.lastAt || '').localeCompare(a.lastAt || '')),
          )
        }

        // Emitir por Broadcast directo para entrega <50ms en el chat y banner del destinatario
        void supabase
          .channel(`chat-sync:${selectedUserId}`)
          .httpSend('new_message', inserted)
          .catch(() => {})
        void supabase
          .channel(`inbox-notify:${selectedUserId}`)
          .httpSend('new_message', inserted)
          .catch(() => {})
      }
    } catch {
      setInput(text)
      toast.error('No se pudo enviar el mensaje. Intenta de nuevo.')
    } finally {
      setSending(false)
      textareaRef.current?.focus()
    }
  }, [input, selectedUserId, sending, isAdmin, supabase])

  const messageRows = useMemo(() => buildMessageRows(messages), [messages])

  const mobileContainerStyle = useMemo(
    () =>
      isKeyboardOpen && mobileViewportHeight
        ? {
            height: `${mobileViewportHeight}px`,
            maxHeight: `${mobileViewportHeight}px`,
          }
        : undefined,
    [isKeyboardOpen, mobileViewportHeight],
  )

  /* ── Client with no coach ── */
  if (role === 'client' && !otherUser) return null

  /* ── Admin with zero conversations ── */
  if (isAdmin && conversationsState.length === 0) {
    return (
      <div className="flex h-full w-full min-h-0 flex-1 flex-col relative overflow-hidden">
        {/* Consistent AdminPageHeader-style header */}
        <header className="shrink-0 border-b border-border/50 bg-background/85 backdrop-blur-xl safe-area-header-pt safe-area-x flex items-center">
          <div className="flex min-h-[68px] sm:min-h-[104px] items-center gap-4 px-4 py-3 sm:px-6 md:px-8 sm:py-0 w-full">
            <PageHeaderLeadingIcon />
            <div className="min-w-0 flex flex-col justify-center">
              <h1 className="text-xl font-black tracking-tight text-pretty sm:text-2xl text-foreground leading-[1.1]">
                Mensajes
              </h1>
              <p className="mt-1 line-clamp-1 text-xs text-muted-foreground/90 font-medium">
                Tus conversaciones con clientes
              </p>
            </div>
          </div>
        </header>
        <Empty className="flex-1 border-0">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <UsersRound />
            </EmptyMedia>
            <EmptyTitle>Aún no hay conversaciones</EmptyTitle>
            <EmptyDescription>
              Cuando tus asesorados tengan cuenta vinculada aparecerán aquí para chatear en vivo.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button asChild variant="secondary">
              <Link href="/admin/clients">Gestionar asesorados</Link>
            </Button>
          </EmptyContent>
        </Empty>
      </div>
    )
  }

  /* ── Client chat (single thread — no inbox) ── */
  if (!isAdmin && peer) {
    return (
      <div
        style={mobileContainerStyle}
        className="flex h-full w-full min-h-0 flex-1 flex-col bg-background overflow-hidden"
      >
        <ThreadPane
          peer={peer}
          currentUserId={currentUserId}
          role={role}
          isAdmin={false}
          messages={messages}
          messagesLoading={messagesLoading}
          messageRows={messageRows}
          input={input}
          setInput={setInput}
          sending={sending}
          handleSend={handleSend}
          textareaRef={textareaRef}
          messagesContainerRef={messagesContainerRef}
          messagesEndRef={messagesEndRef}
          emojiOpen={emojiOpen}
          setEmojiOpen={setEmojiOpen}
          isKeyboardOpen={isKeyboardOpen}
          onInputFocusChange={setIsInputFocused}
        />
      </div>
    )
  }

  /* ── Admin layout: inbox sidebar + thread pane ── */
  return (
    <div
      style={mobileContainerStyle}
      className="flex h-full w-full min-h-0 flex-1 bg-background overflow-hidden"
    >
      {/* ─── Inbox sidebar ─── */}
      <aside
        className={cn(
          'flex min-h-0 w-full flex-col border-r border-border bg-muted/20 md:w-[min(100%,20rem)] md:shrink-0',
          adminMobilePane === 'thread' && 'hidden md:flex',
        )}
        aria-label="Lista de conversaciones"
      >
        {/* Inbox header — matches AdminPageHeader structure */}
        <header className="shrink-0 border-b border-border/50 bg-background/85 backdrop-blur-xl safe-area-header-pt safe-area-x flex items-center">
          <div className="flex min-h-[68px] sm:min-h-[104px] items-center gap-4 px-4 py-3 sm:px-6 sm:py-0 w-full">
            <PageHeaderLeadingIcon />
            <div className="min-w-0 flex flex-col justify-center">
              <h1 className="text-xl font-black tracking-tight text-pretty sm:text-2xl text-foreground leading-[1.1]">
                Mensajes
              </h1>
              <p className="mt-1 line-clamp-1 text-xs text-muted-foreground/90 font-medium">
                Tus conversaciones con clientes
              </p>
            </div>
          </div>
        </header>
        <div className="p-3 border-b border-border/50 bg-background/40 shrink-0">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={inboxQuery}
              onChange={(e) => setInboxQuery(e.target.value)}
              placeholder="Buscar asesorado…"
              className="h-10 pl-9"
              aria-label="Buscar conversación"
            />
          </div>
        </div>
        <ul className="flex-1 overflow-y-auto overscroll-contain" role="list">
          {filteredConversations.length === 0 ? (
            <li className="px-4 py-8 text-center text-sm text-muted-foreground">
              No coincide con tu búsqueda.
            </li>
          ) : (
            filteredConversations.map((c) => (
              <ConversationRow
                key={c.id}
                c={c}
                selected={selectedUserId === c.id}
                onSelect={() => handleSelectConversation(c.id)}
              />
            ))
          )}
        </ul>
      </aside>

      {/* ─── Thread pane ─── */}
      <section
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-col',
          isAdmin && adminMobilePane === 'inbox' && 'hidden md:flex',
        )}
        aria-label={peer ? `Chat con ${peer.name}` : 'Selecciona conversación'}
      >
        {peer ? (
          <ThreadPane
            peer={peer}
            currentUserId={currentUserId}
            role={role}
            isAdmin={true}
            messages={messages}
            messagesLoading={messagesLoading}
            messageRows={messageRows}
            input={input}
            setInput={setInput}
            sending={sending}
            handleSend={handleSend}
            textareaRef={textareaRef}
            messagesContainerRef={messagesContainerRef}
            messagesEndRef={messagesEndRef}
            emojiOpen={emojiOpen}
            setEmojiOpen={setEmojiOpen}
            isKeyboardOpen={isKeyboardOpen}
            onInputFocusChange={setIsInputFocused}
            onBack={() => setAdminMobilePane('inbox')}
          />
        ) : (
          <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground">
            {isAdmin ? 'Selecciona un asesorado para ver el chat.' : null}
          </div>
        )}
      </section>
    </div>
  )
}

