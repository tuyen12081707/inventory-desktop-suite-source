import { DeleteOutlined, RobotOutlined, SendOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { Button, Drawer, Empty, Grid, Input, Space, Spin, Tag, Typography } from 'antd';
import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { AiChatRequest, AiChatResponse } from '@inventory/contracts';
import { useAuth } from '../auth/AuthContext';
import { api, ApiError } from '../lib/api';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: string[];
}

interface PetPosition {
  x: number;
  y: number;
}

interface PetDragState {
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  moved: boolean;
}

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    'Xin chào! Tôi có thể tra tồn kho theo tên/SKU/barcode, liệt kê sản phẩm cần nhập và hướng dẫn sử dụng InventoryPro.',
};

const SUGGESTIONS = [
  'Sản phẩm nào đang sắp hết hàng?',
  'Tổng quan tồn kho hiện tại thế nào?',
  'Hướng dẫn tôi tạo phiếu nhập kho',
];

const toolLabels: Record<string, string> = {
  lookup_inventory: 'Dữ liệu sản phẩm',
  get_low_stock_products: 'Cảnh báo tồn',
  get_inventory_overview: 'Tổng quan kho',
  get_app_guide: 'Hướng dẫn app',
};

const PET_SIZE = 76;
const PET_POSITION_STORAGE_KEY = 'inventory.aiAssistant.petPosition';

function cleanAssistantText(content: string): string {
  return content
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/^#{1,6}\s+/gm, '')
    .trim();
}

