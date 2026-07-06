<doc lang="md">
# HtmlPreview

- `<script>` is never executed (only static HTML + CSS is rendered)
</doc>

<script setup lang="ts">
import { ref } from 'vue'
import Child from './Child.vue'

const html = ref('<p>preview</p>')
</script>

<template>
  <Child />
  <div v-html="html" />
</template>
