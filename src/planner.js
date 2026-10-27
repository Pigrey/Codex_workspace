(function (root) {
  const api = {
    day(date = new Date()) {
      return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    },
    tasks(state, day, done = false) {
      const tasks = new Map(state.tasks.map(t=>[t.id,t]));
      return (state.plans?.[day] || []).map(id=>tasks.get(id)).filter(t=>t && t.done===done);
    },
    add(state, day, id) {
      if (!state.tasks.some(t=>t.id===id && !t.done)) return;
      state.plans ||= {};
      state.plans[day] ||= [];
      if (!state.plans[day].includes(id)) state.plans[day].push(id);
    },
    remove(state, day, id) {
      if (state.plans?.[day]) state.plans[day] = state.plans[day].filter(x=>x!==id);
    },
    move(state, day, id, direction) {
      if (![1,-1].includes(direction)) return;
      const active = api.tasks(state,day);
      const index = active.findIndex(t=>t.id===id);
      if (index<0 || !active[index+direction]) return;
      const ids = state.plans[day];
      const a = ids.indexOf(id), b = ids.indexOf(active[index+direction].id);
      [ids[a],ids[b]] = [ids[b],ids[a]];
    },
    prune(state) {
      const ids = new Set(state.tasks.map(t=>t.id));
      for (const day of Object.keys(state.plans || {})) state.plans[day] = state.plans[day].filter(id=>ids.has(id));
    }
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.planner = api;
})(globalThis);
