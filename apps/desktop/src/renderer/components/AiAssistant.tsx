import { DeleteOutlined, RobotOutlined, SendOutlined } from '@ant-design/icons';
import { useMutation } from '@tanstack/react-query';
import { Button, Drawer, Empty, Grid, Input, Space, Spin, Tag, Typography } from 'antd';
import { useEffect, useRef, useState } from 'react';
import type { AiChatRequest, AiChatResponse } from '@inventory/contracts';
import { useAuth } from '../auth/AuthContext';
import { api, ApiError } from '../lib/api';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: string[];
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

export function AiAssistant(): React.JSX.Element | null {
  const { user } = useAuth();
  const screens = Grid.useBreakpoint();
  const mobile = screens.md === false;
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE]);
  const messageEndRef = useRef<HTMLDivElement>(null);

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
          content: response.answer,
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

  return (
    <>
      {!open && (
        <Button
          type="primary"
          size="large"
          shape="round"
          icon={<RobotOutlined />}
          className="ai-assistant-launcher no-print"
          onClick={() => setOpen(true)}
        >
          Trợ lý AI
        </Button>
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
