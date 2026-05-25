<script setup lang="ts">
import { ref, onMounted, computed } from "vue";

type View = "auth" | "app";
type AppTab = "list" | "graph";
type EventRow = {
  id: number;
  title: string;
  description: string | null;
  root_event_id: number | null;
};

const NODE_W = 120;
const NODE_H = 36;
const H_GAP = 40;
const V_GAP = 60;

const view = ref<View>("auth");
const appTab = ref<AppTab>("list");
const username = ref("");
const password = ref("");
const error = ref("");

const events = ref<EventRow[]>([]);
const newTitle = ref("");
const newDescription = ref("");
const newRootEventId = ref<number | null>(null);

async function loadEvents() {
  const res = await fetch("/api/events");
  events.value = (await res.json()) as EventRow[];
}

async function createEvent() {
  if (!newTitle.value.trim()) return;
  await fetch("/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: newTitle.value,
      description: newDescription.value || null,
      root_event_id: newRootEventId.value,
    }),
  });
  newTitle.value = "";
  newDescription.value = "";
  newRootEventId.value = null;
  await loadEvents();
}

async function deleteEvent(id: number) {
  await fetch(`/api/events/${id}`, { method: "DELETE" });
  await loadEvents();
}

function rootTitle(event: EventRow): string | null {
  if (event.root_event_id === null) return null;
  return events.value.find((e) => e.id === event.root_event_id)?.title ?? null;
}

const rootSelectId = computed(() => newRootEventId.value ?? "");

type GraphNode = { id: number; title: string; x: number; y: number };
type GraphEdge = { x1: number; y1: number; x2: number; y2: number };

const graph = computed(() => {
  const evs = events.value;
  if (evs.length === 0) return { nodes: [], edges: [], width: 0, height: 0 };

  const childrenOf = new Map<number | null, number[]>();
  for (const e of evs) {
    const key = e.root_event_id;
    if (!childrenOf.has(key)) childrenOf.set(key, []);
    childrenOf.get(key)!.push(e.id);
  }

  const byId = new Map(evs.map((e) => [e.id, e]));
  const nodes: GraphNode[] = [];

  // Assign positions layer by layer using BFS from roots
  const roots = childrenOf.get(null) ?? [];
  let colCursor = 0;

  function place(id: number, depth: number, colStart: number): number {
    const children = childrenOf.get(id) ?? [];
    if (children.length === 0) {
      nodes.push({
        id,
        title: byId.get(id)!.title,
        x: colStart * (NODE_W + H_GAP),
        y: depth * (NODE_H + V_GAP),
      });
      return colStart + 1;
    }
    let col = colStart;
    const childCols: number[] = [];
    for (const cid of children) {
      childCols.push(col);
      col = place(cid, depth + 1, col);
    }
    const firstChild = childCols[0]!;
    const lastChild = childCols[childCols.length - 1]!;
    const cx = ((firstChild + lastChild) / 2) * (NODE_W + H_GAP);
    nodes.push({ id, title: byId.get(id)!.title, x: cx, y: depth * (NODE_H + V_GAP) });
    return col;
  }

  for (const rid of roots) {
    colCursor = place(rid, 0, colCursor);
  }

  const edges: GraphEdge[] = [];
  for (const e of evs) {
    if (e.root_event_id === null) continue;
    const parent = nodes.find((n) => n.id === e.root_event_id);
    const child = nodes.find((n) => n.id === e.id);
    if (parent && child) {
      edges.push({
        x1: parent.x + NODE_W / 2,
        y1: parent.y + NODE_H,
        x2: child.x + NODE_W / 2,
        y2: child.y,
      });
    }
  }

  const maxX = Math.max(...nodes.map((n) => n.x)) + NODE_W + 1;
  const maxY = Math.max(...nodes.map((n) => n.y)) + NODE_H + 1;

  return { nodes, edges, width: maxX, height: maxY };
});

onMounted(() => {
  if (globalThis.location.pathname === "/app") {
    view.value = "app";
    void loadEvents();
  }
});

