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
  let dragEnterCount = 0;

  function onDragOver(e) {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";
  }

  function onDragEnter(e) {
    e.preventDefault();
    dragEnterCount++;
    isDragOver.value = true;
  }

  function onDragLeave(e) {
    dragEnterCount--;
    if (dragEnterCount <= 0) {
      dragEnterCount = 0;
      isDragOver.value = false;
    }
  }

  /**
   * Handle drop event and return the first dropped file's path.
   * Caller should check that the path is valid for their use case.
   */
  function onDrop(e) {
    e.preventDefault();
    dragEnterCount = 0;
    isDragOver.value = false;
    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return null;
    return files[0].path;
  }

  return { isDragOver, onDragOver, onDragEnter, onDragLeave, onDrop };
}
