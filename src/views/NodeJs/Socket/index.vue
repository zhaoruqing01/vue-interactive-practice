<template>
  <div class="chat-container">
    <h1>全体公共聊天室</h1>

    <div class="message-list" ref="messageListRef">
      <div
        v-for="(msg, index) in messages"
        :key="index"
        :class="['message-item', msg.isSelf ? 'self' : 'other']"
      >
        <div class="message-content">
          <span class="sender" v-if="!msg.isSelf">{{ msg.sender }}</span>
          <p
            class="text"
            :class="{ streaming: msg.isStreaming }"
            v-html="msg.user_id === -1 ? marked.parse(msg.text) : msg.text"
          ></p>
        </div>
      </div>
    </div>

    <div v-if="showRobotList" class="robot-list-popup">
      <div
        v-for="robot in robotList"
        :key="robot.id"
        class="robot-item"
        @click="selectRobot(robot)"
      >
        {{ robot.name }}
      </div>
    </div>

    <div class="input-area">
      <div class="input-wrapper">
        <QuillEditor
          ref="quillRef"
          :options="editorOptions"
          @textChange="handleTextChange"
          class="my-quill-editor"
        />
      </div>
      <button @click="sendMessage">发送</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { getGroupMsgAPI } from "@/api/group";
import { useUserStore } from "@/store/user";
import { QuillEditor } from "@vueup/vue-quill";
import "@vueup/vue-quill/dist/vue-quill.snow.css";
import hljs from "highlight.js";
import "highlight.js/styles/atom-one-dark.css";
import { marked } from "marked";
import { io } from "socket.io-client";
import { nextTick, onMounted, onUnmounted, reactive, ref } from "vue";

// 配置 marked 解析 + 代码高亮 (适配 v18)
const renderer = new marked.Renderer();
renderer.code = ({ text, lang }) => {
  const validLanguage = lang && hljs.getLanguage(lang) ? lang : "plaintext";
  const highlighted = hljs.highlight(text, { language: validLanguage }).value;
  return `<pre><code class="hljs ${validLanguage}">${highlighted}</code></pre>`;
};

marked.setOptions({
  renderer,
  gfm: true, // 支持表格、删除线等
});
const userStore = useUserStore();
const socket = io(import.meta.env.VITE_BASE_URL, {
  transports: ["websocket"],
});

interface Message {
  sender: string;
  text: string;
  time: string;
  isSelf: boolean;
  isStreaming: boolean;
  user_id: number;
}

const messages = ref<Message[]>([
  {
    sender: "系统",
    text: "欢迎进入公共聊天室！",
    time: new Date().toLocaleTimeString(),
    isSelf: false,
    isStreaming: false,
    user_id: -1,
  },
]);

const messageListRef = ref<HTMLElement | null>(null);

// ==============================
// Quill 编辑器相关配置
// ==============================
const quillRef = ref<any>(null);
const editorOptions = {
  theme: "snow",
  modules: {
    toolbar: false, // 隐藏顶部的工具栏
    keyboard: {
      bindings: {
        // 拦截回车键发送消息，Shift+Enter 则换行
        enter: {
          key: 13,
          shiftKey: false,
          handler: () => {
            sendMessage();
            return false;
          },
        },
      },
    },
  },
  placeholder: "请输入消息",
};

// 机器人相关状态
const showRobotList = ref(false);
const robotList = [{ id: 1, name: "小艺" }];
const pendingAIPrompt = ref("");

// 监听 Quill 的输入变化
const handleTextChange = () => {
  if (!quillRef.value) return;
  const quill = quillRef.value.getQuill();
  const cursor = quill.getSelection()?.index;

  if (cursor) {
    const text = quill.getText();
    // 检查光标前一个字符是否是 @
    if (text.charAt(cursor - 1) === "@") {
      showRobotList.value = true;
    } else {
      // 如果全文都没有 @，则关闭弹窗
      if (!text.includes("@")) showRobotList.value = false;
    }
  }
};

const selectRobot = (robot: any) => {
  if (!quillRef.value) return;
  const quill = quillRef.value.getQuill();
  let cursorPosition = quill.getSelection()?.index;

  if (cursorPosition === undefined || cursorPosition === null) {
    cursorPosition = quill.getLength() - 1;
  }

  // 找到光标前最近的一个 @ 进行替换
  const textBeforeCursor = quill.getText(0, cursorPosition);
  const lastAtIndex = textBeforeCursor.lastIndexOf("@");

  const mentionText = `@${robot.name}`;

  if (lastAtIndex !== -1) {
    quill.deleteText(lastAtIndex, cursorPosition - lastAtIndex);

    // 1. 插入带颜色的艾特标签
    quill.insertText(lastAtIndex, mentionText, {
      color: "#67c23a",
      bold: true,
    });

    // 核心修复：2. 强制插入一个去除了所有格式的普通空格，截断颜色继承
    quill.insertText(lastAtIndex + mentionText.length, " ", {
      color: false, // false 表示清除该格式
      bold: false,
    });

    // 3. 将光标移到这个普通空格之后
    quill.setSelection(lastAtIndex + mentionText.length + 1);
  } else {
    // 兜底插入
    quill.insertText(cursorPosition, mentionText, {
      color: "#67c23a",
      bold: true,
    });
    quill.insertText(cursorPosition + mentionText.length, " ", {
      color: false,
      bold: false,
    });
    quill.setSelection(cursorPosition + mentionText.length + 1);
  }

  showRobotList.value = false;
  // 重新聚焦
  nextTick(() => {
    quill.focus();
  });
};

