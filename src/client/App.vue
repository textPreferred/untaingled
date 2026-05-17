<script setup lang="ts">
import { ref, onMounted } from "vue";

interface HistoryEvent {
  id: number;
  title: string;
}

const events = ref<HistoryEvent[]>([]);
const title = ref("");

async function loadEvents() {
  const res = await fetch("/api/events");
  events.value = await res.json();
}

async function addEvent() {
  if (!title.value.trim()) return;
  await fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: title.value }),
  });
  title.value = "";
  await loadEvents();
}

onMounted(loadEvents);
</script>

<template>
  <main>
    <label for="event-title">Event title</label>
    <input id="event-title" v-model="title" type="text" />
    <button @click="addEvent">Add event</button>
    <ul>
      <li v-for="event in events" :key="event.id">{{ event.title }}</li>
    </ul>
  </main>
</template>
