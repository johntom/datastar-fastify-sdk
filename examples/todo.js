/**
 * Todo App Example with Datastar + Fastify
 * 
 * A more complete example showing:
 * - CRUD operations with signals
 * - Element morphing
 * - Real-time updates
 * - Form handling
 * 
 * Run with: node examples/todo.js
 */

'use strict';

const Fastify = require('fastify');
const { datastar, PostSSE, DeleteSSE, PatchMode, escapeHtml } = require('../lib/index');

const app = Fastify({ logger: true });
app.register(datastar);

// In-memory store
const todos = new Map();

// Seed some initial data
todos.set('1', { id: '1', text: 'Learn Datastar', completed: true, createdAt: new Date() });
todos.set('2', { id: '2', text: 'Build something awesome', completed: false, createdAt: new Date() });
todos.set('3', { id: '3', text: 'Share with the world', completed: false, createdAt: new Date() });

// Generate unique ID
function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

// Render a single todo item
function renderTodoItem(todo) {
  return `
    <li id="todo-${todo.id}" class="todo-item ${todo.completed ? 'completed' : ''}">
      <input 
        type="checkbox" 
        ${todo.completed ? 'checked' : ''}
        data-on:change="${PostSSE(`/api/todos/${todo.id}/toggle`)}"
      />
      <span class="todo-text">${escapeHtml(todo.text)}</span>
      <button 
        class="delete-btn"
        data-on:click="${DeleteSSE(`/api/todos/${todo.id}`)}"
      >×</button>
    </li>
  `;
}

// Render the todo list
function renderTodoList(filter = 'all') {
  let filtered = Array.from(todos.values());

  if (filter === 'active') {
    filtered = filtered.filter(t => !t.completed);
  } else if (filter === 'completed') {
    filtered = filtered.filter(t => t.completed);
  }

  if (filtered.length === 0) {
    return '<li id="empty-state" class="empty">No todos yet!</li>';
  }

  return filtered.map(renderTodoItem).join('');
}

// Render the footer with counts and filters
function renderFooter(activeFilter) {
  const total = todos.size;
  const active = Array.from(todos.values()).filter(t => !t.completed).length;
  const completed = total - active;

  return `
    <footer id="todo-footer" class="footer">
      <span class="count">${active} item${active !== 1 ? 's' : ''} left</span>
      <div class="filters">
        <button 
          class="${activeFilter === 'all' ? 'active' : ''}"
          data-on:click="${PostSSE('/api/todos/filter/all')}"
        >All</button>
        <button 
          class="${activeFilter === 'active' ? 'active' : ''}"
          data-on:click="${PostSSE('/api/todos/filter/active')}"
        >Active</button>
        <button 
          class="${activeFilter === 'completed' ? 'active' : ''}"
          data-on:click="${PostSSE('/api/todos/filter/completed')}"
        >Completed</button>
      </div>
      ${completed > 0 ? `
        <button 
          class="clear-completed"
          data-on:click="${PostSSE('/api/todos/clear-completed')}"
        >Clear completed (${completed})</button>
      ` : ''}
    </footer>
  `;
}