const receivePublicMsg = (msg: any) => {
  const isSelf = msg.userId === userStore.userInfo.userId;

  messages.value.push({
    sender: msg.username,
    text: msg.content,
    time: new Date(msg.sendTime).toLocaleTimeString(),
    isSelf,
    isStreaming: false,
    user_id: msg.user_id,
  });
  scrollToBottom();

  if (isSelf && pendingAIPrompt.value) {
    startRobotStream(pendingAIPrompt.value);
    pendingAIPrompt.value = "";
  }
};

onMounted(() => {
  socket.on("receivePublicMsg", receivePublicMsg);
  getPublicChatRecord().then(() => {
    scrollToBottom();
  });
});

onUnmounted(() => {
  socket.off("receivePublicMsg", receivePublicMsg);
});

const getPublicChatRecord = async () => {
  const res = await getGroupMsgAPI(0);
  if (res.code === 200) {
    messages.value = res.data.map((item: any) => {
      return {
        sender: item.username,
        text: item.content,
        time: new Date(item.send_time).toLocaleTimeString(),
        isSelf: item.user_id === userStore.userInfo.userId,
        isStreaming: false,
        user_id: item.user_id,
      };
    });
  }
};

const sendMessage = () => {
  if (!quillRef.value) return;
  const quill = quillRef.value.getQuill();

  // 获取纯文本（发送给后端的仍然是纯文本，很安全）
  const text = quill.getText().trim();
  if (!text) return;

  const msgData = {
    userId: userStore.userInfo.userId,
    username: userStore.userInfo.username || "匿名用户",
    content: text,
  };

  if (text.includes("@小艺")) {
    const cleanPrompt = text.replace(/@小艺\s*/g, "").trim();
    pendingAIPrompt.value = cleanPrompt;
  }

  socket.emit("sendPublicMsg", msgData);

  // 清空编辑器
  quill.setText("");
  showRobotList.value = false;
};

let currentSSE = ref<EventSource | null>(null);
const mdHtml = ref("");
const startRobotStream = (prompt: string) => {
  if (currentSSE.value) {
    currentSSE.value.close();
    currentSSE.value = null;
  }

  const aiMsg = reactive({
    sender: "小艺",
    text: "",
    time: new Date().toLocaleTimeString(),
    isSelf: false,
    isStreaming: true,
    user_id: -1,
  });
  messages.value.push(aiMsg);
  scrollToBottom();

  const sse = new EventSource(
    `${import.meta.env.VITE_BASE_URL}/ai/robotChat?prompt=${encodeURIComponent(
      prompt,
    )}`,
  );
  currentSSE.value = sse;

  sse.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);

      if (data.done) {
        aiMsg.isStreaming = false;
        sse.close();
        currentSSE.value = null;
        return;
      }

      aiMsg.text += data.content || "";

      scrollToBottom();
    } catch (e) {
      console.log("消息解析异常", e);
    }
  };

  sse.onerror = (err) => {
    console.log("SSE 错误", err);
    aiMsg.isStreaming = false;
    sse.close();
    currentSSE.value = null;
  };
};

const scrollToBottom = async () => {
  await nextTick();
  if (messageListRef.value) {
    messageListRef.value.scrollTop = messageListRef.value.scrollHeight;
  }
};
</script>

<style scoped>
.chat-container {
  display: flex;
  flex-direction: column;
  height: calc(100vh - 120px);
  width: calc(100vw - 250px);
  border: 1px solid #ccc;
  border-radius: 8px;
  overflow: hidden;
  font-family: Arial, sans-serif;
  background-color: #fff;
  margin: 0 auto;
}

h1 {
  text-align: center;
  padding: 10px;
  margin: 0;
  font-size: 18px;
  background-color: #f5f5f5;
  border-bottom: 1px solid #eee;
}

.message-list {
  flex: 1;
  padding: 15px;
  overflow-y: auto;
  background-color: #f7f7f7;
}

.message-item {
  margin-bottom: 15px;
  display: flex;
}

.message-item.self {
  justify-content: flex-end;
}

.message-item.other {
  justify-content: flex-start;
}

.message-content {
  max-width: 70%;
  padding: 8px 12px;
  border-radius: 8px;
  word-wrap: break-word;
  white-space: pre-wrap; /* 保证发送出去的文本能保留换行 */
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
}

