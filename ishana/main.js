(() => {
	const state = {
		tools: [],
		metrics: null,
		activeTags: new Set(),
		searchQuery: '',
		activeView: 'tools',
	};

	function $(selector) { return document.querySelector(selector); }
	function el(tag, props = {}, children = []) {
		const node = document.createElement(tag);
		Object.entries(props).forEach(([k, v]) => {
			if (k === 'class') node.className = v; else if (k === 'dataset') Object.assign(node.dataset, v); else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v); else if (v !== undefined && v !== null) node.setAttribute(k, v);
		});
		children.forEach(child => node.append(child));
		return node;
	}

	async function fetchJson(path) {
		const res = await fetch(path, { cache: 'no-store' });
		if (!res.ok) throw new Error(`Failed to load ${path}`);
		return await res.json();
	}

	function renderTags() {
		const container = $('#tagFilters');
		container.innerHTML = '';
		const allTags = new Set();
		state.tools.forEach(t => (t.tags || []).forEach(tag => allTags.add(tag)));
		[...allTags].sort().forEach(tag => {
			const isActive = state.activeTags.has(tag);
			const node = el('span', { class: `tag${isActive ? ' active' : ''}` });
			node.textContent = tag;
			node.addEventListener('click', () => {
				if (state.activeTags.has(tag)) state.activeTags.delete(tag); else state.activeTags.add(tag);
				renderTools();
				renderTags();
			});
			container.appendChild(node);
		});
	}

	function matchesFilters(tool) {
		const query = state.searchQuery.toLowerCase();
		const matchQuery = !query || tool.name.toLowerCase().includes(query) || (tool.description || '').toLowerCase().includes(query) || (tool.owner || '').toLowerCase().includes(query);
		const activeTags = state.activeTags;
		const matchTags = activeTags.size === 0 || (tool.tags || []).some(tag => activeTags.has(tag));
		return matchQuery && matchTags;
	}

	function renderTools() {
		const grid = $('#toolsGrid');
		grid.innerHTML = '';
		state.tools.filter(matchesFilters).forEach(tool => {
			const card = el('div', { class: 'tool-card' }, [
				el('h4', {}, [tool.name]),
				el('p', {}, [tool.description || '']),
				el('div', { class: 'meta' }, [`Owner: ${tool.owner || '—'} · Tags: ${(tool.tags || []).join(', ')}`]),
				el('div', { class: 'actions' }, [
					el('a', { class: 'btn primary', href: tool.url || '#', target: '_blank', rel: 'noopener' }, ['Open']),
					tool.docs ? el('a', { class: 'btn', href: tool.docs, target: '_blank', rel: 'noopener' }, ['Docs']) : null,
				].filter(Boolean))
			]);
			grid.appendChild(card);
		});
	}

	function switchView(view) {
		state.activeView = view;
		document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
		const active = document.getElementById(`view-${view}`);
		if (active) active.classList.add('active');
	}

	function renderMetrics() {
		const m = state.metrics;
		if (!m) return;
		$('#metricTotalTools').textContent = String(m.totalTools ?? state.tools.length);
		$('#metricMau').textContent = String(m.mau ?? 0);
		$('#metricRequests').textContent = String(m.requests24h ?? 0);

		drawBarChart($('#chartUsageByTool'), m.usageByTool || []);
		drawLineChart($('#chartRequestsOverTime'), m.requestsOverTime || []);
	}

	function drawBarChart(canvas, series) {
		const ctx = canvas.getContext('2d');
		const width = canvas.width; const height = canvas.height;
		ctx.clearRect(0, 0, width, height);
		ctx.fillStyle = '#1b2547'; ctx.fillRect(0, 0, width, height);
		const labels = series.map(d => d.name);
		const values = series.map(d => d.value);
		const max = Math.max(1, ...values);
		const barWidth = Math.max(24, Math.floor(width / (values.length * 2)));
		const gap = barWidth;
		const originX = 40; const originY = height - 30;
		ctx.strokeStyle = 'rgba(255,255,255,0.1)';
		ctx.beginPath(); ctx.moveTo(originX, 10); ctx.lineTo(originX, originY); ctx.lineTo(width - 10, originY); ctx.stroke();
		values.forEach((v, i) => {
			const x = originX + 10 + i * (barWidth + gap);
			const h = Math.round((v / max) * (originY - 20));
			ctx.fillStyle = '#6ea8fe';
			ctx.fillRect(x, originY - h, barWidth, h);
			ctx.fillStyle = 'rgba(255,255,255,0.8)';
			ctx.font = '12px system-ui';
			ctx.fillText(String(v), x, originY - h - 4);
			const label = labels[i] || '';
			ctx.fillStyle = 'rgba(255,255,255,0.7)';
			ctx.save();
			ctx.translate(x + barWidth / 2, originY + 12);
			ctx.rotate(-Math.PI / 6);
			ctx.textAlign = 'center';
			ctx.fillText(label, 0, 0);
			ctx.restore();
		});
	}

	function drawLineChart(canvas, points) {
		const ctx = canvas.getContext('2d');
		const width = canvas.width; const height = canvas.height;
		ctx.clearRect(0, 0, width, height);
		ctx.fillStyle = '#1b2547'; ctx.fillRect(0, 0, width, height);
		const xs = points.map(p => p.t);
		const ys = points.map(p => p.v);
		const minY = Math.min(...ys, 0);
		const maxY = Math.max(...ys, 1);
		const pad = 30;
		const x0 = pad; const y0 = height - pad; const x1 = width - pad; const y1 = pad;
		ctx.strokeStyle = 'rgba(255,255,255,0.1)';
		ctx.beginPath(); ctx.moveTo(x0, y1); ctx.lineTo(x0, y0); ctx.lineTo(x1, y0); ctx.stroke();
		ctx.beginPath();
		ctx.strokeStyle = '#7ee787';
		ctx.lineWidth = 2;
		points.forEach((p, i) => {
			const x = x0 + (i / Math.max(1, points.length - 1)) * (x1 - x0);
			const y = y0 - ((p.v - minY) / Math.max(1, maxY - minY)) * (y0 - y1);
			if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
		});
		ctx.stroke();
	}

	function bindEvents() {
		document.querySelectorAll('.nav-btn').forEach(btn => {
			btn.addEventListener('click', () => {
				switchView(btn.dataset.view);
				if (btn.dataset.view === 'metrics') renderMetrics();
			});
		});
		$('#search').addEventListener('input', (e) => { state.searchQuery = e.target.value; renderTools(); });
		$('#themeToggle').addEventListener('click', () => {
			document.body.classList.toggle('light');
		});
	}

	async function init() {
		try {
			const [tools, metrics] = await Promise.all([
				fetchJson('/mock-data/tools.json'),
				fetchJson('/mock-data/metrics.json'),
			]);
			state.tools = tools || [];
			state.metrics = metrics || null;
		} catch (e) {
			console.error(e);
			state.tools = [];
			state.metrics = null;
		}
		renderTags();
		renderTools();
		bindEvents();
	}

	document.addEventListener('DOMContentLoaded', init);
})();

