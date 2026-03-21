<template>
  <div class="command-palette" :class="{ open }" :aria-hidden="!open">
    <button class="palette-backdrop" type="button" aria-label="关闭命令面板" @click="$emit('close')"></button>

    <section class="palette-panel glass-panel" aria-label="命令面板">
      <div class="palette-head">
        <div>
          <p class="kicker">COMMAND CORE</p>
          <h3>快速打开、控制和管理</h3>
        </div>
        <span class="palette-tip">Ctrl / Cmd + K</span>
      </div>

      <label class="palette-search" for="paletteInput">
        <input
          id="paletteInput"
          :value="query"
          type="search"
          autocomplete="off"
          placeholder="输入命令、站点名、分类或标签..."
          @input="$emit('update:query', $event.target.value)"
        />
      </label>

      <div class="palette-meta">{{ meta }}</div>
      <div class="palette-results" role="listbox" aria-label="命令结果">
        <button
          v-for="(entry, index) in entries"
          :key="entry.id"
          class="palette-item"
          :class="{ active: index === activeIndex }"
          type="button"
          @click="$emit('execute', index)"
        >
          <span class="palette-badge">{{ entry.type === "command" ? "CMD" : entry.glyph || "LK" }}</span>
          <div class="palette-copy">
            <strong>{{ entry.label }}</strong>
            <small>{{ entry.hint }}</small>
          </div>
          <span class="palette-kind">{{ entry.type === "command" ? "动作" : "入口" }}</span>
        </button>

        <article v-if="!entries.length" class="palette-empty">
          <p>没有找到匹配结果，换个关键词试试。</p>
        </article>
      </div>
    </section>
  </div>
</template>

<script setup>
defineProps({
  open: {
    type: Boolean,
    required: true,
  },
  query: {
    type: String,
    required: true,
  },
  meta: {
    type: String,
    required: true,
  },
  entries: {
    type: Array,
    required: true,
  },
  activeIndex: {
    type: Number,
    required: true,
  },
});

defineEmits(["close", "execute", "update:query"]);
</script>