.message-item.self .message-content {
  background-color: #b5f793;
  color: #000;
  border-top-right-radius: 2px;
  padding: 5px;
}

.message-item.other .message-content {
  background-color: #fff;
  border: 1px solid #ddd;
  color: #333;
  border-top-left-radius: 2px;
}

.sender {
  font-size: 11px;
  color: #888;
  display: block;
  margin-bottom: 3px;
}

.text {
  margin: 0;
  font-size: 14px;
  line-height: 1.5;
}

/* Markdown 表格样式 */
:deep(table) {
  border-collapse: collapse;
  width: 100%;
  margin: 10px 0;
  border: 1px solid #ddd;
}

:deep(th),
:deep(td) {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left;
}

:deep(th) {
  background-color: #f5f5f5;
}

/* Markdown 代码块样式 */
:deep(pre) {
  background-color: #282c34;
  padding: 10px;
  border-radius: 4px;
  overflow-x: auto;
  margin: 10px 0;
}

:deep(code.hljs) {
  padding: 0;
  background: transparent;
}

/* 输入区样式重构 */
.input-area {
  display: flex;
  padding: 12px;
  background-color: #fff;
  border-top: 1px solid #eee;
  position: relative;
  align-items: flex-end; /* 让按钮对齐底部 */
}

.input-wrapper {
  flex: 1;
  margin-right: 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  background-color: #fff;
  display: flex;
  flex-direction: column;
}

.input-area button {
  height: 40px; /* 固定按钮高度 */
  padding: 0 20px;
  border-radius: 4px;
  border: none;
  background-color: #409eff;
  color: white;
  cursor: pointer;
  transition: background-color 0.3s;
}

.input-area button:hover {
  background-color: #66b1ff;
}

/* ======================================
   Quill Editor 样式深度覆盖
   ====================================== */
.my-quill-editor {
  flex: 1;
  height: auto;
}

:deep(.ql-toolbar) {
  display: none; /* 完全隐藏顶部工具栏 */
}

:deep(.ql-container.ql-snow) {
  border: none; /* 移除 Quill 的默认边框，使用我们 wrapper 的边框 */
  font-size: 14px;
  font-family: inherit;
}

:deep(.ql-editor) {
  padding: 10px;
  min-height: 40px; /* 最小高度 */
  max-height: 120px; /* 最大高度，超出会自动出滚动条 */
  overflow-y: auto;
}

:deep(.ql-editor.ql-blank::before) {
  left: 10px;
  font-style: normal;
  color: #999; /* 优化 placeholder 颜色 */
}

/* 机器人列表弹窗 */
.robot-list-popup {
  position: absolute;
  bottom: 70px;
  left: 12px;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  z-index: 100;
  width: 160px;
  overflow: hidden;
  animation: fadeIn 0.2s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.robot-item {
  padding: 10px 15px;
  cursor: pointer;
  font-size: 14px;
  color: #333;
  transition: background-color 0.2s;
  display: flex;
  align-items: center;
}

.robot-item:hover {
  background-color: #f0f9eb;
  color: #67c23a;
}

/* 移动端适配 */
@media (max-width: 768px) {
  .chat-container {
    height: 100%;
    width: 100%;
    border: none;
    border-radius: 0;
  }

  h1 {
    display: none;
  }

  .message-list {
    padding: 10px;
  }

  .message-content {
    max-width: 85%;
  }

  .input-area {
    padding: 8px;
  }
}
/* 加到你的 style 里 */
.message-item .text.streaming::after {
  content: "|";
  animation: blink 1s infinite step-end;
  margin-left: 2px;
}
@keyframes blink {
  50% {
    opacity: 0;
  }
}
/* ========== 最终版：列表 防溢出 + 极致紧凑 + 无间距问题 ========== */
:deep(ul),
:deep(ol) {
  /* 彻底清空列表上下间距 */
  margin: 2px 0 !important;
  /* 合适缩进，不溢出 */
  padding-left: 18px !important;
}

/* 有序列表单独样式 */
:deep(ol) {
  list-style-type: decimal;
}

/* 列表项：极致收紧间距 */
:deep(li) {
  /* 清空行间距 */
  margin: 1px 0 !important;
  padding: 0 !important;
  line-height: 1.4 !important;
  word-break: break-word;
  overflow-wrap: anywhere;
}

/* ✅ 核心修复：marked 自动套的 p 标签，清空它的默认间距！ */
:deep(li p) {
  margin: 0 !important;
  padding: 0 !important;
  line-height: inherit !important;
}

/* 嵌套子列表间距收紧 */
:deep(li ul),
:deep(li ol) {
  margin: 1px 0 !important;
  padding-left: 15px !important;
}

/* 兜底不溢出 */
:deep(.text *) {
  box-sizing: border-box;
  max-width: 100%;
  overflow-x: hidden;
}
</style>
