<template>
  <div class="aigc-chat">
    <div class="chat-header">
      <span>AI 助手</span>
      <span class="close-btn" @click="$emit('close')">×</span>
    </div>
    
    <div class="chat-body" ref="chatBodyRef">
      <div 
        v-for="(msg, index) in messages" 
        :key="index"
        :class="['message', `message-${msg.role}`]"
      >
        <div class="avatar">{{ msg.role === 'user' ? '我' : 'AI' }}</div>
        <div class="content">
          <!-- 简单展示文本，如果需要支持 Markdown 可以引入第三方库 -->
          <span v-if="msg.content">{{ msg.content }}</span>
          <span v-else-if="msg.role === 'ai' && isGenerating && index === messages.length - 1" class="loading-dots">
            输入中...
          </span>
        </div>
      </div>
    </div>

    <div class="chat-footer">
      <el-input
        v-model="inputMessage"
        placeholder="请输入您的问题..."
        @keyup.enter="sendMessage"
        :disabled="isGenerating"
      >
        <template #append>
          <el-button @click="sendMessage" :disabled="!inputMessage.trim() || isGenerating">
            发送
          </el-button>
        </template>
      </el-input>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, nextTick } from 'vue'

defineEmits(['close'])

interface Message {
  role: 'user' | 'ai'
  content: string
}

const messages = ref<Message[]>([
  { role: 'ai', content: '你好！我是 AI 助手，有什么可以帮你的吗？' }
])
const inputMessage = ref('')
const isGenerating = ref(false)
const chatBodyRef = ref<HTMLElement | null>(null)

// 滚动到底部
const scrollToBottom = async () => {
  await nextTick()
  if (chatBodyRef.value) {
    chatBodyRef.value.scrollTop = chatBodyRef.value.scrollHeight
  }
}

const sendMessage = async () => {
  const text = inputMessage.value.trim()
  if (!text || isGenerating.value) return

  // 添加用户消息
  messages.value.push({ role: 'user', content: text })
  inputMessage.value = ''
  
  // 🔥 修复：创建本次对话的 AI 占位消息，直接保存引用（不使用find）
  const currentAiMessage = { role: 'ai', content: '' }
  messages.value.push(currentAiMessage)
  
  isGenerating.value = true
  scrollToBottom()

  try {
    const response = await fetch(`http://localhost:8080/api/chat?message=${encodeURIComponent(text)}`, {
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream'
      }
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const reader = response.body?.getReader()
    const decoder = new TextDecoder('utf-8')

    if (!reader) throw new Error('Failed to get reader from response')

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split('\n')
      
      for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.substring(6);
            if (dataStr) {
              try {
                const data = JSON.parse(dataStr);

                if (data.error) {
                  // 直接使用当前AI消息，不查找
                  currentAiMessage.content = data.error;
                  isGenerating.value = false;
                  return;
                } else if (data.done) {
                  isGenerating.value = false;
                  scrollToBottom();
                  return;
                } else if (data.text) {
                  // 🔥 直接拼接在本次的AI消息上
                  currentAiMessage.content += data.text;
                  requestAnimationFrame(() => scrollToBottom());
                }
              } catch (error) {
                console.error("Error parsing SSE data:", error);
              }
            }
          }
      }
    }
  } catch (error) {
    console.error('Chat error:', error)
    currentAiMessage.content = '抱歉，服务出现异常，请稍后再试。'
  } finally {
    isGenerating.value = false
    scrollToBottom()
  }
}
</script>

<style scoped>
.aigc-chat {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background: #fff;
}

.chat-header {
  padding: 12px 16px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: bold;
  background: #f8f9fa;
}

.close-btn {
  cursor: pointer;
  font-size: 20px;
  color: #999;
  line-height: 1;
  padding: 0 4px;
}

.close-btn:hover {
  color: #333;
}

.chat-body {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: #f5f7fa;
}

.message {
  display: flex;
  gap: 10px;
  max-width: 85%;
}

.message-user {
  align-self: flex-end;
  flex-direction: row-reverse;
}

.message-ai {
  align-self: flex-start;
}

.avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: #409eff;
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
}

.message-user .avatar {
  background: #67c23a;
}

.content {
  padding: 10px 14px;
  border-radius: 8px;
  background: white;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
  word-break: break-word;
  line-height: 1.5;
  font-size: 14px;
}

.message-user .content {
  background: #e1f3d8;
}

.chat-footer {
  padding: 12px;
  border-top: 1px solid #eee;
  background: #fff;
}

.loading-dots {
  color: #909399;
  font-style: italic;
  animation: blink 1.4s infinite both;
}

@keyframes blink {
  0% { opacity: 0.2; }
  20% { opacity: 1; }
  100% { opacity: 0.2; }
}
</style>