export function AiAssistant(): React.JSX.Element | null {
  const { user } = useAuth();
  const screens = Grid.useBreakpoint();
  const mobile = screens.md === false;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const [petPosition, setPetPosition] = useState<PetPosition | null>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);
  const petDragRef = useRef<PetDragState | null>(null);
  const suppressPetClickRef = useRef(false);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(PET_POSITION_STORAGE_KEY);
      if (!stored) return;
      const parsed = JSON.parse(stored) as Partial<PetPosition>;
      if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') return;
      setPetPosition({
        x: Math.max(8, Math.min(parsed.x, window.innerWidth - PET_SIZE - 8)),
        y: Math.max(8, Math.min(parsed.y, window.innerHeight - PET_SIZE - 8)),
      });
    } catch {
      // A malformed saved position should never block the assistant.
    }
  }, []);

  const chat = useMutation({
    mutationFn: (conversation: AiChatRequest['messages']) =>
      api<AiChatResponse>('/assistant/chat', {
        method: 'POST',
        body: JSON.stringify({ messages: conversation }),
      }),
    onSuccess: (response) => {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: cleanAssistantText(response.answer),
          toolsUsed: response.toolsUsed,
        },
      ]);
    },
    onError: (error) => {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content:
            error instanceof ApiError
              ? error.message
              : 'Không thể kết nối trợ lý AI. Vui lòng thử lại.',
        },
      ]);
    },
  });

  useEffect(() => {
    if (open) messageEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open, chat.isPending]);

  if (!user?.permissions.includes('assistant.use')) return null;

  const send = (suggestion?: string): void => {
    const content = (suggestion ?? draft).trim();
    if (!content || chat.isPending) return;
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
    };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setDraft('');
    chat.mutate(
      nextMessages
        .map(({ role, content: messageContent }) => ({
          role,
          content: messageContent,
        }))
        .slice(-20),
    );
  };

  const resetConversation = (): void => {
    setMessages([WELCOME_MESSAGE]);
    setDraft('');
  };

  const movePet = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    const drag = petDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const x = Math.max(
      8,
      Math.min(drag.originX + event.clientX - drag.startX, window.innerWidth - PET_SIZE - 8),
    );
    const y = Math.max(
      8,
      Math.min(drag.originY + event.clientY - drag.startY, window.innerHeight - PET_SIZE - 8),
    );
    if (Math.abs(event.clientX - drag.startX) + Math.abs(event.clientY - drag.startY) > 5) {
      drag.moved = true;
    }
    setPetPosition({ x, y });
  };

  const startPetDrag = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    const rect = event.currentTarget.getBoundingClientRect();
    petDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: rect.left,
      originY: rect.top,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const finishPetDrag = (event: ReactPointerEvent<HTMLButtonElement>): void => {
    const drag = petDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    petDragRef.current = null;
    if (drag.moved) {
      suppressPetClickRef.current = true;
      const rect = event.currentTarget.getBoundingClientRect();
      const position = { x: Math.round(rect.left), y: Math.round(rect.top) };
      setPetPosition(position);
      try {
        localStorage.setItem(PET_POSITION_STORAGE_KEY, JSON.stringify(position));
      } catch {
        // Keeping a temporary position is enough when storage is unavailable.
      }
    }
  };

  const openFromPet = (): void => {
    if (suppressPetClickRef.current) {
      suppressPetClickRef.current = false;
      return;
    }
    setOpen(true);
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          className="ai-assistant-launcher no-print"
          style={petPosition ? { left: petPosition.x, top: petPosition.y } : undefined}
          aria-label="Mở trợ lý kho AI. Kéo để di chuyển"
          title="Kéo để di chuyển · Chạm để trò chuyện"
          onClick={openFromPet}
          onPointerDown={startPetDrag}
          onPointerMove={movePet}
          onPointerUp={finishPetDrag}
          onPointerCancel={finishPetDrag}
        >
          <span className="ai-pet-orbit" aria-hidden="true" />
          <span className="ai-pet-body" aria-hidden="true">
            <span className="ai-pet-antenna" />
            <RobotOutlined />
            <span className="ai-pet-eyes" />
          </span>
          <span className="ai-pet-label">Trợ lý AI</span>
        </button>
      )}
      <Drawer
        title={
          <Space>
            <RobotOutlined />
            Trợ lý kho AI
          </Space>
        }
        extra={
          <Button
            type="text"
            icon={<DeleteOutlined />}
            aria-label="Xóa hội thoại"
            onClick={resetConversation}
          />
        }
        placement="right"
        size={mobile ? '100%' : 440}
        open={open}
        onClose={() => setOpen(false)}
        className="ai-assistant-drawer"
        destroyOnHidden={false}
      >
        <div className="ai-chat-layout">
          <div className="ai-chat-messages" aria-live="polite">
            {messages.length === 0 ? (
              <Empty description="Chưa có hội thoại" />
            ) : (
              messages.map((message) => (
                <div className={`ai-chat-message ai-chat-message-${message.role}`} key={message.id}>
                  <div className="ai-chat-bubble">
                    <Typography.Paragraph>{message.content}</Typography.Paragraph>
                    {message.toolsUsed && message.toolsUsed.length > 0 && (
                      <Space size={[4, 4]} wrap className="ai-chat-tools">
                        {message.toolsUsed.map((tool) => (
                          <Tag key={tool}>{toolLabels[tool] ?? tool}</Tag>
                        ))}
                      </Space>
                    )}
                  </div>
                </div>
              ))
            )}
            {chat.isPending && (
              <div className="ai-chat-message ai-chat-message-assistant">
                <div className="ai-chat-bubble ai-chat-thinking">
                  <Spin size="small" />
                  <span>Đang tra cứu dữ liệu…</span>
                </div>
              </div>
            )}
            <div ref={messageEndRef} />
          </div>

          {messages.length === 1 && (
            <div className="ai-chat-suggestions">
              {SUGGESTIONS.map((suggestion) => (
                <Button key={suggestion} onClick={() => send(suggestion)}>
                  {suggestion}
                </Button>
              ))}
            </div>
          )}

          <div className="ai-chat-composer">
            <Input.TextArea
              value={draft}
              autoSize={{ minRows: 2, maxRows: 5 }}
              maxLength={4000}
              placeholder="Hỏi về sản phẩm, tồn kho hoặc cách dùng app…"
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  send();
                }
              }}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              disabled={!draft.trim()}
              loading={chat.isPending}
              onClick={() => send()}
            >
              Gửi
            </Button>
          </div>
          <Typography.Text type="secondary" className="ai-chat-disclaimer">
            AI có thể trả lời sai. Số liệu tồn được lấy từ hệ thống tại thời điểm hỏi.
          </Typography.Text>
        </div>
      </Drawer>
    </>
  );
}