async function submit(action: "register" | "login") {
  error.value = "";
  const res = await fetch(`/api/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: username.value, password: password.value }),
    redirect: "manual",
  });
  if (res.type === "opaqueredirect" || res.status === 0 || res.status === 302) {
    globalThis.location.href = "/app";
  } else {
    const data = (await res.json()) as { error: string };
    error.value = data.error;
  }
}
</script>

<template>
  <main v-if="view === 'auth'">
    <div class="card">
      <h1>Untaingled</h1>
      <div class="field">
        <label for="username">Username</label>
        <input id="username" v-model="username" type="text" autocomplete="username" />
      </div>
      <div class="field">
        <label for="password">Password</label>
        <input id="password" v-model="password" type="password" autocomplete="current-password" />
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <div class="actions">
        <button class="btn-secondary" @click="submit('register')">Register</button>
        <button class="btn-primary" @click="submit('login')">Log in</button>
      </div>
    </div>
  </main>
  <main v-else class="app-view">
    <div class="card">
      <h1>Events</h1>

      <form class="event-form" @submit.prevent="createEvent">
        <div class="field">
          <label for="new-title">Title</label>
          <input id="new-title" v-model="newTitle" type="text" required />
        </div>
        <div class="field">
          <label for="new-description">Description</label>
          <textarea id="new-description" v-model="newDescription" rows="2" />
        </div>
        <div class="field">
          <label
            for="new-root"
            title="The new event started while the other one was ongoing, like getting married while you were at university"
            >Took place while</label
          >
          <select
            id="new-root"
            :value="rootSelectId"
            @change="
              newRootEventId = ($event.target as HTMLSelectElement).value
                ? Number(($event.target as HTMLSelectElement).value)
                : null
            "
          >
            <option value="">None</option>
            <option v-for="e in events" :key="e.id" :value="e.id">{{ e.title }}</option>
          </select>
        </div>
        <div class="actions">
          <button type="submit" class="btn-primary">Add event</button>
        </div>
      </form>

      <div class="tab-bar">
        <button
          :class="appTab === 'list' ? 'btn-primary' : 'btn-secondary'"
          @click="appTab = 'list'"
        >
          List
        </button>
        <button
          :class="appTab === 'graph' ? 'btn-primary' : 'btn-secondary'"
          @click="appTab = 'graph'"
        >
          Graph
        </button>
      </div>

      <ul v-if="appTab === 'list'" class="event-list">
        <li v-for="event in events" :key="event.id">
          <div class="event-header">
            <strong>{{ event.title }}</strong>
            <button class="btn-secondary" @click="deleteEvent(event.id)">Delete</button>
          </div>
          <p v-if="event.description" class="event-description">{{ event.description }}</p>
          <p v-if="rootTitle(event)" class="event-root">Took place while: {{ rootTitle(event) }}</p>
        </li>
      </ul>

      <section v-else class="graph-view" aria-label="Event graph">
        <p v-if="events.length === 0" class="graph-empty">No events yet.</p>
        <svg
          v-else
          :viewBox="`0 0 ${graph.width} ${graph.height}`"
          :width="graph.width"
          :height="graph.height"
          class="graph-svg"
        >
          <line
            v-for="(edge, i) in graph.edges"
            :key="i"
            :x1="edge.x1"
            :y1="edge.y1"
            :x2="edge.x2"
            :y2="edge.y2"
            class="graph-edge"
          />
          <g
            v-for="node in graph.nodes"
            :key="node.id"
            :transform="`translate(${node.x},${node.y})`"
          >
            <rect :width="NODE_W" :height="NODE_H" rx="4" class="graph-node" />
            <text
              :x="NODE_W / 2"
              :y="NODE_H / 2"
              dominant-baseline="middle"
              text-anchor="middle"
              class="graph-label"
            >
              {{ node.title }}
            </text>
          </g>
        </svg>
      </section>
    </div>
  </main>
</template>

<style>
*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family:
    system-ui,
    -apple-system,
    sans-serif;
  font-size: 16px;
  line-height: 1.5;
  background: #f5f5f5;
  color: #1a1a1a;
}
</style>

<style scoped>
main {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1.5rem;
}

.card {
  background: #fff;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  padding: 2rem;
  width: 100%;
  max-width: 360px;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

h1 {
  margin: 0 0 0.5rem;
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

label {
  font-size: 0.875rem;
  font-weight: 500;
  color: #444;
}

input {
  padding: 0.5rem 0.625rem;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  font-size: 1rem;
  font-family: inherit;
  background: #fff;
  color: #1a1a1a;
  transition: border-color 0.15s;
}

input:focus {
  outline: none;
  border-color: #555;
}

.error {
  margin: 0;
  font-size: 0.875rem;
  color: #c0392b;
}

.actions {
  display: flex;
  gap: 0.5rem;
  justify-content: flex-end;
  margin-top: 0.25rem;
}

button {
  padding: 0.5rem 1rem;
  border-radius: 4px;
  font-size: 0.9375rem;
  font-family: inherit;
  font-weight: 500;
  cursor: pointer;
  transition:
    background 0.15s,
    border-color 0.15s;
}

.btn-primary {
  background: #1a1a1a;
  color: #fff;
  border: 1px solid #1a1a1a;
}

.btn-primary:hover {
  background: #333;
  border-color: #333;
}

.btn-secondary {
  background: #fff;
  color: #1a1a1a;
  border: 1px solid #d0d0d0;
}

.btn-secondary:hover {
  background: #f5f5f5;
}

.app-view {
  align-items: flex-start;
  padding-top: 2rem;
}

.app-view .card {
  max-width: 600px;
  width: 100%;
}

.event-form {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

textarea {
  padding: 0.5rem 0.625rem;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  font-size: 1rem;
  font-family: inherit;
  resize: vertical;
}

select {
  padding: 0.5rem 0.625rem;
  border: 1px solid #d0d0d0;
  border-radius: 4px;
  font-size: 1rem;
  font-family: inherit;
  background: #fff;
}

.event-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.event-list li {
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  padding: 0.75rem 1rem;
}

.event-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.event-description {
  margin: 0.375rem 0 0;
  font-size: 0.9rem;
  color: #555;
}

.event-root {
  margin: 0.25rem 0 0;
  font-size: 0.8125rem;
  color: #888;
}

.tab-bar {
  display: flex;
  gap: 0.5rem;
}

.graph-view {
  overflow-x: auto;
  padding: 0.5rem 0;
}

.graph-empty {
  color: #888;
  font-size: 0.9rem;
  margin: 0;
}

.graph-svg {
  display: block;
}

.graph-edge {
  stroke: #aaa;
  stroke-width: 1.5;
}

.graph-node {
  fill: #f5f5f5;
  stroke: #d0d0d0;
  stroke-width: 1;
}

.graph-label {
  font-size: 12px;
  font-family: inherit;
  fill: #1a1a1a;
}
</style>
