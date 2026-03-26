<template>
  <!-- 改用 wheel 监听滚轮，删除错误的 scroll 事件 -->
  <div class="container" ref="containerRef" @wheel="onPageWheel">
    <div class="section page1">第一屏 🎬</div>
    <div class="section page2" ref="page2Ref">
      <span>第二屏 ✨</span>
      <div
        ref="horizontalScrollRef"
        class="horizontal-scroll-area"
        @mouseenter="isHover = true"
        @mouseleave="isHover = false"
        @wheel="onHorizontalWheel"
      >
        <div class="scroll-item">横向第一个方块</div>
        <div class="scroll-item">横向第二个方块</div>
        <div class="scroll-item">横向第三个方块</div>
        <div class="scroll-item">横向第四个方块</div>
        <div class="scroll-item">横向第五个方块</div>
        <div class="scroll-item">横向第六个方块</div>
        <div class="scroll-item">横向第七个方块</div>
      </div>
    </div>
    <div class="section page3">第三屏 🚀</div>
    
  </div>
</template>

<script setup>
import { ref } from 'vue'

const horizontalScrollRef = ref(null)
const containerRef = ref(null)
const page2Ref = ref(null)
const isHover = ref(false)
// 滚动锁：防止多次触发跳转
const isScrolling = ref(false)

// ============== 1. 横向滚动逻辑（原逻辑保留，优化顺滑度） ==============
const onHorizontalWheel = (e) => {
  const el = horizontalScrollRef.value
  if (!isHover.value || !el) return

  const isLeftEdge = el.scrollLeft <= 2
  const isRightEdge = el.scrollLeft + el.clientWidth >= el.scrollWidth - 2
  const scrollUp = e.deltaY < 0
  const scrollDown = e.deltaY > 0

  if ((isLeftEdge && scrollUp) || (isRightEdge && scrollDown)) return

  e.preventDefault()
  el.scrollLeft += e.deltaY * 3 // 调整滚动速度
}

// ============== 2. 核心：页面上下屏跳转逻辑（修复你的BUG） ==============
const onPageWheel = (e) => {
  // 鼠标在横向区域 → 不执行页面跳转
  if (isHover.value) return
  // 正在滚动中 → 禁止重复触发
  if (isScrolling.value) return

  const container = containerRef.value
  const scrollTop = container.scrollTop // 当前滚动距离
  const page2Top = page2Ref.value.offsetTop // 第二屏顶部位置
  const wheelDown = e.deltaY > 0 // 滚轮向下
  const wheelUp = e.deltaY < 0 // 滚轮向上

  // —— 规则1：在第一屏，向下滚 → 跳第二屏
  if (scrollTop < 100 && wheelDown) {
    e.preventDefault()
    isScrolling.value = true
    container.scrollTo({ top: page2Top, behavior: 'smooth' })
    // 滚动结束解锁
    setTimeout(() => isScrolling.value = false, 500)
  }

  // —— 规则2：在第二屏，向上滚 → 跳第一屏
  if (scrollTop >= page2Top - 100 && wheelUp) {
    e.preventDefault()
    isScrolling.value = true
    container.scrollTo({ top: 0, behavior: 'smooth' })
    setTimeout(() => isScrolling.value = false, 500)
  }
}
</script>

<style scoped lang="scss">
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}
.container {
  height: 100vh;
  overflow: auto;
  background: rgb(242, 214, 219);
}
.section {
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  font-size: 48px;
  color: #fff;
  gap: 20px;
}
.page1 { background: #1a1a1a; }
.page2 { background: #42b983; }
.page3 { background: #2c3e50; }

.horizontal-scroll-area {
  width: 100%;
  height: 800px;
  border: 2px solid #fff;
  display: flex;
  overflow-x: auto;
  overflow-y: hidden;
}
.scroll-item {
  flex: 0 0 500px;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  color: #fff;
  background: pink;
  margin: 0 10px;
}

.horizontal-scroll-area::-webkit-scrollbar {
  display: none;
}
</style>