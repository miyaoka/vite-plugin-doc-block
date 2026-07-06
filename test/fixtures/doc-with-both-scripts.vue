<doc lang="md">
Component with both `<script>` and `<script setup>`.
</doc>

<script lang="ts">
import { computed } from 'vue'

export default { name: 'BothScripts' }
</script>

<script setup lang="ts">
import { computed } from 'vue'

const x = computed(() => 1)
</script>

<template>
  <div>{{ x }}</div>
</template>
