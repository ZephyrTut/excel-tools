import { ref } from "vue";

/**
 * Composable for drag-and-drop file/folder zones.
 * Returns reactive state and event handlers for dragover/dragenter/dragleave/drop.
 *
 * Usage:
 *   import { reactive } from "vue";
 *   import { useDropZone } from "../composables/useDropZone";
 *   const zone = reactive(useDropZone());
 *
 * Template:
 *   <div class="drop-zone" :class="{ 'drop-zone--active': zone.isDragOver }"
 *        @dragover.prevent="zone.onDragOver"
 *        @dragenter="zone.onDragEnter"
 *        @dragleave="zone.onDragLeave"
 *        @drop="onDrop">
 */
export function useDropZone() {
  const isDragOver = ref(false);
  let leaveTimer = null;

  function onDragOver(e) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
    isDragOver.value = true;
    // 每次 dragover 都刷新，取消待执行的熄灭定时器
    if (leaveTimer) {
      clearTimeout(leaveTimer);
      leaveTimer = null;
    }
  }

  function onDragEnter(e) {
    e.preventDefault();
    isDragOver.value = true;
  }

  function onDragLeave(e) {
    // 用 contains 检查：如果在子元素间移动，不熄灭
    if (e.currentTarget && e.currentTarget.contains(e.relatedTarget)) return;
    // 延迟熄灭，给 dragover 一个机会刷新状态
    // 防止 Electron 拖 OS 文件时 relatedTarget 为 null 导致的误熄灭
    if (leaveTimer) clearTimeout(leaveTimer);
    leaveTimer = setTimeout(() => {
      isDragOver.value = false;
      leaveTimer = null;
    }, 80);
  }

  /**
   * Handle drop event and return the first dropped file's path.
   * Caller should check that the path is valid for their use case.
   */
  function onDrop(e) {
    e.preventDefault();
    if (leaveTimer) clearTimeout(leaveTimer);
    leaveTimer = null;
    isDragOver.value = false;
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return null;
    return files[0].path;
  }

  return { isDragOver, onDragOver, onDragEnter, onDragLeave, onDrop };
}