// Serve the HTML page
app.get('/', async (request, reply) => {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Datastar Todo App</title>
  <script type="module" src="https://cdn.jsdelivr.net/gh/starfederation/datastar@v1.0.0-RC.6/bundles/datastar.js"></script>
  <style>
    * { box-sizing: border-box; }
    body { 
      font-family: system-ui, sans-serif; 
      max-width: 500px; 
      margin: 2rem auto; 
      padding: 0 1rem;
      background: #f5f5f5;
    }
    h1 { 
      text-align: center; 
      color: #b83f45;
      font-size: 3rem;
      font-weight: 100;
      margin-bottom: 2rem;
    }
    .todo-app {
      background: white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      border-radius: 4px;
    }
    .new-todo-form {
      display: flex;
      padding: 1rem;
      border-bottom: 1px solid #eee;
    }
    .new-todo-input {
      flex: 1;
      padding: 0.75rem;
      font-size: 1rem;
      border: 1px solid #ddd;
      border-radius: 4px 0 0 4px;
    }
    .new-todo-btn {
      padding: 0.75rem 1.5rem;
      background: #4caf50;
      color: white;
      border: none;
      border-radius: 0 4px 4px 0;
      cursor: pointer;
      font-size: 1rem;
    }
    .new-todo-btn:hover { background: #45a049; }
    .new-todo-btn:disabled { background: #ccc; cursor: not-allowed; }
    .todo-list {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .todo-item {
      display: flex;
      align-items: center;
      padding: 0.75rem 1rem;
      border-bottom: 1px solid #eee;
    }
    .todo-item:last-child { border-bottom: none; }
    .todo-item input[type="checkbox"] {
      width: 20px;
      height: 20px;
      margin-right: 0.75rem;
      cursor: pointer;
    }
    .todo-item.completed .todo-text {
      text-decoration: line-through;
      color: #999;
    }
    .todo-text { flex: 1; }
    .delete-btn {
      background: none;
      border: none;
      color: #cc9a9a;
      font-size: 1.5rem;
      cursor: pointer;
      padding: 0 0.5rem;
    }
    .delete-btn:hover { color: #af5b5e; }
    .empty {
      padding: 2rem;
      text-align: center;
      color: #999;
      font-style: italic;
    }
    .footer {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      padding: 0.75rem 1rem;
      border-top: 1px solid #eee;
      font-size: 0.875rem;
      color: #777;
    }
    .filters { display: flex; gap: 0.25rem; }
    .filters button {
      padding: 0.25rem 0.5rem;
      background: none;
      border: 1px solid transparent;
      border-radius: 3px;
      cursor: pointer;
    }
    .filters button:hover { border-color: #ddd; }
    .filters button.active { border-color: #b83f45; }
    .clear-completed {
      margin-left: auto;
      background: none;
      border: none;
      color: #777;
      cursor: pointer;
    }
    .clear-completed:hover { text-decoration: underline; }
    .count { min-width: 100px; }
    .error-msg {
      color: #c00;
      font-size: 0.875rem;
      padding: 0.5rem 1rem;
      display: none;
    }
    .error-msg.show { display: block; }
  </style>
</head>
<body>
  <h1>todos</h1>
  
  <div class="todo-app" data-signals='{"newTodoText": "", "filter": "all", "error": ""}'>
    
    <!-- New Todo Form -->
    <div class="new-todo-form">
      <input 
        type="text" 
        id="new-todo-input"
        class="new-todo-input"
        placeholder="What needs to be done?"
        data-bind="newTodoText"
      />
      <button 
        class="new-todo-btn"
        data-on:click="${PostSSE('/api/todos')}"
      >Add</button>
    </div>
    <div id="error-msg" class="error-msg" data-class-show="\$error" data-text="\$error"></div>

    <!-- Todo List -->
    <ul id="todo-list" class="todo-list">
      ${renderTodoList()}
    </ul>

    <!-- Footer -->
    ${renderFooter('all')}

  </div>
</body>
</html>
`;

  reply.type('text/html').send(html);
});

// Create a new todo
app.post('/api/todos', async (request, reply) => {
  const result = await request.readSignals();
  const text = result.signals?.newTodoText?.trim();

  if (!text) {
    return reply.datastar((sse) => {
      sse.patchSignals({ error: 'Please enter a todo!' });
    });
  }

  const id = generateId();
  const todo = {
    id,
    text,
    completed: false,
    createdAt: new Date(),
  };

  todos.set(id, todo);

  await reply.datastar((sse) => {
    // Clear the input and error
    sse.patchSignals({ newTodoText: '', error: '' });

    // Remove empty state if it exists and add the new todo
    sse.patchElements(renderTodoItem(todo), {
      selector: '#todo-list',
      mode: PatchMode.Append,
    });

    // Update footer
    sse.patchElements(renderFooter(result.signals?.filter || 'all'));
  });
});

// Toggle todo completion
app.post('/api/todos/:id/toggle', async (request, reply) => {
  const { id } = request.params;
  const result = await request.readSignals();
  const todo = todos.get(id);

  if (!todo) {
    return reply.status(404).send({ error: 'Todo not found' });
  }

  todo.completed = !todo.completed;

  await reply.datastar((sse) => {
    // Update the specific todo item
    sse.patchElements(renderTodoItem(todo));
    // Update footer counts
    sse.patchElements(renderFooter(result.signals?.filter || 'all'));
  });
});

// Delete a todo
app.delete('/api/todos/:id', async (request, reply) => {
  const { id } = request.params;
  const result = await request.readSignals();

  if (!todos.has(id)) {
    return reply.status(404).send({ error: 'Todo not found' });
  }

  todos.delete(id);

  await reply.datastar((sse) => {
    // Remove the todo element
    sse.removeElements(`#todo-${id}`);

    // Update footer or show empty state
    if (todos.size === 0) {
      sse.patchElements('<li id="empty-state" class="empty">No todos yet!</li>', {
        selector: '#todo-list',
        mode: PatchMode.Inner,
      });
    }
    sse.patchElements(renderFooter(result.signals?.filter || 'all'));
  });
});

// Filter todos
app.post('/api/todos/filter/:filter', async (request, reply) => {
  const { filter } = request.params;

  await reply.datastar((sse) => {
    // Update the signal
    sse.patchSignals({ filter });

    // Re-render the list with the new filter
    sse.patchElements(renderTodoList(filter), {
      selector: '#todo-list',
      mode: PatchMode.Inner,
    });

    // Update footer with active filter
    sse.patchElements(renderFooter(filter));
  });
});

// Clear completed todos
app.post('/api/todos/clear-completed', async (request, reply) => {
  const result = await request.readSignals();

  // Remove all completed todos
  for (const [id, todo] of todos) {
    if (todo.completed) {
      todos.delete(id);
    }
  }

  await reply.datastar((sse) => {
    // Re-render the entire list
    sse.patchElements(renderTodoList(result.signals?.filter || 'all'), {
      selector: '#todo-list',
      mode: PatchMode.Inner,
    });

    // Update footer
    sse.patchElements(renderFooter(result.signals?.filter || 'all'));
  });
});

// Start the server
app.listen({ port: 3000 }, (err) => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log('Todo App running at http://localhost:3000');
});
